上一篇把 FastAPI 后端搭完了，权限模型、四层架构、双令牌都跑通了。但那篇最后留了个问题：**前端到底怎么接**？

这篇就补上这一段。做法是新建一个独立的前端工程 `admin-web-demo`，完整演示「登录 → 权限码 → 动态菜单路由 → 按钮级权限」这条链路。

## 先说为什么是独立工程

我手上本来有个真实的 admin-web 项目（UmiJS Max + antd Pro）。第一反应是直接改它，把拦截器逻辑搬进去。

但很快否掉了——**那是公司在跑的项目，不该为了学 Python 往里塞演示代码**。改一个真实业务系统的登录链路，风险和收益完全不对等。

于是换了个思路：不动它，另起一个**结构对标它的替身**。这样有两个好处：

- 真实项目零风险，改错了删掉就行；
- 能对照着看——同样的概念在 Umi 里和在 react-router 里分别长什么样。

技术栈刻意选了 React 18 + Vite + antd 5 + react-router-dom 6，都是熟的东西，学习成本全在「权限模型怎么落地」这一件事上。

## 对标关系：两套技术栈，同一个概念

| admin-web（UmiJS Max） | admin-web-demo（react-router） |
| --- | --- |
| `umi-request` + `extend()` 拦截器 | 手写 `fetch` 封装 |
| `getInitialState()` 拉登录态 | `AuthProvider` Context |
| `access.ts` 的 `insideAccess()` | `usePermission()` Hook |
| `patchClientRoutes()` 运行时改路由 | `useMemo` 动态生成 `<Route>` |
| `patchRoutes` + `routesMap.tsx`（48KB） | `COMPONENT_MAP` 映射表（6 行） |

最后一行差距最大。真实项目的 `routesMap.tsx` 有 48000 字符，那是长期迭代堆出来的；demo 里只要 6 行。**这恰好说明权限路由的本质很简单，难的是长期维护**。

## 请求层：把拦截器手写一遍

umi-request 的 `extend()` 封装好了 401 处理，但**封装掉的东西正是要学的**。所以用原生 fetch 手写一遍：

```ts
interface RequestOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE';
  body?: unknown;
  /** 内部用：标记这是刷新令牌后重放的请求，避免无限递归 */
  _retried?: boolean;
  /** 内部用：刷新请求本身不能再触发刷新 */
  _skipAuth?: boolean;
}
```

两个下划线开头的字段是整个逻辑的关键。它们不是业务参数，是**递归终止条件**——因为「401 → 刷新 → 重放 → 又 401 → 再刷新」这个链条如果没有终止标记，会无限循环。

```ts
if (!res.ok) {
  if (res.status === 401 && !_skipAuth && !_retried) {
    const ok = await refreshTokens();
    if (ok) return rawRequest<T>(url, { ...options, _retried: true });
    clearTokens();
    message.error('登录已过期，请重新登录');
    window.location.replace('/login');
    throw new ApiError(401, '登录已过期');
  }
  const detail = (data as ApiErrorBody | null)?.detail;
  throw new ApiError(res.status, detail || `请求失败（HTTP ${res.status}）`);
}
```

三个条件缺一不可：`_skipAuth` 挡住刷新请求自己递归，`_retried` 挡住重放后再次递归，`_skipAuth` 也让登录接口（还没令牌）走同一条错误处理路径。

### 一个真实的并发坑：刷新锁

页面初始化往往并发发好几个请求（档案 + 字典 + 权限配置）。它们会**同时** 401。

如果每个请求各自去刷新，就是连打 N 次 `/api/auth/refresh`。后端 JWT 无状态倒不会失效，但纯属浪费，而且新旧令牌写入 `localStorage` 存在竞态。

解法是**共享一个 Promise**：

```ts
let refreshPromise: Promise<boolean> | null = null;

async function refreshTokens(): Promise<boolean> {
  if (refreshPromise) return refreshPromise;   // 已有刷新在飞，直接等它

  refreshPromise = (async () => {
    try {
      const res = await fetch(`${API_BASE}/api/auth/refresh`, { ... });
      if (!res.ok) return false;
      saveTokens((await res.json()) as TokenPair);
      return true;
    } catch {
      return false;
    } finally {
      refreshPromise = null;    // 无论成败都解锁
    }
  })();

  return refreshPromise;
}
```

三个细节：

1. **先赋值再 await**。如果反过来先 `await` 再赋值，并发请求进来时 `refreshPromise` 还是 null，会各刷各的；
2. **`finally` 里解锁**，成功后失败后都解锁，否则后续请求会永远等一个已完成的 Promise；
3. **不用 `.finally` 拆外部 Promise**。这里用同步赋值包住整个 async IIFE，是最省心的写法。

## 登录态：一个 Context 就够

```tsx
export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [initializing, setInitializing] = useState(true);

  const reload = useCallback(async () => {
    if (!getAccessToken()) { setProfile(null); return; }
    try {
      setProfile(await fetchProfile());
    } catch {
      clearTokens();
      setProfile(null);
    }
  }, []);

  useEffect(() => { void reload().finally(() => setInitializing(false)); }, [reload]);
  ...
}
```

`initializing` 这个状态值得单说。少了它，刷新页面时会先渲染「未登录 → 跳登录页」，然后档案回来发现其实有令牌，又跳回来——**登录页闪一下**。加上它就能在加载期间显示 Spin，闪的问题消失。

这跟 Umi 的 `getInitialState()` 是同一个思路：**应用启动时把登录态一次性定下来**，而不是让每个页面各自判断。

## 动态路由：后端下发 component 字符串

后端菜单树长这样，`component` 是字符串：

```json
{
  "name": "系统管理", "path": "/system", "component": "Layout",
  "children": [
    { "name": "用户管理", "path": "/system/user", "component": "system/user",
      "permissions": ["user:create", "user:delete", "user:read", "user:update"] }
  ]
}
```

前端维护一张极小的映射表：

```ts
const COMPONENT_MAP: Record<string, React.ComponentType> = {
  Dashboard,
  'system/user': UserList,
  'system/role': RoleList,
  'system/menu': MenuList,
};
```

然后按菜单树生成路由：

```ts
function buildRoutes(menus: MenuItem[], basePath = ''): React.ReactElement[] {
  const routes: React.ReactElement[] = [];

  for (const menu of menus) {
    if (menu.visible === false) continue;

    const Comp = COMPONENT_MAP[menu.component];
    const fullPath = menu.path.startsWith('/')
      ? menu.path
      : `${basePath}/${menu.path}`.replace(/\/+/g, '/');

    if (Comp) {
      routes.push(<Route key={menu.route_name} path={fullPath} element={<Comp />} />);
    } else if (menu.children.length > 0) {
      // 分组菜单：component 为空或 'Layout'，路径本身不可访问
      routes.push(
        <Route key={menu.route_name} path={fullPath}>
          {buildRoutes(menu.children, fullPath)}
        </Route>,
      );
    }
  }
  return routes;
}
```

两种菜单的分工很明确：

- **叶子菜单**（`component` 在映射表里）→ 直接挂路由；
- **分组菜单**（`component === 'Layout'` 或空）→ 路径本身不可访问，只用来嵌套子路由。

`COMPONENT_MAP[menu.component]` 这一行同时承担了「有没有权限」的判断：**映射表里没有的组件，路由压根不注册**。地址栏手输路径也进不去——这是比「进得去但页面报 403」更彻底的做法。

### 为什么必须用 Outlet 而不是 children

写的时候先用了 children，结构别扭。react-router 的嵌套路由是 `<Route path="/">` 渲染布局，布局内部用 `<Outlet />` 作为子路由的渲染位：

```tsx
<Route path="/" element={<AppLayout />}>
  <Route index element={<Navigate to={homePath} replace />} />
  <Route path="403" element={<Forbidden />} />
  {dynamicRoutes}
</Route>
```

`AppLayout` 里就是 `<Content><Outlet /></Content>`。用 children 也能凑合，但那样父 Route 就没有子路由概念，`path="403"` 得写成绝对路径 `<Route path="/403">`，嵌套的优雅性全丢了。

## 按钮级权限：Hook 版

```ts
export function usePermission(codes: string | string[]): boolean {
  const { profile } = useAuth();
  const owned = profile?.permissions ?? [];

  if (Array.isArray(codes)) {
    return codes.some((code) => owned.includes(code));
  }
  return owned.includes(codes);
}
```

传数组时语义是「任一命中即可」。用户管理页用起来：

```tsx
const canCreate = usePermission('user:create');
const canDelete = usePermission('user:delete');

{canCreate && <Button type="primary" icon={<PlusOutlined />}>新建用户</Button>}

{canDelete ? (
  <Popconfirm title="确认删除该用户？" onConfirm={() => onDelete(row.id)}>
    <Button type="link" danger icon={<DeleteOutlined />}>删除</Button>
  </Popconfirm>
) : (
  <Tag>无 user:delete 权限</Tag>
)}
```

和 admin-web 的 `access.ts` 有一个关键差异：真实项目是从 `localStorage` 读权限码数组再比对，**因为 Umi 的 access 函数不一定是组件上下文**。这里改成直接读 Context，少往 localStorage 塞一份重复数据。语义完全一样。

**重点是：前端藏按钮只是体验，后端还会再拦一次。** operator 恰好有 `user:delete`，看不出差别；用 viewer 试就明显了：

```bash
$ curl -X DELETE http://127.0.0.1:8020/api/users/1 -H "Authorization: Bearer <viewer的token>"
{"detail":"缺少权限：user:delete"}
```

绕过前端直接打接口一样 403。这就是「权限必须在服务端」的意义。

## 三账号实测：菜单和权限码真的不一样

后端跑起来后用 curl 逐个账号拉 `/api/auth/me`：

| 账号 | 角色 | 权限码数量 | 可见菜单 | `/api/users` | `/api/roles` |
| --- | --- | --- | --- | --- | --- |
| `admin/admin123` | admin | 8（全量） | 工作台 + 系统管理（含 3 个子菜单） | 200 | 200 |
| `operator/op123456` | operator | 6 | 工作台 + 系统管理（**缺「角色管理」**） | 200 | **200**（见下） |
| `viewer/view123` | viewer | **0** | 仅工作台 | **403** | **403** |

admin 视角的菜单树：

```
工作台                    /dashboard          comp=Dashboard
系统管理                  /system             comp=Layout
  ├─ 用户管理             /system/user        comp=system/user   [user:create, user:delete, user:read, user:update]
  ├─ 角色管理             /system/role        comp=system/role   [role:read, role:write]
  └─ 菜单管理             /system/menu        comp=system/menu   [menu:read, menu:write]
```

注意 operator 那一行：**菜单少了「角色管理」，权限码少了 `role:read`/`role:write`**。前端拿这份数据建路由，菜单栏里那一项**根本不会出现**，而不是出现了点进去报 403。

### 一个反直觉的实测结果

跑的时候发现 `/api/roles` 这个接口，operator 居然能访问（200）。翻后端代码才看清：

```python
@router.get("/roles", summary="全部角色")
def api_all_roles(db: DbSession, _admin: User = Depends(require_permission("menu:read"))):
```

守卫用的是 **`menu:read`** 而不是 `role:read`。而 operator 因为挂了「菜单管理」这个菜单，所以有 `menu:read`。

一开始以为是 bug，查完 seed 数据发现**这其实是个设计选择**：`/api/roles` 定位是「用户编辑页的角色下拉框」，谁能管用户就能选角色，所以跟着 `menu:read`（进而跟着用户管理那条线）走更合理。

但这个含义**只存在于写代码的人的脑子里**。接口路径叫 `/roles`，守卫却挂 `menu:read`，半年后没人记得为什么——这类隐式约定迟早出事。理想做法是在守卫里写清理由，或者权限码本身改名（`role:assign` 之类）让它自解释。

## 踩的坑

### 坑 1：TSX 里的条件表达式和花括号打架

```tsx
<Text>{hasPermission(owned, c.code) ? '✓' : '✗'}} {c.label}
```

报：

```
error TS1381: Unexpected token. Did you mean `{'}'}` or `&rbrace;`?
```

`}}` 在 JSX 里会被解析成「闭合表达式 + 闭合标签」。改成把文案合并进表达式就没事了：

```tsx
<Text>{hasPermission(owned, c.code) ? '✓ 有' : '✗ 无'} {c.label}</Text>
```

顺带一个更深的点：**这个 bug 只在 `.tsx` 里出现，`.ts` 里不会**。因为 TSX 有一套专门的 JSX 解析规则，同样的代码换个扩展名表现完全不同。

### 坑 2：antd Tree 的 children 类型不是 `unknown[]`

自己声明类型省事，结果报了一长串：

```
Type '{ key: number; title: ReactNode; children?: unknown[] }' is not assignable to type 'DataNode'
```

`DataNode` 的 `children` 是递归的 `FieldDataNode[]`，写成 `unknown[]` 就对不上了。直接用 antd 导出的类型最省事：

```ts
import type { DataNode } from 'antd/es/tree';
function toTreeData(menus: MenuItem[]): DataNode[] { ... }
```

**教训：数据结构能复用别人的类型定义，就别自己抄一份。** 抄的那份迟早对不上版本。

### 坑 3：Vite 在 Windows 上默认只绑 ::1

页面启动后 `curl http://localhost:5173` 是 200，但 `curl http://127.0.0.1:5173` 是 502，一度以为 dev server 没起来。

实际是 Vite 不指定 host 时在 Windows 上**只监听 IPv6 回环**，而本机 `http_proxy` 环境变量让 curl 走了代理。加一行显式绑定就解决：

```ts
server: {
  port: 5173,
  strictPort: true,
  host: '127.0.0.1',   // 不指定会只绑 ::1
}
```

改完两个地址都是 200。这类问题的排查顺序值得记：**先确认服务是否在监听（netstat），再确认自己的请求有没有被代理劫持**。我是先怀疑了半天才想到代理的。

### 坑 4：`noUnusedLocals` 逼出未使用导入

`tsconfig.json` 里开了 `noUnusedLocals` + `noUnusedParameters`，改路由时删了一段代码，留下了 `Forbidden` 和 `Row`/`Col` 的导入，立刻报错。

这个配置值得一直开着——它抓的是「重构后忘记清理的残留」，这类残留在代码里能潜伏几个月，最后让人搞不清某个导入还有没有用。

## 项目结构

```
admin-web-demo/
├── src/
│   ├── main.tsx              入口：ConfigProvider + Router + AuthProvider
│   ├── types/api.ts          与后端 schemas.py 对应的 TS 类型
│   ├── services/
│   │   ├── token.ts          localStorage 存取双令牌
│   │   ├── request.ts        fetch 封装 + 401 刷新重放 + 刷新锁
│   │   └── api.ts            一个后端路由一个函数
│   ├── store/auth.tsx        登录态 Context
│   ├── access/index.ts       usePermission / hasPermission
│   ├── router/index.tsx      COMPONENT_MAP + buildRoutes
│   ├── components/AppLayout.tsx   侧边菜单（后端下发）+ Outlet
│   └── pages/
│       ├── login/            登录页
│       ├── dashboard/        工作台：权限码 + 菜单树可视化
│       ├── Forbidden.tsx     403
│       └── system/{user,role,menu}/
├── .env.development          VITE_API_BASE=http://127.0.0.1:8020
└── vite.config.ts            5173 + host 127.0.0.1
```

`services` 拆三个文件的理由值得说：**职责不同粒度**。`token.ts` 是存取原语，`request.ts` 是横切逻辑（刷新、错误翻译），`api.ts` 是业务接口。真实项目里还会再拆（按模块分 `user.ts` / `menu.ts`），但 demo 阶段三个够了。

`types/api.ts` 是手写而非从 OpenAPI 生成——**这是有意的取舍**。体量小、看得清、改起来快；真实项目应该用 `openapi-typescript` 自动生成，否则后端改字段前端不报错就麻烦了。这点得写清楚，别让人以为手写类型是推荐做法。

## 工作台页：把数据摊开给人看

演示项目最值得做的一个页面是「工作台」，专门用来肉眼看数据：

- 左卡片列出当前账号**所有权限码**，并对 4 个代表性权限做 ✓/✗ 判定；
- 右卡片渲染后端下发的**菜单树**，每个菜单标注 `path`、`component` 和它关联的权限码；
- 工作台菜单本身不关联任何权限（`permissions: []`），所以三个账号都能进。

换账号登录，差异一眼可见。这比截图有说服力得多——**权限系统的正确性靠肉眼看不出全部，得靠可切换账号 + 数据可视化**。

## 跑起来

```bash
# 后端（admin-api 目录）
.venv/Scripts/python.exe -m admin_api.seed        # 幂等，灌种子数据
.venv/Scripts/python.exe -m uvicorn admin_api.main:app --host 127.0.0.1 --port 8020

# 前端（admin-web-demo 目录）
npm install
npm run dev                                      # http://127.0.0.1:5173
```

类型检查和构建：

```bash
npm run tsc        # 0 error
npm run build      # ✓ built，产物 1.08 MB / gzip 345 KB
```

种子账号（登录页上也有，点标签即可自动填充）：

| 账号 | 密码 | 角色 |
| --- | --- | --- |
| admin | admin123 | 全部权限 |
| operator | op123456 | 无角色管理 |
| viewer | view123 | 只有工作台 |

## 这篇真正想说的三件事

**第一，权限路由的本质是「路由从数据来」。** 前端不写全量路由表，后端下发菜单树，前端按树生成路由。映射表小到只有几行，权限一变路由跟着变，不用改代码。

**第二，按钮级权限是体验，服务端拦截是安全。** 前端 `usePermission('user:delete')` 只是决定按钮渲不渲染；真正拦住越权请求的是后端的 `require_permission`。两者都要有，且永远以后端为准。

**第三，隐式约定是权限系统最大的隐性成本。** `/api/roles` 挂 `menu:read` 守卫这件事，连写代码的人都要回头查 seed 数据才想明白。**权限码的命名和守卫的挂载位置，本身就该是可自解释的文档。** 这比多写 200 行注释有用。

## 下一步

后端还欠 `UserUpdate` 接口和角色/菜单的 CRUD，demo 里的角色页现在是只读的（页面上如实标注了，没假装有编辑能力）。补齐之后可以把「编辑用户时改角色 → 重新拉档案 → 按钮权限实时变化」这条链路做完整——**权限变更后的前端刷新**是这套体系里最后一个没验证过的环节。

> **踩坑提醒**：`/api/roles` 当前守卫是 `menu:read`，不是 `role:read`。如果你按路径名去猜权限，一定会猜错。
>
> 系列前传：[FastAPI 权限路由后端实战](https://lpw94.github.io/posts/fastapi-admin-api) · [前端工程师如何项目驱动学 Python](https://lpw94.github.io/posts/python-project-driven-learning)
