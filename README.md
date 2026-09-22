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
- 一键部署 **Vercel** 配置

## 目录结构
```
blog/
├─ index.html
├─ package.json
├─ vite.config.ts
├─ vercel.json            # Vercel 构建 + SPA fallback + rss/sitemap 路由
├─ .env.example          # 复制为 .env 后填入密钥
├─ supabase/
│  └─ schema.sql         # 建表 + RLS + 评论表 + 封面桶策略
├─ api/
│  ├─ rss.js             # 动态生成 RSS
│  └─ sitemap.js         # 动态生成站点地图
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
   VITE_SUPABASE_URL=https://xxxx.supabase.co
   VITE_SUPABASE_ANON_KEY=eyJ...
   VITE_SITE_URL=https://your-domain.com   # 用于 RSS/SEO/OG，部署后改成正式域名
   ```
4. 安装依赖并启动：
   ```bash
   npm install
   npm run dev
   ```
5. 访问 `/login` 用邮箱登录 → 跳转 `/admin` 写文章（可上传封面）；首页 `/` 查看已发布文章；文章页底部可发表评论。

## 部署到 Vercel（一键）
1. 推送代码到 GitHub 仓库。
2. 在 Vercel 导入该仓库，构建命令 `npm run build`、输出目录 `dist`（已写入 `vercel.json`，可自动识别）。
3. 在 Vercel **Environment Variables** 配置与 `.env` 相同的三个变量：
   - `VITE_SUPABASE_URL`、`VITE_SUPABASE_ANON_KEY`、`VITE_SITE_URL`（改成正式域名）。
4. 部署完成后：
   - `/rss.xml`、`/sitemap.xml` 由 `api/` 无服务器函数实时生成；
   - `vercel.json` 已配置 SPA fallback，深链 `/post/xxx` 可正常访问。

> 本地预览 `api/` 函数需用 `vercel dev`；纯 `npm run dev` 不会启动这些函数，属正常。

## 安全提示
- 后台写入、封面图上传统一依赖 Supabase RLS；anon key 本身公开安全。
- 正文用 react-markdown 渲染，**默认不解析原始 HTML**，避免 XSS；如需支持 HTML 片段请自行叠加 `rehype-raw` + DOMPurify。
- 评论对所有访客开放写入（个人博客常见做法），若担心垃圾评论，可在 `supabase/schema.sql` 把 `Public can insert comments` 改为 `to authenticated`，并要求登录后留言。
