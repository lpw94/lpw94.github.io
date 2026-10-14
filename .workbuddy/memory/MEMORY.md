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
- 构建命令用受管 node：`C:/Users/lpw94/.workbuddy/binaries/node/versions/22.22.2-6/npm run build`。

## 用户偏好
- 需求沟通用 @文件:行号 + @command://fix；代码改动最小化、保留已有逻辑不重构；
  按「数据库→类型→页面→路由→样式→构建→提交」分块推进，提交在 dev 分支（不主动推 main）。
