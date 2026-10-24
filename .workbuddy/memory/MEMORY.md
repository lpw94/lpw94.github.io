# 博客项目长期记忆（WorkBuddy/blog）

## 技术栈与部署
- React 18 + Vite + TypeScript + Supabase，dev 分支开发，推 main 触发 GitHub Actions 部署 lpw94.github.io。
- 文章存 Supabase `posts` 表（RLS：authenticated 可写、anon 只读已发布）；RSS/sitemap 由
  `scripts/gh-pages.mjs` 构建时拉已发布文章生成（best-effort，缺 .env 不阻断构建）。

## 功能模块与数据表
- 常用导航 `/tools`（2026-10-14 合并，提交 916cb37）：静态 `src/sites.ts` + DB `bookmarks`
  表合并展示，同一套搜索/分组/卡片；DB 书签按归一化网址原位替换同址静态条目（后台改的优先）；
  `/bookmarks` 旧链接 Navigate 跳 /tools；后台 /admin「书签配置」tab 管理 DB 书签
  （BookmarkAdmin.tsx，改完调 Tools.tsx 导出的 invalidateToolsCache）。
- `/notes` 记事本（2026-10-14 新增，提交 8749b9d）：`notes` 表**私有**，RLS 仅 authenticated
  可读写、不授权 anon；页面即管理界面（无需 admin tab），导航入口仅登录后显示；
  LoginModal 有可选 redirectTo 参数（默认 /admin）。
- 新增 SQL 表的工作流：写 `supabase/*.sql`（幂等 policy + grant），由用户在 Supabase SQL
  Editor 手动执行；本地无 .env/service_role，无法代跑 SQL。
- 悬浮音乐播放器（2026-10-24 重写，提交 1cfc72b）：`aplayer@1.10.1`（npm，不用 CDN）+ 自实现
  Meting 协议（`src/lib/meting.ts`）拉网易云歌单；先探测可播性再建列表，缓存 6 小时。
  歌单 ID 默认 2884035（云音乐原创榜，可播率最高 46%），可用 `VITE_NETEASE_PLAYLIST` 覆盖。
- 本机网络：**jsdelivr 不可达**（用 npm 包或 elemecdn）；`api.i-meto.com` + 网易云音频域都带
  CORS `*`，浏览器可直接 fetch；supabase.co 仍被阻断。
- 构建命令用受管 node：`C:/Users/lpw94/.workbuddy/binaries/node/versions/22.22.2-6/npm run build`。

## 用户偏好
- 需求沟通用 @文件:行号 + @command://fix；代码改动最小化、保留已有逻辑不重构；
  按「数据库→类型→页面→路由→样式→构建→提交」分块推进，提交在 dev 分支（不主动推 main）。

## 样式坑位（踩过的，别再犯）
- **CSS grid 隐式列 + nowrap 文本 = 整页横向溢出**：`.related-list` 曾是 `display:grid` 无显式
  列定义，隐式列按 max-content 计算，而 `.related-title` 是 `white-space:nowrap`，390 屏上把
  卡片撑到 641px、document.scrollWidth 666。修法：`grid-template-columns: minmax(0,1fr)` +
  卡片 `min-width:0`。任何「列表 + 单行省略标题」的布局都要显式 `minmax(0,1fr)`。
- 裸 `nav { justify-content:center }` 会误伤 `.category-filter` 等非顶栏 nav → 断言选择器要
  收敛成 `.site-header nav`。
- 弹窗在含 `backdrop-filter` 的容器里 `position:fixed` 会被当成包含块 → 用 `createPortal` 挂 body。
- APlayer 覆盖样式时记住三点：① 默认贴**左下角**且 `z-index:99`；② 播放器盒子是 `content-box`，
  实际宽度 = width + 18px（折叠把手 padding）+ 2px 边框；③ 列表开关是 `.aplayer-icon-menu`
  （不是 `-list`），折叠态靠 `aplayer-list-hide` 的 `max-height:0 !important`。
  量尺寸要等 `transition: all .3s` 结束，否则拿到中间值。
- **`display: contents` 的父级不能替子元素抬层级**：`.mp-host{display:contents}` 不生成盒子，
  它身上的 `position:fixed + z-index:9997` 不建立层叠上下文，所以浮层（如 `.aplayer-list`）
  必须自己声明 `z-index`，否则会退回 auto 被 `.sidebar`(60) 之类的普通内容盖住。
- 改完文件要 `touch` 一次，避免 vite dev 提供陈旧 transform。
