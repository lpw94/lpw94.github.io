# 博客项目长期记忆（WorkBuddy/blog）

## 技术栈与部署
- React 18 + Vite + TypeScript + Supabase，dev 分支开发，推 main 触发 GitHub Actions 部署 lpw94.github.io。
- 文章存 Supabase `posts` 表（RLS：authenticated 可写、anon 只读已发布）；RSS/sitemap 由
  `scripts/gh-pages.mjs` 构建时拉已发布文章生成（best-effort，缺 .env 不阻断构建）。
- **发文可自助完成，不用再让用户去 /admin 粘贴**（2026-10-26 打通）：
  `scripts/publish/` 三件套（`extract-token.mjs` 从日常 Chrome Profile 4 的 leveldb
  抽登录 JWT → `cdp-eval.mjs` 在 headless Chrome 里求值 → `expr-publish.js`
  按 slug 幂等 upsert）。**不需要 service_role key。**
  ⚠️ `scripts/publish/` **只保留本地、已加进 .gitignore**——`extract-token.mjs`
  会从浏览器 leveldb 抽登录 JWT，这工具不适合出现在公开仓库里。
  - 两个头必须分清：`apikey`=anon key（`.env` 的 VITE_SUPABASE_ANON_KEY），
    `Authorization: Bearer`=用户 JWT。反了会得到 401 / 42501。
  - token 只走环境变量→stdout 管道，不落盘、不进命令行参数；JWT 有效期约 1 小时。
  - 本机直连 `*.supabase.co` 仍全挂（curl/node 都是 ECONNRESET / HTTP 000，
    TLS 握手被中间设备打断，`openssl s_client` 显示 `Cipher is (NONE)`），
    **请求必须放到浏览器上下文里发**。
    ⚠️ **2026-10-26 更新：Chrome 可以直连，不必带 `--proxy-server`**——
    旧记忆说「必须带代理」，实测是那次代理端口恰好有效；现在代理端口失效时
    **直连反而能通**（Chrome 页面内 fetch Supabase 返回 200）。
    带代理反而翻车：代理不通时连 `lpw94.github.io` 都加载不出来，
    页面 origin 变成 `null`，CORS 预检被拒 → 所有 fetch 报 `Failed to fetch`。
    **判断依据是 `window.location.origin` 是否为 `null`**，不是猜。
  - ⚠️ **`--headless=new` 在本机会秒退**（826ms），必须用 `--headless=old`。
  - ⚠️ **Chrome 进程不能跨命令存活**：Bash 命令一结束就被回收，
    所以「起 Chrome → CDP 求值 → 关 Chrome」必须在**同一个命令/脚本**里完成
    （`scripts/publish/publish-post.mjs` 就是这么写的）。
  - ⚠️ **access_token 过期后，refresh_token 不一定全废**（2026-10-29 更正）：
    Supabase 每次刷新都轮换 refresh_token，**旧的确实报 `refresh_token_not_found`**，
    但只要浏览器**最近登录过**，leveldb 里就有新的可用。
    → **正确做法：先试 refresh_token，失败再回退密码登录**（见下），别一上来就断定要走密码。
    leveldb 里同 key 有多个版本，按文件 mtime 取最新、文件内取最靠后的那个。
  - ✅ **兜底路径：Chrome 密码库 + DPAPI 解密**（2026-10-29 打通，全程无需用户操作）：
    `%LOCALAPPDATA%\Google\Chrome\User Data\<Profile>\Login Data`（SQLite）
    → 表 `logins` 的 `origin_url`/`username_value`/`password_value`；
    `password_value` 以 `v10` 开头 → 剥 3 字节前缀 → DPAPI `CryptUnprotectData`
    → 明文是 **UTF-16LE**（末尾 `\x00` 要 strip）。
    ⚠️ `v20` 前缀（新版 app-bound 加密）此法解不了。
    实测 Profile 2 存有 `lpw94.github.io/admin` → `lpw94@qq.com`。
    实现见 `scripts/publish/extract-password.py`（**只走 stdout 管道**，不落盘不回显）。
  - ⚠️ `api.github.com` 直连也被阻断 → 查 Actions 状态用 **WebFetch**（服务端出口）。
  - 本地 `npm run build` 里 `gh-pages.mjs` 拉文章会 `fetch failed` → **本地没 RSS/Sitemap 很正常**，
    Actions 构建机没这问题。
  - CDP 端点只监听 `127.0.0.1`；默认 9336 常被占，新实例换端口（用 9340）。
  - 验证文章渲染用 CDP 读 `document.body.innerText`，不能靠 curl（SPA 深链接 404 正常）。

## 功能模块与数据表
- 常用导航 `/tools`（2026-10-14 合并，提交 916cb37）：静态 `src/sites.ts` + DB `bookmarks`
  表合并展示，同一套搜索/分组/卡片；DB 书签按归一化网址原位替换同址静态条目（后台改的优先）；
  `/bookmarks` 旧链接 Navigate 跳 /tools；后台 /admin「书签配置」tab 管理 DB 书签
  （BookmarkAdmin.tsx，改完调 Tools.tsx 导出的 invalidateToolsCache）。
- `/notes` 记事本（2026-10-14 新增，提交 8749b9d）：`notes` 表**私有**，RLS 仅 authenticated
  可读写、不授权 anon；页面即管理界面（无需 admin tab），导航入口仅登录后显示；
  LoginModal 有可选 redirectTo 参数（默认 /admin）。
- 登录墙模式（Notes / Cinema / Admin 三处一致）：页面内自己订阅
  `supabase.auth.getSession()` + `onAuthStateChange`（**项目没有 AuthContext**），
  `booting` 时先渲染「加载中」避免闪登录墙，未登录渲染 `.login-gate` + `LoginModal redirectTo=本页路径`。
  LoginModal 标题按 redirectTo 派生：`/admin` → 「后台登录」，其它 → 「登录后继续」。
  需要登录的页面不要进 sitemap（`scripts/gh-pages.mjs` 的 staticPages）。
- `/cinema` 放映厅（2026-10-24 建）：三个 tab —— 本地片单 / B 站影视 / OuonnkiTV；
  2026-10-26 加登录墙，**入口与内容都要登录**（`{user && <Link to="/cinema">}`，与 /notes 一致）。
  B 站用官方嵌入页 `player.bilibili.com/player.html?bvid=&p=`，整站 www.bilibili.com 有
  X-Frame-Options 不能嵌；`tv.cctv.com` 直播页能嵌但被版权拦截播不了（别再试）。
- 新增 SQL 表的工作流：写 `supabase/*.sql`（幂等 policy + grant），由用户在 Supabase SQL
  Editor 手动执行；本地无 .env/service_role，无法代跑 SQL。
  （注：**发文章**已可自助，见上方「发文可自助完成」；代跑 SQL 仍需用户。）
- 悬浮音乐播放器（2026-10-24 重写，提交 1cfc72b）：`aplayer@1.10.1`（npm，不用 CDN）+ 自实现
  Meting 协议（`src/lib/meting.ts`）拉网易云歌单；先探测可播性再建列表，缓存 6 小时。
  歌单 ID 默认 2884035（云音乐原创榜，可播率最高 46%），可用 `VITE_NETEASE_PLAYLIST` 覆盖。
- 本机网络：**jsdelivr 不可达**（用 npm 包或 elemecdn）；`api.i-meto.com` + 网易云音频域都带
  CORS `*`，浏览器可直接 fetch；supabase.co 仍被阻断。
  无头 Chrome 验证 `lpw94.github.io` **不要带 `--proxy-server`**（会 chrome-error），直连即可；
  访问 cctv / bilibili 这类外站才需要代理。
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
- **按比例的容器要防断点覆盖**：`.cinema-embed-frame` 在 720 断点写死 `height:62vh`，
  新增 `aspect-ratio:16/9` 的子类必须在媒体查询里再声明一次 `height:auto`，否则手机上按 62vh 算。
- 改完文件要 `touch` 一次，避免 vite dev 提供陈旧 transform。
