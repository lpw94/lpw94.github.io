> 这篇文章记录我从零搭一个个人技术博客的完整过程：技术选型、建站步骤，以及一路踩过的 15 个坑。所有问题都附带"现象 / 原因 / 解决"，可以直接当排错手册用。线上地址：https://lpw94.github.io

## 一、为什么是这套栈

需求很朴素：能写文章、能传封面图、有评论、能被搜索引擎和 RSS 收录、**尽量不花钱**。

| 需求 | 选型 | 理由 |
|---|---|---|
| 前端 | React 18 + Vite + TypeScript | 熟悉、类型安全、构建快 |
| 数据库 / 鉴权 / 存储 | Supabase | 免费 Postgres 500MB + Storage 1GB + Auth + RLS，免运维 |
| 托管 | GitHub Pages | 免费、和仓库天然打通、纯静态博客足够 |
| 正文渲染 | react-markdown + remark-gfm | 支持表格、代码块，且默认不解析原始 HTML（更安全） |
| SEO | react-helmet-async | 按文章动态注入 title / description / OG / canonical |

整体架构非常薄：**前端直连 Supabase（靠 RLS 控权限），构建产物丢给 GitHub Pages**。没有自建服务端，也就没有服务器要维护。

## 二、建站步骤

### 1. 初始化项目

```bash
npm create vite@latest blog -- --template react-ts
cd blog
npm i @supabase/supabase-js react-router-dom react-markdown remark-gfm react-helmet-async
```

### 2. 建 Supabase 项目并执行 schema

在 Supabase 后台新建项目，打开 **SQL Editor** 执行项目里的 `supabase/schema.sql`。它一次性做完四件事：

- 建 `posts` 表（slug / title / content / cover_url / category / status / 时间戳）
- 建 `comments` 表（评论）
- 建 Storage 公开桶 `covers`（封面图）
- 开启 RLS 并写入策略

> 关键设计：整个脚本写成**幂等**的（`create table if not exists`、`drop policy if exists` 后再 `create policy`），所以可以反复执行，不会报"已存在"。

### 3. 配置环境变量

本地 `.env` 与线上仓库 Secrets 用同一套：

```
VITE_SUPABASE_URL=https://<你的项目>.supabase.co
VITE_SUPABASE_ANON_KEY=<anon key>
VITE_SITE_URL=https://lpw94.github.io
```

`VITE_SITE_URL` 是我后来补上的——它专门用来生成登录回跳、RSS、canonical 的绝对地址（原因见踩坑第 10 条）。

### 4. 路由与页面

| 路由 | 页面 | 说明 |
|---|---|---|
| `/` | `Home.tsx` | 文章列表 + 分类筛选 |
| `/post/:slug` | `PostDetail.tsx` | Markdown/HTML 渲染 + 评论 + SEO |
| `/admin` | `Admin.tsx` | 后台发稿、封面上传（未登录自动弹登录窗） |
| `/reset-password` | `ResetPassword.tsx` | 邮件重置密码落地页 |
| `/about` | `About.tsx` | 简历页 |

### 5. 构建后处理脚本

`scripts/gh-pages.mjs` 在 `vite build` 之后跑，做两件事：

- 把 `dist/index.html` 复制成 `dist/404.html`，解决 SPA 深链刷新 404；
- 从 Supabase 拉已发布文章，生成静态 `dist/rss.xml` 与 `dist/sitemap.xml`。

它是 **best-effort** 的：缺环境变量或拉取失败只告警、不阻断部署。

### 6. GitHub Actions 工作流

`.github/workflows/deploy.yml`：`push main` → 安装依赖 → `npm run build`（注入三个 Secrets）→ 上传 `dist` → `deploy-pages` 发布。

### 7. 上线检查清单

- [ ] 仓库名是 `lpw94.github.io`（用户页才能发布在根路径）
- [ ] `Settings → Pages → Source` 选了 **GitHub Actions**
- [ ] 三个 Secrets 都配了（名字带 `VITE_` 前缀）
- [ ] `github-pages` environment 未限制分支
- [ ] Supabase 的 Redirect URLs 白名单包含线上域名

## 三、踩过的 15 个坑

### A. 数据库 / SQL 层

**1. `unterminated dollar-quoted string`（插入示例数据失败）**

- 现象：把 SQL 粘进 Editor 执行，报美元引号未闭合。
- 原因：文章正文里既有单引号换行，又有 Markdown 的三反引号代码块，SQL Editor 会在反引号处被截断。
- 解决：正文整体用 `$$ ... $$` 美元引号包裹（不用单引号），并且**正文里的代码块改成 4 空格缩进**，不出现反引号。

**2. `23514 posts_category_check`（新增文章被约束拒绝）**

- 现象：后台保存文章报 `violates check constraint "posts_category_check"`。
- 原因：表是早期创建的，当时约束里允许的分类集合不完整；而 `create table if not exists` **遇到表已存在就整段跳过**，约束永远停在旧版本。
- 解决：按正确顺序改约束——**先删旧约束，再规范历史数据，最后加新约束**：

```sql
alter table posts drop constraint if exists posts_category_check;

update posts set category = 'other'
where category not in ('frontend','backend','database','industry','other');

alter table posts add constraint posts_category_check
  check (category in ('frontend','backend','database','industry','other'));
```

> 顺序千万别反：如果先 UPDATE，而旧约束恰好不含 `'other'`，UPDATE 自己就会被旧约束拦下。
>
> 我还把这段 `drop/add` 固化回了 `schema.sql`，以后手跑脚本会自动纠正这类残留约束。

### B. 构建 / 部署层

**3. `TS6310: Referenced project may not disable emit`（构建失败）**

- 原因：`tsconfig.node.json` 被 `tsconfig.json` 以 project references 方式引用，而 composite 项目**不允许 `noEmit`**。
- 解决：去掉 `noEmit`，改为把产物重定向到临时目录：

```json
{
  "compilerOptions": {
    "composite": true,
    "outDir": "./node_modules/.tmp/tsconfig.node",
    "tsBuildInfoFile": "./node_modules/.tmp/tsconfig.node.tsbuildinfo"
  }
}
```

**4. `HttpError: Not Found` + `Ensure GitHub Pages has been enabled`**

- 原因：仓库没以 Actions 方式启用 Pages。
- 解决：`Settings → Pages → Source` 选 **GitHub Actions**，然后 Re-run。

**5. `Branch "main" is not allowed to deploy to github-pages due to environment protection rules`**

- 原因：`github-pages` environment 限制了可部署分支。
- 解决：`Settings → Environments → github-pages → Deployment branches and tags` 改为 **No restriction**。

**6. 页面能开，但接口打到 `https://placeholder.supabase.co`（`ERR_NAME_NOT_RESOLVED`）**

- 原因：仓库 Secrets 为空，构建时落到代码里的兜底占位符。
- 解决：补全 Secrets **并 Re-run**——`VITE_` 变量是**构建时内联**的，改完必须重新构建才生效。

**7. 页面白屏、静态资源 404**

- 原因：仓库名与 Vite 的 `base` 不匹配。用户页（仓库名 = `<用户名>.github.io`）部署在**根路径**，`base` 必须是 `'/'`。

**8. `git push` 被 rejected**

- 原因：远端历史与本地冲突（早期操作留下的分叉）。
- 解决：确认没有其他人协作后 `git push --force`。

**9. TortoiseGit 弹 `publickey` 认证失败**

- 原因：Git 客户端在用 PuTTY 的 Plink，而不是 OpenSSH，密钥格式/agent 不认。
- 解决：把 Git 的 SSH 客户端切回 OpenSSH（注册表 `SSHClient` 指向 Git 自带的 `ssh.exe`），remote 改成 `git@github.com:...`，用 `ssh -T git@github.com` 验证通过。

### C. 认证层

**10. 魔法链接点开跳回了 `http://localhost:3000`**

- 现象：线上点邮箱链接，回跳地址却是 localhost。
- 原因：代码用 `window.location.origin` 拼回跳地址；这条链接是在**本地 dev**（localhost:3000）时生成的，于是把 localhost 写进了链接。
- 解决：改读构建时注入的站点地址，**无论在哪生成，回跳恒为生产域名**：

```ts
const SITE_URL = (import.meta.env.VITE_SITE_URL as string) || window.location.origin
// ...
options: { emailRedirectTo: `${SITE_URL}/admin` }
```

**11. 点魔法链接时 `/auth/v1/verify` 直接拒绝**

- 原因：`redirect_to` 的目标域名不在 Supabase 的**允许回跳白名单**里。
- 解决：`Authentication → URL Configuration`，**Redirect URLs** 增加 `https://lpw94.github.io/**`，**Site URL** 设为 `https://lpw94.github.io`。纯后台配置，改完立即生效，不用重新部署。

**12. `email rate limit exceeded`**

- 原因：同一邮箱短时间内发送多封（魔法链接 + 重置密码），撞上按邮箱计的发信频率上限。
- 解决：① 等窗口重置（约一小时）；② 后台 `Authentication → Rate Limits` 调高上限；③ 急着用时直接用 SQL 写密码，绕过邮件：

```sql
update auth.users
set encrypted_password = crypt('你的新密码', gen_salt('bf'))
where email = 'you@example.com';
```

### D. 网络传输层

**13. `net::ERR_QUIC_PROTOCOL_ERR`（上传封面图失败）**

- 现象：图片上传请求直接失败，且**没有任何 HTTP 状态码**。
- 原因：`supabase.co` 通告支持 HTTP/3，Chrome 优先走 QUIC（UDP 443）；一旦网络/VPN/代理屏蔽了 UDP 443，QUIC 握手被重置。**与代码、权限都无关**。
- 解决：`chrome://flags/#enable-quic` 设为 **Disabled**，完全重启 Chrome。或者换个网络/浏览器验证。

**14. `net::ERR_CONNECTION_RESET`（密码登录接口失败）**

- 原因：同样是传输层——到 Supabase 的 TCP 连接被中途重置（VPN、公司网、扩展拦截、偶发抖动）。
- 解决（按序试）：确认 QUIC 关干净并重启浏览器 → 关 VPN / 换热点 → 无痕窗口排除扩展 → 重试几次。DevTools 里看那条失败请求的 **Protocol** 是 `h3` 还是 `tcp`，能快速判断方向。

### E. 数据展示层

**15. 文章时间"都是上午"**

- 现象：列表里的发布时间总比实际早几个小时，且集中在上午。
- 原因：`timestamptz` 经 PostgREST 返回的是 **UTC 的 ISO 字符串**（如 `2026-09-22T01:03:51+00:00`），代码直接 `slice(0, 16)` 截出来的就是 UTC，比北京时间早 8 小时。
- 解决：统一走时间格式化工具，按**本地时区**输出：

```ts
const pad = (n: number) => String(n).padStart(2, '0')
const d = new Date(iso)
`${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
```

> 注意：SEO 的 `article:published_time` 要保留原始 ISO，搜索引擎需要标准格式，不能换成本地串。

## 四、复盘：四条值得记住的原则

1. **幂等优先。** SQL 脚本、构建脚本都要能重复执行不炸——`if not exists`、`drop ... if exists` 是廉价的保险。
2. **构建时内联的环境变量，改了必须重新构建。** 只改 Secrets 不 Re-run，线上还是老值。
3. **报错先分层，别急着改代码。** 数据层（约束/SQL 语法）、构建层（TS/Actions）、认证层（白名单/限流）、传输层（QUIC/重置）、展示层（时区）——15 个坑里有 5 个根本不在代码里。
4. **选静态托管，就要接受"构建时生成"。** RSS 和 sitemap 不是实时接口，新发文章要重新部署才会更新。

---

*示例仓库结构、完整 `schema.sql` 与部署排查表见项目 README。*
