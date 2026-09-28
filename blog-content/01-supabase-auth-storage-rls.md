Supabase 常被称作「开源的 Firebase」，但它真正的底子是一套完整的 Postgres，外加鉴权、对象存储和实时订阅。对个人项目和小团队来说，它在免费额度内就能撑起一个带登录、带图片上传、带权限控制的全栈应用。这篇文章不讲概念，直接按「鉴权 → 存储 → 数据与行级安全（RLS）」三条线，把踩过的坑和对应的正确写法一次讲清楚。

## 为什么是 Supabase

- **一个 Postgres 数据库**：不是封装过的私有格式，你可以直接用 SQL、建索引、写约束、开扩展。
- **内置 Auth**：邮箱魔法链接、密码登录、OAuth、手机号一应俱全，不用自己写发信和校验。
- **对象存储 Storage**：图片、附件直接传，配合 RLS 做权限。
- **行级安全 RLS**：把权限规则写在数据库层，前端即使拿着匿名 key 也无法越权读写。
- **免费额度够个人用**：数据库约 500MB、存储约 1GB，写博客、做 demo 完全足够。

## 一、环境准备

在 Supabase 新建项目后，进入 **Project Settings → API**，拿到两个值：`Project URL` 和 `anon public key`。前端用 Vite 时放进 `.env`：

```
VITE_SUPABASE_URL=https://xxxxxxxxxxxx.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOi...
```

> 只有带 `VITE_` 前缀的变量才会被注入浏览器 —— 这既是便利也是警告：**它们会公开**。所以这里只能放 anon key，**绝不能放 service_role key**（它绕过一切 RLS，等于把整库交出去）。

初始化客户端时有个小细节：Dashboard 上提供的地址有时会带 `/rest/v1` 之类后缀，直接拼接口会 404，最好统一裁掉：

```ts
import { createClient } from '@supabase/supabase-js'

const rawUrl = import.meta.env.VITE_SUPABASE_URL as string
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string

const normalizedUrl = rawUrl
  .trim()
  .replace(/\/(rest|auth|storage|realtime)\/v1\/?$/, '')
  .replace(/\/+$/, '')

export const supabase = createClient(normalizedUrl, anonKey)
```

## 二、鉴权 Auth：魔法链接与密码登录并存

最小实现是邮箱魔法链接，一行搞定：

```ts
await supabase.auth.signInWithOtp({
  email,
  options: { emailRedirectTo: `${SITE_URL}/admin` },
})
```

**这里有个必踩的坑**：`emailRedirectTo` 如果用 `window.location.origin`，你在本地 `npm run dev` 时生成的链接回跳地址会是 `http://localhost:3000`，点了就弹回本地，线上根本登不进去。正确做法是**恒用生产域名**：

```ts
const SITE_URL = (import.meta.env.VITE_SITE_URL as string) || window.location.origin
```

第二个坑在后台：**Supabase → Authentication → URL Configuration** 里，必须把线上地址加进 **Redirect URLs** 白名单（如 `https://your-domain.com/**`），并把 **Site URL** 设为正式域名。否则点链接时 `/auth/v1/verify` 会直接拒绝，报 `redirect_to URL is not allowed`，登录永远卡住。

密码登录同样简单，成功后靠事件通知刷新界面即可：

```ts
const { error } = await supabase.auth.signInWithPassword({ email, password })
```

会话状态建议用 `onAuthStateChange` 订阅，而不是只查一次 `getSession()`：

```ts
supabase.auth.onAuthStateChange((_event, session) => {
  setUser(session?.user ?? null)
})
```

因为魔法链接回调时，URL 里的 token 是**异步解析**的，只查一次会误判为未登录。

## 三、存储 Storage：上传图片的正确姿势

先建一个 public 桶（或用 SQL 建），然后上传：

```ts
const { error } = await supabase.storage.from('covers').upload(path, file)
```

**关键：不要把原始文件名拼进路径。** 中文、空格、`#`、`?` 都会让对象 key 非法，Storage 直接以 `Invalid key` 拒绝。统一改成「时间戳 + 随机串 + 扩展名」：

```ts
const ext = (file.name.split('.').pop() || 'png').toLowerCase().replace(/[^a-z0-9]/g, '')
const path = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`
```

上传成功后拿公开地址：

```ts
const { data } = supabase.storage.from('covers').getPublicUrl(path)
// data.publicUrl 形如 .../object/public/covers/<file>
```

如果上传报 `net::ERR_QUIC_PROTOCOL_ERR`，那不是权限问题，而是浏览器走 HTTP/3(QUIC) 被网络/VPN 拦了 —— 在 `chrome://flags/#enable-quic` 里把 QUIC 设为 Disabled，重启浏览器即可。

## 四、数据与 RLS：把权限写进数据库

建表时开 RLS，然后为「游客只读已发布、登录用户可管理」分别写策略：

```sql
alter table posts enable row level security;

create policy "Public can read published posts"
  on posts for select
  using (status = 'published');

create policy "Authenticated users can manage posts"
  on posts for all
  to authenticated
  using (true)
  with check (true);
```

这样做的好处是：前端哪怕被篡改，也无法读到草稿或删别人的数据 —— 权限在数据库层兜底。

**另一个高频坑：CHECK 约束没跟上代码。** 比如分类列早期只允许 5 个值中的一个子集，后来前端加了新分类，插入时报：

```
23514: new row for relation "posts" violates check constraint "posts_category_check"
```

原因是建表语句用了 `create table if not exists`，表已存在就整段跳过，**旧约束不会被更新**。修正时注意顺序 —— 必须先删约束，再改数据，最后加回：

```sql
alter table posts drop constraint if exists posts_category_check;

update posts set category = 'other'
where category not in ('frontend', 'backend', 'database', 'industry', 'other');

alter table posts add constraint posts_category_check
  check (category in ('frontend', 'backend', 'database', 'industry', 'other'));
```

如果先 `update` 再删约束，那条 update 自己就会撞上旧约束报 23514。

## 五、避坑速查表

| 现象 | 真正原因 | 处理 |
| --- | --- | --- |
| 点魔法链接弹回 localhost | `emailRedirectTo` 用了当前 origin | 改用固定的 `VITE_SITE_URL` |
| `redirect_to URL is not allowed` | 白名单没配 | Authentication → URL Configuration 加 `域名/**` |
| `email rate limit exceeded` | 短时间给同一邮箱发信过多 | 等一小时，或直接 SQL 设密码 |
| 上传 `Invalid key` | 路径含中文/空格/特殊字符 | 用时间戳+随机串命名 |
| 上传 `ERR_QUIC_PROTOCOL_ERR` | 浏览器 QUIC 被拦 | 关闭 `chrome://flags/#enable-quic` |
| 插入报 23514 | 旧 CHECK 约束未更新 | drop → update → add |
| 列表时间差 8 小时 | 直接截取 UTC 字符串 | 用 `new Date(iso)` 转本地时区 |

## 小结

Supabase 的价值在于**把后端能力收敛到一套 SQL 语义里**：鉴权交给 Auth、文件交给 Storage、权限交给 RLS，前端只管调用。真正需要提前想清楚的只有两件事 —— **哪些变量会公开**（只有 anon key 能进前端）、**哪些权限该由数据库兜底**（能写 RLS 就别只靠前端判断）。把这两点守住，个人项目到小团队产品都能跑得很稳。
