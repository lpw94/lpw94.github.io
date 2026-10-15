## 一、这次升级了点啥

距离上一篇建站实录又过去一阵，这次博客动了四刀，刀刀砍在"好用"上：

- **私有记事本 `/notes`**：和博文一样入库，但 RLS 只允许登录用户读写，未登录连入口都看不到——自己的随手记，不想公开
- **书签 × 工具大合并**：`/bookmarks` 和 `/tools` 两个页面合成一个「常用导航」，静态工具和数据库书签共享同一套搜索、分类、卡片
- **时间组件弹日历**：右栏点一下时间，弹出居中月历；翻月、今日高亮、选日期、回到今天
- **修一个玄学 bug**：后台「添加书签」弹窗要滚动才看得到——根因是玻璃拟态的 `backdrop-filter` 偷偷改掉了 `position: fixed` 的包含块

外加两个顺带打磨：书签分类从"隐形"的 datalist 改成真下拉框；排查了一次 dev 服务器 Serving 陈旧代码的灵异事件。老规矩：加了什么 / 怎么做的 / 踩了什么坑。

## 二、私有记事本：和博文一样入库，但只有你能看

需求很明确：一个在线记事本，内容私密，登录才能用。整套思路和博客文章完全同构——Supabase 一张表 + RLS 控权限，前端一个页面管增删改查。

### 表设计与 RLS

```sql
create table if not exists public.notes (
  id uuid primary key default gen_random_uuid(),
  title text not null default '',
  content text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.notes enable row level security;

-- 仅登录用户可读写，不授权 anon：私有记事本，和书签的公开读刻意区分
create policy "notes 登录可读" on public.notes
  for select to authenticated using (true);
create policy "notes 登录可写" on public.notes
  for all to authenticated using (true) with check (true);
```

和书签表最大的差别就一句：**书签是 `anon` 可读的公开数据，记事本一条 `anon` 策略都不给**。RLS 是 Supabase 这类 BaaS 的安全底线，私有功能千万别靠前端"藏个入口"自欺欺人——入口可以注释掉，接口可是裸奔的。

### 登录墙与回跳

页面加载时先出加载态（不闪墙），确认无会话再弹登录框。这里给登录弹窗加了一个可选参数：

```tsx
// 魔法链接登录后回跳到调用方指定的页面（默认 /admin）
const { error } = await supabase.auth.signInWithOtp({
  email,
  options: { emailRedirectTo: `${SITE_URL}${redirectTo}` },
})
```

从记事本登录墙点魔法链接，邮件回来直接落在 `/notes`，不用再手动导航。顶部导航的「记事本」入口同样只渲染给登录用户——**双保险：入口隐藏 + 接口鉴权**。

### 编辑器细节

- 标题可空，列表里显示「无标题」
- 正文 textarea 随内容自动增高（封顶 420px，防止长文把弹窗撑爆）
- `Ctrl/⌘ + Enter` 快速保存，保存时刷新 `updated_at`
- 卡片按最近编辑倒序，删除走二次确认模态，不用原生 `confirm`

## 三、书签 × 工具：两个页面合成一个

原来 `/tools` 是写死在 `src/sites.ts` 里的静态外链，`/bookmarks` 是数据库里的个人收藏，两套页面、两套代码、两套体验。合并成一个「常用导航」，规则设计是重点：

| 规则 | 说明 |
| --- | --- |
| 静态打底 | 静态工具先渲染，分类顺序固定，页面不跳 |
| 同址替换 | DB 书签按**归一化网址**（去协议 / `www.` / 尾斜杠）原位替换同址静态条目——后台改过的优先 |
| 新条目追加 | 静态里没有的书签，追加进对应分类末尾 |
| 新分类追加 | 全新分类排在所有静态分类之后 |

```ts
/** 归一化网址：https://www.github.com/ 和 github.com 视为同一条 */
const canonical = (url: string) =>
  url.trim().toLowerCase()
    .replace(/^https?:\/\//, '')
    .replace(/^www\./, '')
    .replace(/\/$/, '')
```

体验上两个关键点：

1. **静态内容永远秒显**。DB 书签异步合入，不再有整页"加载中"——首屏直出，数据到了再补。
2. **后台改完前台立即生效**。后台增删改书签后调用 `invalidateToolsCache()` 失效前台 60s 模块级缓存，不用刷页面。

旧链接 `/bookmarks` 用 `<Navigate to="/tools" replace />` 兜底跳转，外部收藏不失效；导航里「书签」项移除、「工具」改名「导航」。

## 四、点时间，弹日历

右栏时间组件原来只是块死表。改成整体可点击（`role="button"`，支持 Enter/Space），点开居中弹出一个日历模态。

这个功能我做了两版，第一版是**侧栏内嵌展开**——翻月、今日高亮、选日期都有，但看着就别扭。原因很实在：侧栏只有 220px 宽且带 `overflow` 裁剪，内嵌面板把整张卡片撑得老长；而如果做成绝对定位浮层，会被侧栏的裁剪直接切烂。

第二版换成 `createPortal` 挂到 `document.body` 的居中模态，完全复用站内弹窗体系：

```tsx
{calOpen && createPortal(
  <div className="modal-backdrop" onMouseDown={...}>
    <div className="modal cal-modal" role="dialog" aria-modal="true">
      {/* 翻月 / 7 列格子 / 今日蓝框高亮 / 选中蓝底 / 回到今天 */}
    </div>
  </div>,
  document.body,
)}
```

关闭方式三选一：右上角 `×`、点黑色遮罩、按 `Esc`，打开期间锁背景滚动——和登录框、删除确认完全一致。日历状态存在组件 state 里，关掉再打开不丢。≤720px 移动端侧栏整体隐藏，这个功能自然退场，不用写适配。

## 五、重头戏：一个"滚动才看到"的弹窗

上面的日历弹窗本身没坑，但它埋的雷几天后炸了——用户反馈：**后台「添加书签」弹窗，要滚动页面才看得到**。

### 排查：不是弹窗的问题，是定位上下文被劫持

第一反应查 `z-index`、查 `position`，都没问题。直到翻出 `.container`（中间白卡）的样式：

```css
.container {
  backdrop-filter: blur(12px);  /* 玻璃拟态 */
}
```

**就是这行**。按 CSS 规范，元素带 `backdrop-filter`（以及 `transform`、`filter`、`perspective`、`will-change` 等）时，会成为内部所有 `position: fixed` 元素的**包含块**——fixed 不再相对视口定位，而是相对这个容器。

书签弹窗恰好是全站**唯一一个行内渲染**（没挂 body）的弹窗。于是它的 `inset: 0` 从"覆盖视口"变成了"覆盖整个白卡容器"，`align-items: center` 把弹窗推到容器的垂直中点：

```css
.modal-backdrop {
  position: fixed;
  inset: 0;                    /* 相对 .container，不是视口！ */
  display: flex;
  align-items: center;         /* 弹窗被推到容器垂直中点 */
}
```

书签越多 → 白卡容器越高 → 弹窗位置越靠下 → 直接掉出首屏。其他弹窗（文章、记事、删除确认）全都走了 `createPortal` 挂 body，所以只有它中招。

### 修复

```diff
- {open && (
-   <div className="modal-backdrop">
+ {open &&
+   createPortal(
+     <div className="modal-backdrop">
        ...
-     </div>
-   )}
+     </div>,
+     document.body,
+   )}
```

顺手补上打开期间锁背景滚动（原来滚轮还能滚背后的页面）。一行 `backdrop-filter` 引发的血案，复盘出两条经验：

1. **玻璃拟态有代价**：`backdrop-filter` / `filter` / `transform` 都会创建包含块，容器内的 fixed 定位全部失效。用了这些属性，内部的弹窗、浮层一律 `createPortal` 挂 body，别赌。
2. **全站弹窗走同一条管道**：统一 portal + 统一 `.modal-backdrop/.modal` 样式，新弹窗天然免疫这类问题。

## 六、顺带打磨：分类下拉框

修完弹窗发现「分类」项也是个隐形坑：原来用的是 `input + datalist`，7 个建议分类（开发/设计/学习/工具/社交/娱乐/其他）确实在代码里，但输入框预填了「开发」，datalist 的下拉箭头又极小，用户根本感知不到还有其他选项—— feedback 原话是"分类项只有开发一项"。

改成真 `<select>` 下拉，7 项一眼可见，末尾加「自定义…」——选中后下方出现文本输入框可键入新分类，编辑历史自定义分类的书签时自动回显。`.field select` 的样式本来就有，零 CSS 增量。

## 七、灵异事件：dev 服务器 Serving 了不存在的代码

还有一次更邪门的：页面控制台报 `Uncaught Error: Target container is not a DOM element`，栈顶指向 `createPortal`，可代码里 portal 明明挂的是 `document.body`——这玩意在浏览器里不可能不存在。

排查手法 worth 记一笔：直接 curl dev 服务器正在 Serving 的模块，和磁盘源码对比——

```bash
curl http://localhost:5173/src/components/BookmarkAdmin.tsx
```

Vite 的 jsxDEV 转换会带 `lineNumber` 注释，一对比就露馅了：served 版本里书签弹窗的 `createPortal(<jsx/>)` **只有 JSX 一个参数，`document.body` 整个丢了**，滚动锁 useEffect 也无影无踪，代码行数映射比磁盘少一截。而磁盘和 git 里的代码是好的。

真相：我在同一秒内对这个文件做了三次连续编辑（加滚动锁 → portal 开括号 → portal 闭括号），dev 服务器的文件监听漏掉了最后一次写入，一直 Serving 编辑中间态——`createPortal` 丢了容器参数，React 就报了这个错。修复极简：

```bash
touch src/components/BookmarkAdmin.tsx  # 强制监听器重新 transform
```

教训：**同一文件密集编辑后页面行为对不上，先怀疑 dev 服务器 Serving 陈旧 transform**，curl 一对比便知，比重启服务器还快。

## 八、小结

| 改动 | 一句话 |
| --- | --- |
| 私有记事本 | `notes` 表 RS 仅 authenticated 读写，登录墙 + 魔法链接回跳，卡片网格 + 自动增高编辑器 |
| 导航大合并 | 静态工具 + DB 书签同址归一化替换，静态秒显、异步合入、后台改完即失效缓存 |
| 日历弹窗 | 侧栏内嵌不行就 portal 挂 body，复用站内弹窗体系，Esc/遮罩/× 三通道关闭 |
| 定位坑 | `backdrop-filter` 创建包含块，行内渲染的 fixed 弹窗被推下首屏；portal 挂 body 根治 |
| 分类下拉 | datalist 太隐形，换 select + 自定义输入 |

功能都不大，但每个都对着一个真实的"用起来别扭"。博客是自己的项目，好处就是：用户反馈五分钟内就能定位到根因，改完当天上线。下一阶段计划给记事本加 Markdown 预览，以及把「常用导航」的搜索换成模糊匹配——有坑了继续来写实录。
