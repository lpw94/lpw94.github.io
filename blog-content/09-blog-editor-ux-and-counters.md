## 一、这次又改了点啥

上一波（`54f0ed3`）把博客装饰得花里胡哨之后，这次提交（`14c9cb1`）转回头**打磨后台写作体验**和**补齐两个最基础的数据信号**：

- 文章弹窗：保存按钮一分为二（保存草稿 / 发布），状态不再靠下拉框选；
- 字段布局更紧凑、输入框和按钮整体缩小、整窗不再出滚动条；
- 标题 / 路径必填；
- 登录弹窗：点遮罩不再误关，只认 × 和 Esc；
- 侧边栏新增 **Konami 秘籍**彩蛋组件；
- 新增 **全站访客次数**（侧边栏）和 **文章浏览量**（详情页）两个 Supabase 计数器。

按惯例：加了什么 / 怎么做的 / 踩了什么坑。

## 二、文章弹窗：保存按钮一分为二

### 1. 为什么拆

原来弹窗底部只有一个「保存」按钮，文章状态（草稿 / 发布）靠一个**状态下拉框**选。问题是下拉和按钮是两套心智——选了「发布」结果手滑点了「草稿」，或者忘了选、默认落了个草稿，发布出去却发现没上架。

改成**两个按钮直接决定状态**，下拉框整个删掉：

- 「保存草稿」→ 落库 `status: 'draft'`，`published_at` 清空；
- 「发布」→ 落库 `status: 'published'`，写入发布时间。

状态不再有"选错"的空间，所见即所得。

### 2. 做法

关键是 `submit` 不再吃表单事件、改吃状态参数：

```ts
const submit = async (status: FormState['status']) => {
  if (saving) return
  // …必填校验（见下一节）…

  const payload = {
    title: form.title,
    slug: form.slug,
    content: form.content,
    cover_url: form.cover_url,
    category: form.category,
    status,                       // ← 由按钮决定，不再读下拉
    published_at:
      status === 'published'
        ? existing?.published_at ?? new Date().toISOString()   // 已发布的沿用原时间
        : null,
  }
  // insert / update …
}
```

底部三个按钮都是 `type="button"`（防止触发表单默认提交、造成双重落库），各自带状态参数：

```tsx
<div className="form-actions">
  <button type="button" onClick={() => submit('draft')} disabled={saving}>
    {form.id ? '存为草稿' : '保存草稿'}
  </button>
  <button type="button" className="btn-primary" onClick={() => submit('published')} disabled={saving}>
    {form.id ? '发布更新' : '发布'}
  </button>
  <button type="button" className="btn-ghost" onClick={closeModal}>取消</button>
</div>
```

表单 `onSubmit` 仍保留一个兜底：`(e) => { e.preventDefault(); submit(form.status) }`，这样在正文框里按 Enter 提交时，沿用弹窗里 `form.status` 的当前语义（新建默认 `published`，编辑回填原状态）。

### 3. 配套的几处收尾

- **标题 / 路径必填**：因为保存/发布按钮是 `type="button"`、不走原生表单提交，`<input required>` 根本不会拦截。于是 `submit` 开头手动补了 JS 校验：标题空 → `alert('标题不能为空')` 并 return；路径空 → 同理；再之后是正文非空校验（富文本是 `contentEditable`，HTML 的 `required` 对它本就无效）。
- **字段 label 改同行（inline）**：原来 `.field` 是 `flex-direction: column`（label 在上、控件在下独占一行），改成 `flex-direction: row; align-items: center`——label 固定宽、控件占满剩余宽度，标题 / slug / 类型三行更紧凑。
- **整体缩小、整窗不滚动**：输入框字号 14→13px、内边距收紧；按钮 `padding: 6px 14px`；`.modal.post-modal` 由固定 `height: 82vh` 改为 `height: auto`（按内容自适应），只有固定 **300px** 的正文编辑框内部滚动。结果就是——**弹窗自己永远不出滚动条**，长文也只在正文框里滚。

## 三、登录弹窗：点遮罩不再关

后台未登录访问 `/admin` 会自动弹登录框。原来遮罩层绑了 `onClick={onClose}`，点空白处就关——容易误触，把刚输一半的邮箱密码弄没。

改成**只认两种关闭方式**：右上角 × 按钮、Esc 键。实现就是把遮罩的点击关掉，顺手删掉弹窗内部的 `stopPropagation`（不再需要）：

```tsx
return createPortal(
  // 之前：<div className="modal-backdrop" onClick={onClose}>
  <div className="modal-backdrop">          {/* ← 点遮罩不再关闭 */}
    <div className="modal login-modal" role="dialog" aria-modal="true" aria-label="后台登录">
      {/* … */}
      <button type="button" className="modal-close" onClick={onClose} aria-label="关闭">×</button>
    </div>
  </div>,
  document.body,
)
```

Esc 关闭本来就在 `useEffect` 里挂着（`e.key === 'Escape'` → `onClose`）。没登录的用户关掉弹窗后，页面仍显示「请先登录 + 点击登录」，可随时重开。

## 四、侧边栏新成员：Konami 秘籍

ProfileCard 和广告位之间，加了一个隐藏彩蛋 `KonamiCode`：在页面**任意处**依次敲出经典序列 `↑ ↑ ↓ ↓ ← → ← → B A`，卡片上的按键提示会实时高亮已按对的键，全对后炸开一场全屏彩带，卡片进入「🎉 已激活」态，点「收起」恢复提示。

实现要点：

```ts
const SEQUENCE = ['ArrowUp','ArrowUp','ArrowDown','ArrowDown','ArrowLeft','ArrowRight','ArrowLeft','ArrowRight','b','a']

const onKey = (e: KeyboardEvent) => {
  // 在输入框 / 文本域 / contentEditable 里打字时不拦截，避免影响正常输入
  const t = e.target as HTMLElement | null
  if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable)) return

  const k = e.key.length === 1 ? e.key.toLowerCase() : e.key
  if (k === SEQUENCE[idx]) {
    idx += 1
    setProgress(idx)
    if (idx === SEQUENCE.length) { idx = 0; setProgress(0); setActive(true); burstConfetti() }
  } else {
    // 输错一个键时，若当前键恰好是序列首键，则当成「重新从头开始」，不用全重来
    idx = k === SEQUENCE[0] ? 1 : 0
    setProgress(idx)
  }
}
window.addEventListener('keydown', onKey)
```

彩带 `burstConfetti()` 是纯 DOM + CSS 动画（约 90 片、随机方向飞散），~1.8s 后把临时层从 `body` 移除，**零依赖**。同样尊重 `prefers-reduced-motion`：系统开了"减少动态"就只进激活态、不放彩带。

## 五、两个 Supabase 计数器

### 1. 侧边栏：全站访客次数

`VisitorWidget` 每次会话调一次 `bump_visitors()` 原子自增并返回最新值。用 `sessionStorage` 去重，避免 SPA 热重载 / 重复挂载多计；**RPC 不可用时降级为 `localStorage` 本地计数**，保证组件永远有数可显示、不报错：

```ts
// 注意：supabase.rpc() 返回的是 PromiseLike（只有 then，没有 catch），
// 不能链 .catch，所以用 async/await + try/catch 兜异常
const fetchOrLocal = async () => {
  try {
    const { data, error } = await supabase.rpc('bump_visitors')
    if (error) { console.warn('访客计数不可用，已降级本地计数：', error.message); return fallbackLocal() }
    const n = Number(data)
    if (!Number.isFinite(n)) return fallbackLocal()
    setCount(n)
  } catch {
    fallbackLocal()
  }
}
```

### 2. 文章详情：浏览量

`PostDetail` 每次打开文章（slug 变化）就调一次 `bump_post_views(p_post_id)` 自增，meta 区显示 `👁 N 次浏览`。用 `useRef` 去重：**同一篇在同一次挂载内只计一次**（规避 React StrictMode 开发环境双调用多计），切换文章（新 id）会重新计数，符合"每次打开页面就算一次"。

```ts
// 渲染处做了空值兜底，库里没加 views 列时也不崩
👁 {(post.views ?? 0).toLocaleString('zh-CN')} 次浏览
```

### 3. 后端：原子自增 RPC（security definer）

两个计数都走数据库函数，而不是让前端直接 `update` 整张表。函数用 `security definer`，**匿名访客只能经函数自增，拿不到整表写权限**：

```sql
-- 文章浏览量
create or replace function bump_post_views(p_post_id uuid)
returns bigint language plpgsql security definer set search_path = public as $$
declare v bigint;
begin
  update posts set views = views + 1 where id = p_post_id returning views into v;
  return v;
end; $$;
grant execute on function public.bump_post_views(uuid) to anon, authenticated, service_role;

-- 全站访客次数（单行走全局计数器）
create table if not exists site_stats (key text primary key, visitors bigint not null default 0, updated_at timestamptz not null default now());
insert into site_stats (key, visitors) values ('global', 0) on conflict (key) do nothing;
create or replace function bump_visitors()
returns bigint language plpgsql security definer set search_path = public as $$
declare v bigint;
begin
  update site_stats set visitors = visitors + 1, updated_at = now() where key = 'global' returning visitors into v;
  return v;
end; $$;
grant execute on function public.bump_visitors() to anon, authenticated, service_role;
```

### 4. 踩的三个坑

- **详情页黑屏**：给 `Post` 类型加了 `views: number`，渲染直接 `post.views.toLocaleString()`。但库里还没加 `views` 列，`select('*')` 返回的对象没有这个字段 → `undefined.toLocaleString()` 抛 TypeError，整棵 React 树崩溃，深空背景下就是黑屏。**修法**：渲染处改成 `(post.views ?? 0)`，代码不再依赖库是否已迁移。
- **访客一直显示「—」**：早期组件用 `sessionStorage` 标记后直接 `return`，而 React StrictMode（开发）下首次挂载 cleanup、第二次挂载直接 return，首次数又被 `cancelled` 闭包标志吞掉 → 永远 `set` 不上值。去掉拦截、统一成 `fetchOrLocal()` 后修复（见上面第 1 节代码）。
- **CI 编译报 TS2339**：`supabase.rpc()` 的返回类型是 `PromiseLike<void>`，只有 `then`、没有 `catch`，写成 `.then(...).catch(...)` 会直接编译失败（`Property 'catch' does not exist on type 'PromiseLike<void>'`）。改成 `async/await` + `try/catch` 即可。**教训**：本地只跑 `vite build`（esbuild 只转译、不做类型检查）会漏掉这类错误，必须跑完整 `npm run build`（含 `tsc -b`）才能复现 CI 的失败。

## 六、部署提醒（重要）

代码调用了 `bump_post_views` / `bump_visitors` 两个 RPC，但**本地 `supabase/schema.sql` 不会自动应用到现有线上库**。需要去 Supabase 控制台 **SQL Editor** 手动执行这两段迁移（`posts` 加 `views` 列、`site_stats` 表、两个函数、`grant execute`），最后跑一句刷新缓存：

```sql
NOTIFY pgrst, 'reload schema';
```

不执行会怎样：接口 404、计数不入库——但页面**不会崩**（浏览量显示 0、访客次数走本地降级计数），只是数据不真实累计。想让计数真正生效，这一步必须做。

## 七、小结

这一版把写作后台从"能用"推向"顺手"：保存意图明确、弹窗不再乱滚、登录不会被误关；同时补齐了站点最基础的两个数据信号——**多少人来过**、**每篇看了多少次**。仍是"一个组件 + 一段 SQL + 几个 hook"的轻量加法，没动架构。

下一批想做的大概是：浏览量加个时间窗防刷、或者后台列表直接显示每篇的累计浏览数。先看文章吧。
