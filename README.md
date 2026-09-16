# 吴八哥的个人网站

基于 **React + Vite + TypeScript + Tailwind CSS** 的纯静态个人站点，部署在 GitHub Pages（`lpw94.github.io`）。

## 功能

- 🏠 首页：个人介绍 + 最新文章
- 📝 技术博客：Markdown 驱动，在 `src/content/posts/` 下新增 `.md` 即可发布
- 📄 自定义页面：在 `src/content/pages/` 下新增 `.md`，访问 `/#/p/<文件名>`
- 📋 简历页：`src/pages/Resume.tsx`，结构化展示技能/经历/教育

## 本地开发

```bash
npm install
npm run dev        # 本地预览 http://localhost:5173
npm run build      # 构建到 dist/
npm run preview    # 预览构建产物
```

## 发布新文章

1. 在 `src/content/posts/` 新建 `my-post.md`：

   ```md
   ---
   title: 标题
   date: 2026-09-16
   tags: [React]
   summary: 摘要
   ---

   正文……
   ```

2. 提交并推送到 `main` 分支，GitHub Actions 会自动构建并发布到 `master`。

## 部署说明

- 源码分支：`main`
- 站点分支：`master`（GitHub Pages 用户页只能发布 master/main）
- 路由使用 HashRouter，无需服务端 fallback，直接访问子路径不会 404
- 也可本地发布：`npm run build && npm run deploy`（依赖 `gh-pages`）
