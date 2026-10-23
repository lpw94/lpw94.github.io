## 阶段三的目标：给你正在做的 admin-web 配后端

前两篇是练手（验证码识别、依赖隔离），这篇是**第一个正经项目**：FastAPI + SQLAlchemy 权限路由后端。

选题不是随便挑的。我手上真有一个在推的 admin-web（antd 权限路由系统），于是把这个后端按**前端工程师能直接对上号**的方式写——每个概念都找一个前端心智锚点，这样学的时候不用在脑子里维护两套语言：

| Python 后端 | 你熟悉的前端等价物 |
| --- | --- |
| FastAPI 的装饰器路由 | `express` / `koa` 的 `app.get('/api/...')` |
| `Depends()` 依赖注入 | axios 拦截器 + 中间件链 |
| Pydantic 模型 | `zod` schema |
| SQLAlchemy ORM | `prisma` / `typeorm` |
| `response_model=` 自动过滤字段 | `res.json()` 前手动挑字段 |
| 权限依赖 `require_permission("user:read")` | 路由守卫 + `hasPermission()` |

整体分层也照着前端服务的习惯来，**api / services / repositories / schemas** 四层，边界清楚：

```
api/          只收参数、出响应      ← 对标 controller
services/     业务规则、跨表组装     ← 对标 service 层
repositories/ 只碰数据库            ← 对标 dao / model 层
schemas/      出入参定义            ← 对标 types + zod
core/deps.py  认证与鉴权依赖        ← 对标拦截器 + 路由守卫
```

## 权限模型：user ↔ role ↔ menu ↔ permission

这是整个项目的核心。**不是**用户直接挂权限，而是走角色：

```
user  ──< user_roles >──  role  ──< role_menus >──  menu  ──< menu_permissions >──  permission
```

四层多对多，中间表统一用 `<a>_<b>` 命名（`user_roles` / `role_menus` / `menu_permissions`），
纯关系表没有额外字段，所以直接用 SQLAlchemy 的 `Table()` 定义而不写 ORM 类——对标 prisma 的显式中间表写法。

这么设计的理由很实际：

- **用户直接挂权限**，角色就废了。10 个运营全是 `user:create`，改一次权限要动 10 条记录；
- 角色和菜单的关联表将来可以加**数据权限字段**（本项目的 `role_menus` 目前是纯关系表，
  只有 `role_id` + `menu_id`），这样"运营只能看本部门数据"这类需求不用重写权限体系。

```python
def build_profile(db: Session, user: User) -> ProfileOut:
    """把用户 + 角色 + 权限 + 菜单树组装成一个响应对象。

    关键点：权限码和菜单都从用户关联的角色推导。
    """
    menu_ids: set[int] = {m.id for role in user.roles for m in role.menus}
    menus = get_menus_by_ids(db, list(menu_ids))
    menu_tree = build_menu_tree(menus)          # 平铺 parent_id → 树

    permissions = {p.code for m in menus for p in m.permissions}

    return ProfileOut(id=user.id, username=user.username,
                      roles=[r.code for r in user.roles],
                      permissions=sorted(permissions), menus=menu_tree)
```

于是登录后**一次请求** `/api/auth/me` 就拿到全部：用户信息 + `permissions: string[]`（喂 `hasPermission()`）+ `menus` 树（喂 `router.addRoute()`）。前端不用发三个请求，也不用自己在前端做权限合并逻辑——那是最容易出安全幻觉的地方。

## 三个接口撑起整个前端流程

**登录换双令牌**：

```python
def login(db: Session, username: str, password: str) -> TokenPair:
    """账号密码换令牌对。"""
    user = get_user_by_username(db, username)
    # 用户不存在和密码错误返回同一个错误，避免泄露「哪些用户名存在」
    if user is None or not verify_password(password, user.password_hash):
        raise AuthError("用户名或密码错误")
    if not user.is_active:
        raise AuthError("账号已被禁用")

    return TokenPair(
        access_token=create_access_token(user.id, user.username),
        refresh_token=create_refresh_token(user.id, user.username),
        expires_in=60 * 60 * 12,
    )
```

返回 `access_token` + `refresh_token` + `expires_in`。前端拿 `expires_in` 就能提前刷新，不用等 401 了才反应。

注意上面那个判断：`user is None or not verify_password(...)` 用一个条件覆盖两种失败，**返回同一个错误文案**。如果分开写——"用户不存在"和"密码错误"给不同提示——等于告诉攻击者哪些用户名真实存在（用户枚举漏洞）。

**参数化鉴权**——这是 FastAPI 里最值得学的技巧：

```python
def require_permission(*required: str) -> Callable[[User], User]:
    """生成一个「需要指定权限码」的依赖。对标封装 withPermission()(handler) 的 HOC。"""
    needed = set(required)

    def _checker(user: CurrentUser) -> User:
        if "admin" in {r.code for r in user.roles}:
            return user                                  # 超级管理员直接放行
        owned = {p.code for role in user.roles for m in role.menus for p in m.permissions}
        if not needed.issubset(owned):
            missing = ", ".join(sorted(needed - owned))
            raise HTTPException(403, f"缺少权限：{missing}")
        return user

    return _checker

@router.get("/users", response_model=UserPage)
def list_users(db: DbSession, _: User = Depends(require_permission("user:read"))):
    ...
```

`Depends(require_permission("user:read"))` 就是"这个接口要 user:read"。想加新权限只改字符串，不用继承、不用中间件。而且用了 `*required` 变长参数，所以 `require_permission("user:read", "user:create")` 这种"同时要多个权限"也能直接写。

**这就是后端版的路由守卫**，而且守卫逻辑写在服务端，前端绕过也没用。

**登录失败信息不区分用户是否存在**（上面注释那条）是个容易被忽略但很值钱的安全细节。

## 实跑验证：三种角色的隔离

seed 了三个用户，跑起来实测：

| 账号 | 角色 | 权限码 | 可见菜单 | `GET /api/users` |
| --- | --- | --- | --- | --- |
| `admin/admin123` | admin | 8 个（全量） | 工作台 + 系统管理（3 个子菜单） | **200** |
| `operator/op123456` | operator | 6 个（缺 `role:read` / `role:write`） | 工作台 + 系统管理（**只挂用户管理、菜单管理**） | **200** |
| `viewer/view123` | viewer | **0 个** | 仅工作台 | **403** |

（实测输出，admin 视角：）

```
工作台                    dashboard · /dashboard
系统管理                  system · /system
  ├─ 用户管理             system-user · /system/user   [user:create, user:delete, user:read, user:update]
  ├─ 角色管理             system-role · /system/role   [role:read, role:write]
  └─ 菜单管理             system-menu · /system/menu   [menu:read, menu:write]
```

这棵树直接喂给前端动态路由即可，**每个菜单项自带它需要的权限码**——按钮的显隐不用再单独维护一份映射表。

顺带一个真实数据暴露的细节，值得单独说：operator 少了「角色管理」菜单，所以拿不到 `role:read`/`role:write`，但它**仍然有 `menu:read` 和 `menu:write`**——因为它挂了「菜单管理」这个菜单。权限是从「角色 → 菜单 → 权限」推出来的，所以"能不能编辑菜单"和"能不能编辑角色"天然解耦。

这是设计上的正确表现（运营要能配菜单但不该能配角色），但也提醒一件事：**后端鉴权是最终防线，前端按钮显隐只是体验**。真要限制 operator，就别给它挂带 `menu:write` 的菜单。

鉴权边界也一并实测了，三个都是 401：

| 用例 | 结果 |
| --- | --- |
| 不带任何 token 访问 `/api/users` | **401** |
| 把 `access_token` 当 `refresh_token` 用 | **401**（两种令牌有类型区分，`decode_token(expected_type=...)` 会校验） |
| 密码错误 | **401** |

## 踩了 4 个坑，两个是"环境级"的

这一节比代码本身值钱，因为坑 2 和 3 是**这台机器特有的**，换台电脑可能就不存在。

### 坑 1：SQLAlchemy 2.1 起不来，必须锁 2.0.x

装完 2.1 一跑就崩：

```
应用程序控制策略已阻止此文件 ... sqlalchemy/lib/sqlalchemy/_util_cy.cp313-win_amd64.pyd
```

原因是 SQLAlchemy 2.1 的 `engine/util.py` **无条件** `import ._util_cy`，没有回退分支。而 2.0.x 里有这么一段：

```python
try:
    from . import _collections_cy
    HAS_CYEXTENSION = True
except ImportError:
    HAS_CYEXTENSION = False
```

有了它，C 扩展加载失败就自动降级纯 Python，功能不受影响（只是慢一点）。**结论：`sqlalchemy>=2.0,<2.1`**，不要盲目追新。

### 坑 2：passlib 1.7.4 + bcrypt 4.1+ 直接抛错

经典的 `passlib` 版本地狱。`passlib 1.7.4` 会用一种老办法探测 bcrypt 版本（读 `bcrypt.__about__`），而 **bcrypt 4.1 起把这个属性删了**，于是 `passlib` 误判版本，走到一个不兼容的分支上，遇到长密码就抛：

```
ValueError: password cannot be longer than 72 bytes
```

passlib 早已停止维护（作者 2020 年就归档了）。**直接用 `bcrypt` 库**，并且注意 bcrypt 自己也有 72 字节上限，要显式截断——而且**按字节截，不能按字符截**，否则会切出半个多字节字符：

```python
MAX_PASSWORD_BYTES = 72

def _truncate(password: str) -> bytes:
    """按 UTF-8 字节截断到 bcrypt 上限。

    bcrypt 4.x 在超长时会直接抛异常，所以要自己截。
    用 bytes 切片而不是 str 切片——按字符切可能切出半个多字节字符。
    """
    return password.encode("utf-8")[:MAX_PASSWORD_BYTES]

def hash_password(password: str) -> str:
    """明文 → bcrypt 哈希。gensalt() 生成随机盐，
    同一个密码两次结果不同——这正是能安全校验的原因。"""
    return bcrypt.hashpw(_truncate(password), bcrypt.gensalt()).decode("utf-8")

def verify_password(plain: str, hashed: str) -> bool:
    try:
        return bcrypt.checkpw(_truncate(plain), hashed.encode("utf-8"))
    except (ValueError, TypeError):
        return False
```

中文密码 25 个字就是 75 字节，很容易踩这条线——所以**别等到线上报错才想起来截**。

### 坑 3：`python -m pytest` 和 `uv run pytest` 都能被拦

这台机器的应用控制策略**按文件拦**，不是全拦：同一个 venv 里 `bcrypt`/`pydantic_core` 的 `.pyd` 能加载，`sqlalchemy` 的不行；`.venv/Scripts/pytest.exe` 这个启动器也一样会被拦。

所以本项目所有命令统一用模块方式：

```bash
uv run python -m pytest -q        # ✅ 而不是 uv run pytest
uv run python -m ruff check src tests   # ✅ 而不是 uv run ruff
```

### 坑 4：两个 `Base`，建表建不出来

`database.py` 和 `models.py` 里各写了一个 `Base`，报的是：

```
sqlalchemy.exc.InvalidRequestError: Table 'users' is already defined for this MetaData instance
```

原因：每个 `DeclarativeBase` 子类自带一个独立 `MetaData`，ORM 类注册在各自那一份上，`Base.metadata.create_all()` 只能看见自己那份，看不见 models 里的表。

**修法**：`Base` 只在 `database.py` 定义一次，`models.py` 里 `from .database import Base`。

### 附带一个：uv run 会顶回你的版本

```bash
uv pip install "sqlalchemy==2.0.36"   # 装上了
uv run python -c "import sqlalchemy"  # 又变回 2.1 了
```

`uv run` 会按 `pyproject.toml` 自动 sync，把手动装的版本覆盖回去。**所以降版本必须改 pyproject 约束，不能只改环境**——这是我踩了两次才记住的。

## 顺手写了个零依赖登录测试页

接前端之前，先写了个**单文件 HTML**（原生 `fetch`，不引任何框架）把接口契约验干净，避免前后端同时改导致问题难定位。页面能做：登录 → 存双令牌 → 拉档案 → 渲染权限码和菜单树 → 用 refresh 换令牌 → 调受保护接口看是不是 403，还带一个请求日志面板（等价于 axios 拦截器 + devtools Network，失败标红）。

有个**端口上的坑值得记**：页面我固定用 **5173**，后端用 **8020**。不是随手选的——后端 `cors_origins` 白名单里就只有 5173（Vite 默认端口），这样测试页不用改任何后端配置就能跑；而 5173 → 8020 是**真跨域**，会真实走一遍 CORS 预检，比同源更能暴露问题。换个端口记得同步改 `.env`。

## 阶段三小结与验收

跑通的东西：认证（双令牌 + 刷新）、鉴权（参数化权限依赖）、权限模型（四层多对多）、用户管理（分页 + 创建 + 详情 + 删除）、自动 OpenAPI 文档（`/docs` 直接调试）。

质量状态：`19 个测试全绿`、`ruff check 全绿`、三种角色隔离实测正确。

对前端来说，接入成本很低——三个接口、两种数据结构（`TokenPair` 和 `ProfileOut`），照着写一个 axios 封装和一份 `hasPermission` 就行。

> **下一步打算**：把这套拦截器逻辑搬进真正的 admin-web 工程；或者先把后端欠的 `UserUpdate` 接口和角色/菜单 CRUD 补完再接。你更想先做哪个？
>
> 系列前传：[前端工程师如何项目驱动学 Python](https://lpw94.github.io/post/python-project-driven-learning)