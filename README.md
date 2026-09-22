# React 个人博客（Supabase 后端）

基于 **Vite + React + TypeScript + Supabase** 的极简个人博客，开箱即用、可一键部署。

## 功能
- 文章列表 / 详情页（公开只读已发布文章）
- Supabase Auth 邮箱魔法链接登录（无密码）
- 后台发稿（草稿 / 发布），写入受 RLS 保护
- **Markdown 正文渲染**（react-markdown + remark-gfm，默认禁用原始 HTML，更安全）
- **封面图上传**到 Supabase Storage 公开桶 `covers`
- **评论**：读者无需登录即可留言（昵称 + 内容）
- **SEO**：每篇文章动态注入 title / description / OG / canonical（react-helmet-async）
- **RSS 订阅**（`/rss.xml`）与 **Sitemap**（`/sitemap.xml`）、`robots.txt`
- 一键部署 **GitHub Pages** 配置（GitHub Actions）

## 目录结构
```
blog/
├─ index.html
├─ package.json
├─ vite.config.ts        # base: '/'，适配 GitHub Pages 用户页根路径
├─ .env.example          # 复制为 .env 后填入密钥
├─ supabase/
│  ├─ schema.sql         # 建表 + RLS + 评论表 + 封面桶策略
│  └─ seed.sql           # 2 篇示例文章（$$ 美元引号，避免反引号截断）
├─ scripts/
│  └─ gh-pages.mjs       # 构建后：生成 dist/404.html(SPA fallback) + rss.xml/sitemap.xml
├─ .github/workflows/
│  └─ deploy.yml         # GitHub Actions 构建并部署到 Pages
├─ public/
│  └─ robots.txt
└─ src/
   ├─ main.tsx           # HelmetProvider 入口
   ├─ App.tsx            # 路由 + 站点级 meta
   ├─ lib/supabase.ts    # Supabase 客户端
   ├─ types.ts           # Post / Comment 类型
   ├─ components/
   │  ├─ Layout.tsx
   │  └─ PostCard.tsx
   ├─ pages/
   │  ├─ Home.tsx        # 文章列表
   │  ├─ PostDetail.tsx  # 详情 + Markdown + 评论 + SEO
   │  ├─ Login.tsx       # 邮箱登录
   │  └─ Admin.tsx       # 后台发稿（含封面上传）
   └─ styles/index.css
```

## 快速开始
1. 在 https://supabase.com 新建项目。
2. 打开 Supabase **SQL Editor**，执行 `supabase/schema.sql` 建表、开 RLS、建封面桶及策略。
3. 复制 `.env.example` 为 `.env`，填入配置：
   ```
   VITE_SUPABASE_URL=https://grinllviahukzgbxvmhz.supabase.co
   VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdyaW5sbHZpYWh1a3pnYnh2bWh6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODk1Mzc4NzgsImV4cCI6MjEwNTExMzg3OH0.M1toGO1pE3NJErblxhNLkK6p2bzfKapRUzyaxvWy5Uk
   VITE_SITE_URL=https://lpw94.github.io   # 用于 RSS/SEO/OG，GitHub Pages 用户页地址
   ```
4. 安装依赖并启动：
   ```bash
   npm install
   npm run dev
   ```
5. 访问 `/login` 用邮箱登录 → 跳转 `/admin` 写文章（可上传封面）；首页 `/` 查看已发布文章；文章页底部可发表评论。

## 部署到 GitHub Pages（一键）
目标地址：`https://lpw94.github.io/`（GitHub Pages **用户页**，部署在站点根路径）。

1. 在 GitHub 新建仓库 **`lpw94.github.io`**（仓库名必须与用户名一致，用户页才会发布到根路径）。
2. 仓库 **Settings → Secrets and variables → Actions → New repository secret**，添加 3 个密钥（与 `.env` 一致）：
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`
   - `VITE_SITE_URL` = `https://lpw94.github.io`
3. 仓库 **Settings → Pages → Build and deployment → Source** 选择 **GitHub Actions**。
4. 把代码推送到 `main` 分支，Actions 会自动构建并部署；首次部署完需在 Pages 设置里确认站点已发布。
   ```bash
   git add .
   git commit -m "deploy blog"
   git push origin main
   ```

### 部署原理与注意
- **纯静态托管**：GitHub Pages 不能运行服务端函数，因此 RSS/Sitemap 改为**构建时生成**——`scripts/gh-pages.mjs` 在 `vite build` 后从 Supabase 拉已发布文章，写出静态 `dist/rss.xml` / `dist/sitemap.xml`（best-effort，拉取失败不阻断部署）。
- **SPA 路由**：脚本同时把 `dist/index.html` 复制为 `dist/404.html`，解决 GitHub Pages 上刷新 `/post/xxx` 返回 404 的问题，深链可正常访问。
- **环境变量**：`VITE_` 前缀变量在构建时内联进前端，必须通过仓库 Secrets 提供（不要写进前端可见的明文，anon key 本身公开安全但仍建议走 Secrets）。
- 免费数据库闲置 1 周会被 Supabase 暂停，届时列表/详情会拉不到数据，登录 Supabase 控制台恢复即可。

### 常见部署故障排查

| 现象 | 原因 | 解决 |
|------|------|------|
| `deploy` 报 `HttpError: Not Found` + `Ensure GitHub Pages has been enabled` | 仓库未以 Actions 方式开启 Pages | `Settings → Pages → Source` 选 **GitHub Actions**，再 Re-run |
| `deploy` 报 `Branch "main" is not allowed to deploy to github-pages due to environment protection rules` | `github-pages` environment 限制了部署分支 | `Settings → Environments → github-pages → Deployment branches and tags` 改为 **No restriction**，再 Re-run |
| 页面能打开，但列表请求打到 `https://placeholder.supabase.co/...`（`ERR_NAME_NOT_RESOLVED`） | 仓库 Secrets 未配置，或名称少了 `VITE_` 前缀；构建落到代码兜底占位符 | 按上面第 2 步补全 3 个 Secrets，**必须 Re-run 重新构建**（`VITE_` 变量在构建时内联） |
| 页面白屏、控制台资源 404 | 仓库名与 `base` 不匹配（用户页须叫 `lpw94.github.io` 且 `base: '/'`） | 核对仓库名与 `vite.config.ts` 的 `base` 是否对应 |

> `Node 20 is deprecated`、`punycode`、`ubuntu-latest → 26` 均为无害告警，不影响部署。

## 安全提示
- 后台写入、封面图上传统一依赖 Supabase RLS；anon key 本身公开安全。
- 正文用 react-markdown 渲染，**默认不解析原始 HTML**，避免 XSS；如需支持 HTML 片段请自行叠加 `rehype-raw` + DOMPurify。
- 评论对所有访客开放写入（个人博客常见做法），若担心垃圾评论，可在 `supabase/schema.sql` 把 `Public can insert comments` 改为 `to authenticated`，并要求登录后留言。
