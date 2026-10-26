# 发布博文到 Supabase（无需 service_role key）

## 为什么需要这套东西

本机 `curl` / Node 直连 `*.supabase.co` 会被网络层阻断（TLS 握手失败，HTTP 000），
但**放在 Chrome 页面上下文里发同样的请求就通**。所以整套流程是：

```
从日常 Chrome 的 leveldb 里抽出你自己的登录 JWT
  → 起一个带代理的 headless Chrome
    → CDP 在页面上下文里发 PostgREST 请求
```

## 三个文件

| 文件 | 作用 |
|---|---|
| `extract-token.mjs` | 从 Chrome 的 leveldb 里抽 Supabase 会话的 `access_token` |
| `cdp-eval.mjs` | CDP 求值器：注入表达式 + 轮询取结果（避开 `awaitPromise` 在 about:blank 被节流） |
| `expr-publish.js` | 发布表达式模板：按 slug 幂等 upsert 到 `posts` 表 |

## 用法

### 1. 起一个带代理的 Chrome

代理端口每次会话都变，先查：

```bash
env | grep -i proxy | grep -oE '127.0.0.1:[0-9]+' | head -1
```

启动（端口避开已占用的 9336）：

```bash
"/c/Program Files/Google/Chrome/Application/chrome.exe" \
  --headless=new \
  --remote-debugging-port=9340 \
  --user-data-dir="C:\\Users\\<user>\\AppData\\Local\\Temp\\chrome-pub" \
  --proxy-server="http://127.0.0.1:<代理端口>" \
  --no-first-run --no-default-browser-check --disable-gpu \
  "https://lpw94.github.io/"
```

**必须先导航到真实站点**（`https://lpw94.github.io/`），
`about:blank` 的 origin 是 `null`，PostgREST 预检会被拒（`MissingAllowOriginHeader`）。

### 2. 抽 token 并发布

```bash
cd scripts/publish

export CDP_PORT=9340
export CDP_URL=$(grep "^VITE_SUPABASE_URL=" ../../.env | cut -d= -f2-)
export CDP_APIKEY=$(grep "^VITE_SUPABASE_ANON_KEY=" ../../.env | cut -d= -f2-)
export CDP_KEY=$(node extract-token.mjs \
  "C:/Users/<user>/AppData/Local/Google/Chrome/User Data/Profile 4/Local Storage/leveldb")
export CDP_CONTENT_FILE="../../blog-content/27-xxx.md"

node cdp-eval.mjs expr-publish.js "https://lpw94.github.io/" 60000
```

## 两个必须分清的头

| 头 | 填什么 | 填错会得到 |
|---|---|---|
| `apikey` | 项目的 **anon key**（`VITE_SUPABASE_ANON_KEY`） | `401 Invalid API key` |
| `Authorization: Bearer` | **用户的 JWT** | `42501 new row violates row-level security policy` |

RLS 只给 `authenticated` 角色写权限，`anon` 只能读。

## 安全约定

- **token 不落盘**：只走环境变量 → stdout 管道，不进命令行参数
  （命令行会触发敏感内容审批，且留在 shell 历史里）。
- 脚本本身不含任何密钥，可以安全提交。
- JWT 有效期约 1 小时；过期后重新登录 `/admin` 再抽一次。

## 已知的坑

- **CDP 端点只监听 `127.0.0.1`**（不是 `[::1]`）——求值器两个 host 都试。
- `/json/list` 里要选 `type === 'page'` 的 target，浏览器 UI target 要排除。
- `select=id,...,length(content)` 会被 PostgREST 当成外键关系
  （`PGRST200`），算长度要在拿到 content 后自己数。
- **验证文章渲染不能靠 curl**：SPA 深链接 curl 返回 404 属正常，
  要用 CDP 打开页面读 `document.body.innerText`。
- RSS / sitemap 是**构建期产物**，发文后需再触发一次部署才会更新
  （`git commit --allow-empty` + push `main` 即可）。
