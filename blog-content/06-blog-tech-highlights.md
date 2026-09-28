

## 一、技术要点

### 1. 把权限写进数据库：RLS 代替服务端

没有自建后端，权限全靠 Supabase 的 **RLS（行级安全）**。核心就四组策略，直接定义了"谁能读什么、谁能写什么"：

| 对象 | 策略 | 效果 |
|---|---|---|
| `posts` | 公开 `select` 且 `status = 'published'` | 游客只能看已发布文章 |
| `posts` | `authenticated` 全权 | 登录后能增删改查草稿 |
| `comments` | 公开 `select` / 公开 `insert` | 读者无需登录即可留言 |
| `storage.objects` | `covers` 桶公开读 + 登录用户可上传 | 封面图公开可访问 |

```sql
-- 公开只读已发布
create policy "Public can read published posts"
  on posts for select
  using (status = 'published');

-- 登录用户全权管理
create policy "Authenticated users can manage posts"
  on posts for all
  to authenticated
  using (true) with check (true);
```

这样做的好处：**前端不需要任何"权限判断"代码**。哪怕有人直接在浏览器里调 API，未登录也写不进库、读不到草稿——安全边界在数据库这一层，不在前端。

> anon key 写在前端是**设计如此**，它天生公开；真正的门是 RLS 策略。

### 2. 正文双模式：一套字段，两种渲染

后台既能用富文本编辑器（产出 HTML），也能粘贴纯 Markdown，但都存进同一个 `content` 字段。渲染时**由内容本身决定用哪种方式**：

```ts
const HTML_TAG =
  /<\/?(p|h[1-6]|ul|ol|li|blockquote|pre|strong|em|a|br|img|figure|table)\b[^>]*>/i

export function looksLikeHtml(content: string) {
  return HTML_TAG.test(content)
}
```

- 命中块级/行内标签 → 当 HTML 渲染；
- 否则 → 走 `react-markdown + remark-gfm`（表格、任务列表、删除线都支持）。

两个关键取舍：

- **react-markdown 默认不解析原始 HTML**，天然规避 XSS。真要支持内嵌 HTML，得自己加 `rehype-raw` **配合 DOMPurify** 消毒，不能裸上。
- **meta description 用剥标签后的纯文本**，避免摘要里混进 `<p>` 之类的标签：

```ts
export function toPlainText(content: string) {
  return content.replace(/<[^>]+>/g, ' ')
}
```

### 3. 纯静态托管，RSS / Sitemap 只能构建时生成

GitHub Pages 跑不了服务端函数，所以 RSS 和 Sitemap 不是接口，而是**构建产物**。`scripts/gh-pages.mjs` 在 `vite build` 之后从 Supabase 拉已发布文章，生成 XML：

```js
const { data } = await supabase
  .from('posts')
  .select('slug, title, published_at')
  .eq('status', 'published')
  .order('published_at', { ascending: false })
```

两个工程细节值得说：

- **best-effort 设计**：缺环境变量、拉取失败、没有文章，都只 `console.warn` 然后跳过，**绝不阻断部署**。静态站的可部署性比 feeds 完整性更重要。
- **XML 转义**：标题里的 `&`、`<` 等必须转义，否则 feeds 直接解析失败。

```js
const escapeXml = (s = '') => String(s).replace(/[<>&'"]/g, (c) =>
  ({ '<':'&lt;', '>':'&gt;', '&':'&amp;', "'":'&apos;', '"':'&quot;' }[c]))
```

代价也要清楚：**新发文章必须重新部署**，RSS/sitemap 才会更新。

### 4. SPA 深链刷新 404 的兜底

GitHub Pages 是纯静态托管，访问 `/post/hello-world` 时找不到对应文件就 404。最省事的解法是复制一份入口页当 404 页：

```js
copyFileSync('dist/index.html', 'dist/404.html')
```

这样刷新任何深链，Pages 返回 404.html（其实就是 React 应用），路由接管后正常渲染。

### 5. `VITE_` 变量是构建时内联的

Vite 会把 `import.meta.env.VITE_*` **在构建时替换成字面量**。这意味着：

- 运行时改环境（比如容器里改 env）**完全无效**；
- CI 里 Secrets 改名、漏配、拼错前缀，构建就会落到代码兜底值上，而且**必须 Re-run 才恢复**。

### 6. 时区：`timestamptz` 不等于"可以直接显示"

PostgREST 返回 `timestamptz` 时给的是 UTC ISO 串，直接字符串截取会偏 8 小时。统一用一个工具收口：

```ts
export function formatDate(iso?: string | null): string      // YYYY-MM-DD
export function formatDateTime(iso?: string | null): string  // YYYY-MM-DD HH:mm
```

用 `getFullYear/getMonth/getHours` 这类**本地时区**的取值方法，而不是 `slice`。同时给 `toDate` 加了 `NaN` 判断，无效值返回空串，避免页面上出现 `Invalid Date`。

### 7. `tsc -b` 与项目引用

构建脚本是 `tsc -b && vite build`——**类型检查不过就发布不了**。用 project references 拆了 app 和 node 两份 tsconfig 时要注意：被引用的 composite 项目**不能 `noEmit`**，得把产物 `outDir` 重定向到临时目录。

## 二、自定义功能拆解

### 1. 登录弹窗：默认密码登录，三模式切换

登录不是一个独立页面，而是一个弹窗（`LoginModal`），内置三种模式：**魔法链接 / 密码登录 / 注册**。

几个实现要点：

- **默认落在密码登录**，把最常用的路径放第一位；
- **未登录访问 `/admin` 自动弹出**——`useEffect(() => setShowLogin(!user))`，关掉后仍保留一个"点击登录"入口；
- **登录成功即关闭**，由 `Admin` 的 `onAuthStateChange` 感知会话并渲染后台；
- **弹窗打开时锁背景滚动**，恢复时还原原值（而不是硬写 `auto`）：

```ts
const prev = document.body.style.overflow
document.body.style.overflow = 'hidden'
return () => { document.body.style.overflow = prev }
```

- 支持 **Esc 关闭**，点遮罩关闭（内容区 `stopPropagation` 防止误关）。

回跳地址统一用 `VITE_SITE_URL` 拼，避免在本地生成链接时把 `localhost` 写进邮件。

### 2. 顶部栏登录态与退出

`Layout` 订阅会话状态（`getSession` + `onAuthStateChange`），已登录时在导航右侧渲染**邮箱 + 退出登录**：

- 邮箱过长 `text-overflow: ellipsis` 截断，`title` 属性露出完整值；
- 退出调用 `supabase.auth.signOut()`，会话清除后 UI 同步收起；
- 若当时在 `/admin`，退出后跳回首页——**否则马上又会弹出登录窗**；
- `onAuthStateChange` 是多标签页共享的，一个标签退出，另一个标签也会同步。

未登录时右侧不渲染任何东西（保持"顶部不放登录入口"的设计）。

### 3. 轻量富文本编辑器（零依赖）

基于 `contentEditable` + `document.execCommand`，不引第三方编辑器库，工具栏覆盖加粗、斜体、删除线、H2/H3、列表、引用、代码块、链接、图片、撤销重做。

整个实现里**最容易踩的坑是光标/选区丢失**：

```jsx
<button
  type="button"
  // 关键：阻止按钮抢走焦点，否则浏览器会丢失编辑器里的选区，命令作用不到选中文本
  onMouseDown={(e) => e.preventDefault()}
  onClick={() => exec(c.cmd, c.arg)}
>
```

点击工具栏按钮会让编辑器失焦、选区塌陷，`execCommand` 就作用不到用户选中的文本。`onMouseDown` 里 `preventDefault` 保住焦点，命令才有效。

第二个坑是**受控值回写导致光标跳到开头**——只在外部值与当前内容不一致时才同步，打字过程中两者本就相等，不会重设 `innerHTML`：

```ts
useEffect(() => {
  const el = bodyRef.current
  if (el && el.innerHTML !== value) el.innerHTML = value || ''
}, [value])
```

插入图片时对 `src` / `alt` 做属性转义，避免地址里的引号截断属性、破坏标签结构。

### 4. 分类筛选：状态放在 URL 上

首页的分类筛选用 `useSearchParams`，**筛选状态存在 URL 里**（`?category=frontend`），这样刷新和分享链接都能保持当前分类。

数据策略是**一次性取回全部已发布文章，分类切换在本地完成**——个人博客文章量不大，切分类是瞬间的，也省掉每次点击一次网络请求。

按钮上的篇数用 `useMemo` 从 `CATEGORIES` 动态初始化：

```ts
const counts = useMemo(() => {
  const base: Record<string, number> = { all: posts.length }
  CATEGORIES.forEach((c) => { base[c.value] = 0 })
  posts.forEach((p) => { if (p.category) base[p.category] = (base[p.category] ?? 0) + 1 })
  return base
}, [posts])
```

以后增删分类只改 `types.ts` 一处，这里不用动。

### 5. 封面图上传

上传到公开桶 `covers`，成功后取 `getPublicUrl` 得到可直接 `<img>` 加载的地址。三条经验：

- 桶设 **public** 才能免签名直接访问；
- 上传策略收在 `to authenticated`，只有登录用户能传；
- 上传失败如果报的是 `ERR_QUIC_PROTOCOL_ERR` 这类**没有 HTTP 状态码**的错，先怀疑网络传输层（关 QUIC / 换网络），别急着改代码。

### 6. 评论昵称自动填充登录邮箱

读者评论无需登录，但**已登录用户应该少填一次**。做法是订阅登录态，在昵称为空时用邮箱预填，**不覆盖用户手动输入的内容**：

```ts
setAuthor((prev) => prev || user.email)
```

发表成功后昵称回填邮箱（未登录则清空），正文清空，方便连续留言。

### 7. 密码重置落地页

`/reset-password` 负责承接邮件里的重置链接：解析令牌 → 校验两次输入一致 → 调 `updateUser({ password })` 设置新密码。

它同时是**给"只有魔法链接、没有密码"的老账号补设密码的通用入口**——这类账号没法直接密码登录，走一次"忘记密码"就能补上，之后两种登录方式并存。

## 三、小结

这个博客一共就几件事：**RLS 管权限、构建时生成 feeds、一个弹窗承载登录、一个零依赖编辑器承载写作**。没有复杂架构，但每一处都踩过坑、也都留了可复用的模式。

如果要继续迭代，优先级大概是：图片上传前的客户端压缩（省 Storage 配额）、评论的反垃圾策略、以及把 RSS/sitemap 的更新从"手动 push"改成定时任务触发。
