---
title: 你好，世界 —— 我的个人网站上线了
date: 2026-09-16
tags: [随笔, 建站]
summary: 用 React + Vite 搭建个人网站，记录技术博客、简历与自定义页面的完整过程。
---

# 你好，世界

这是我的第一篇博客，用来记录这个个人网站是如何搭建起来的。

## 技术选型

- **Vite + React + TypeScript**：构建快、开发体验好
- **Tailwind CSS**：快速写出整洁的样式
- **React Router（Hash 模式）**：完美适配 GitHub Pages，避免子路径刷新 404
- **Markdown**：博客和自定义页面都用 `.md` 文件维护，零后端

## 博客怎么写？

在 `src/content/posts/` 下新建一个 `.md` 文件，加上 frontmatter：

```md
---
title: 文章标题
date: 2026-09-16
tags: [React, 前端]
summary: 一句话摘要
---

正文用 Markdown 书写……
```

构建时这些文件会被自动打包进站点，无需任何数据库。

> 小而美的个人站点，从今天开始持续更新。
