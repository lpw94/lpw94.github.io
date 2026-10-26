# 技术博文（可直接发布到博客）

本目录是为 `https://lpw94.github.io` 准备的技术博文，均为**纯 Markdown**（不使用 HTML），与博客的 `react-markdown + remark-gfm` 渲染完全兼容，表格、代码块都能正常显示。

正文里**没有 H1 标题**——标题由后台的「标题」字段提供，避免页面上出现重复标题。

## 文章清单

| 文件 | 建议标题 | 建议 slug | 分类 |
| --- | --- | --- | --- |
| `01-supabase-auth-storage-rls.md` | 用 Supabase 从零搭一个全栈应用：鉴权、存储与行级安全（RLS）实战 | `supabase-auth-storage-rls` | 数据库 |
| `02-react-performance.md` | React 18/19 性能优化实战：从重渲染定位到并发特性 | `react-performance-optimization` | 前端 |
| `03-vue3-composition-pinia.md` | Vue 3 组合式 API + Pinia 实战：逻辑复用与状态管理 | `vue3-composition-api-pinia` | 前端 |
| `04-react-vs-vue.md` | 2026 年 React 与 Vue 选型指南：从心智模型到工程实践 | `react-vs-vue-2026` | 前端 |
| `05-blog-build-log.md` | 从零搭建个人技术博客：React + Supabase + GitHub Pages 建站实录与 15 个坑 | `blog-build-log` | 前端 |
| `06-blog-tech-highlights.md` | 个人博客的技术要点与自定义功能拆解：RLS、构建时 Feeds 与登录弹窗 | `blog-tech-highlights` | 前端 |
| `07-blog-optimization-log.md` | 博客功能优化实录：后台图片自动清理、富文本对齐与编辑弹窗打磨 | `blog-optimization-log` | 前端 |
| `08-blog-interactive-features.md` | 博客互动化改造：3D 背景换肤、点击特效、桌面宠物与侧边栏小游戏 | `blog-interactive-features` | 前端 |
| `11-blog-seo-share-games.md` | 博客 SEO 与交互再打磨：RSS/Sitemap、社交分享卡片、2048 滑动动画 | `blog-seo-share-games` | 前端 |
| `12-plane-war-upgrade.md` | 博客小游戏升级：飞机大战的多机型敌机、变向子弹与道具系统 | `plane-war-upgrade` | 前端 |
| `13-blog-toolbox-bookmarks-games.md` | 博客一天升级实录：工具箱独立页、书签速记、双新游戏与移动端精简 | `blog-toolbox-bookmarks-games` | 前端 |
| `14-blog-notes-nav-and-fixed-pitfall.md` | 博客再升级实录：私有记事本、导航大合并，和一个 backdrop-filter 定位坑 | `blog-notes-nav-and-fixed-pitfall` | 前端 |
| `15-node-to-python-funeng-sync.md` | 从 Node 到 Python：重写一个水表数据同步脚本，并踩了 OpenCV 的 Python 3.13 大坑 | `node-to-python-funeng-sync` | 后端 |
| `16-dddocr-captcha-recognition.md` | Python 练手：用 ddddocr 写一个离线验证码识别小工具 | `ddddocr-captcha-recognition` | 后端 |
| `17-blog-lockscreen-and-background.md` | 博客锁屏与背景减负实录：算术题锁屏、空闲自动锁与静态渐变背景 | `blog-lockscreen-and-background` | 前端 |
| `18-python-import-variables.md` | Python 入门：引用另一个文件的变量，import 三种写法与常见坑 | `python-import-variables` | 后端 |
| `19-python-stdlib-four-libraries.md` | Python 常用库四件套：requests 网络请求、json 数据处理、datetime 与文件 IO 串讲 | `python-stdlib-four-libraries` | 后端 |
| `20-python-venv-conda.md` | Python 依赖隔离：venv 与 conda 怎么选，并动手建一个真实 venv | `python-venv-conda` | 后端 |
| `21-supervision-intro.md` | 计算机视觉工具库 supervision 入门：模型无关的可视化与三个版本 API 坑 | `supervision-intro` | 后端 |
| `22-fastapi-admin-api.md` | FastAPI 权限路由后端实战：四层架构、参数化鉴权与四个环境级踩坑 | `fastapi-admin-api` | 后端 |
| `23-admin-web-demo-permission-frontend.md` | 权限路由前端落地：手写请求拦截器、刷新锁与动态菜单路由的四个坑 | `admin-web-demo-permission-frontend` | 前端 |
| `24-blog-mobile-optimization.md` | 手机端体验优化实录：顶栏压行、字号收敛，和一次差点被 Chrome 骗到的调试 | `blog-mobile-optimization` | 前端 |
| `25-admin-permission-menu-grant.md` | 授权 = 勾菜单：权限模型的最后一环，以及 Alembic 迁移与删除保护实战 | `admin-permission-menu-grant` | 后端 |
| `26-sensitive-config-externalization.md` | 敏感配置外置实战：公开仓库里的一次完整凭据治理，含历史重写与自查脚本 | `sensitive-config-externalization` | 后端 |
| `27-meter-data-excel-export.md` | 水表取数与 Excel 导出实战：五个接口契约陷阱，和一份报表该有哪些列 | `meter-data-excel-export` | 后端 |

> `05` / `06` / `07` / `08` 是本博客**自身**的建站与技术拆解（含真实踩坑），属于"项目自述"型文章，与其他四篇的通用教程定位不同。

> 另有一篇未编号草稿 `python-project-driven-learning.md`（`前端工程师如何项目驱动学 Python`），是「项目驱动学 Python」系列的方法论总纲，可作为本篇的"前传"。

> 分类取值需为：`frontend`（前端）/ `backend`（后端）/ `database`（数据库）/ `industry`（行业）/ `other`（其他）。

## 发布步骤

1. 打开 `https://lpw94.github.io/admin`，登录后点 **添加文章**。
2. **标题**：填上表「建议标题」。
3. **slug**：填上表「建议 slug」（英文路径，可自定义）。
4. **分类**：按上表选择。
5. **正文**：点编辑器右上角切到 **纯文本** 模式，把对应 `.md` 文件的**全部内容**粘贴进去（不要粘贴表格里的「建议标题」那一行）。
6. **状态**：选 **发布**。
7. 点 **保存**。首页/列表即出现该文章。

> 若需要让 RSS / sitemap 包含新文章，发布后需再触发一次部署（任意一次 `git push`，或手动重跑 GitHub Actions）。

## 备注

- 文中的代码示例为通用写法，可按实际项目自行增删。
- 内容基于 React 18/19、Vue 3、Supabase 现行版本撰写；随版本演进可再迭代。
