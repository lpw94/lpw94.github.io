前一篇把前端接完了，权限码、动态菜单路由、按钮级权限全跑通。但那篇结尾留了个问题：**权限变更之后，前端怎么刷新**？

这篇补上这个缺口，顺带把后端补齐成能真用的状态——角色/菜单 CRUD、用户部分更新、Alembic 迁移全上了。

## 这篇要解决的核心问题

先把这套系统的权限模型摊开。三层关系：

```
user  ──< user_roles >──  role  ──< role_menus >──  menu  ──< menu_permissions >──  permission
```

关键是最后那个箭头：**权限码挂在菜单上，不是挂在角色上**。

这个设计有一个反直觉的推论：给角色授权，实际动作是「勾菜单」。勾了哪些菜单，就等于有了那些菜单携带的权限码。权限码本身从不直接出现在角色的编辑表单里。

我用真实的 curl 跑了一遍。先看 admin 看到的角色列表（`GET /api/roles`）：

```
admin      menu_ids=[1, 2, 3, 4, 5] perms=['menu:read', 'menu:write', 'role:read', 'role:write', 'user:create', 'user:delete', 'user:read', 'user:update'] users=1
operator   menu_ids=[1, 2, 3, 5]    perms=['menu:read', 'menu:write', 'user:create', 'user:delete', 'user:read', 'user:update'] users=1
viewer     menu_ids=[1]            perms=[] users=1
```

看 `operator` 那一行：`menu_ids` 有 4 个（工作台、系统管理、用户管理、菜单管理），`permissions` 里就自动出现了对应的 6 个权限码。**perms 那一列没有任何地方手工赋值过**，它是从 `menu_ids` 推导出来的。

源码里就是这一行：

```python
def _to_role_out(db: Session, role) -> RoleOut:
    """把 ORM 角色转成输出对象（补上推导出来的权限码和用户数）。"""
    permissions: set[str] = set()
    for m in role.menus:
        for p in m.permissions:
            permissions.add(p.code)
    return RoleOut(
        ...
        menu_ids=[m.id for m in role.menus],
        permissions=sorted(permissions),
        user_count=count_users_in_role(db, role.id),
        created_at=role.created_at,
    )
```

## 「授权 = 勾菜单」的完整链路

### 前端：勾选 → 提交 menu_ids

角色编辑页的核心就是一个多选框：

```tsx
<Form.Item name="menu_ids" label="可见菜单（即授权）">
  <Select
    mode="multiple"
    allowClear
    placeholder="勾选这个角色能看到的菜单"
    options={menuOptions}
    optionFilterProp="label"
  />
</Form.Item>
```

注意标签写的是「可见菜单（即授权）」——**不是**「权限」。这不是文案偷懒，是刻意让操作者知道自己在改什么。

提交时送的是 `menu_ids`，**不送权限码**：

```tsx
await updateRole(editing.id, {
  name: values.name,
  remark: values.remark,
  menu_ids: values.menu_ids ?? [],
});
```

### 后端：存关联 → 推导权限

```python
def update_role(
    db: Session,
    role_id: int,
    *,
    name: str | None = None,
    remark: str | None = None,
    menu_ids: list[int] | None = None,
) -> RoleOut:
    """更新角色。"""
    role = get_role_by_id(db, role_id)
    if role is None:
        raise RoleNotFoundError("角色不存在")

    if menu_ids is not None:
        menus = get_menus_by_ids(db, menu_ids)
        found = {m.id for m in menus}
        missing = [mid for mid in menu_ids if mid not in found]
        if missing:
            raise RoleError(f"菜单不存在：{', '.join(str(m) for m in missing)}")
        role.menus = menus
    ...
```

`role.menus = menus` 这一行是关键。SQLAlchemy 的 relationship 赋值会自动 diff 出「多了哪些、少了哪些」，然后写 `role_menus` 中间表。**中间表里没有权限码字段，权限码始终只存在于菜单上。**

### 实测：勾一个菜单，权限码跟着长出来

拿 `viewer` 角色开刀。它原本 `menu_ids=[1]`（只有工作台），`permissions=[]`。

```
PUT /api/roles/3  {"name":"只读（升级）","menu_ids":[3]}
```

`3` 是「用户管理」菜单。结果：

```
name= 只读（升级） menu_ids= [3] perms= ['user:create', 'user:delete', 'user:read', 'user:update']
```

然后用 viewer 重新登录拉档案：

```
roles= ['viewer'] perms= ['user:create', 'user:delete', 'user:read', 'user:update']
menus= ['用户管理']
```

**一次勾选，三处同时变了**：角色详情里的权限码、登录后的 `permissions` 数组、可见菜单树。

这就是前一篇说的「权限变更后的前端刷新」——链路是通的，但有个前提得注意：**已登录用户的权限不会自动更新**。JWT 是无状态的，服务端不会因为数据库变了就把它踢下线。viewer 之所以能立刻看到新权限，是因为我重新登录了一次。

实际系统里这个问题的解法是：改权限后让相关用户重新登录，或者引入短有效期 access token + 主动刷新。这块我还没做，属于欠账。

## 一个操作，影响面超出预期

既然权限码挂在菜单上，那改菜单的权限码就等于**同时改所有关联角色的权限**。

实测：把「用户管理」菜单（id=3）的权限码从 `[user:read, user:create, user:update, user:delete]` 改成 `[user:read]`：

```
用户管理菜单现在权限码 = ['user:read']
--- 波及的角色 ---
  operator   perms=['menu:read', 'menu:write', 'user:read']
  viewer     perms=['user:read']
```

operator 挂着这个菜单，所以它的 `user:create` / `user:update` / `user:delete` **全部消失**。没人动过 operator 这个角色，但它的权限变了。

这不是 bug，是模型的必然推论。理解清楚了才不会在生产环境上被这招偷袭。

所以菜单管理页上放了个警示：

```tsx
<Alert
  type="warning"
  showIcon
  style={{ marginBottom: 12 }}
  message="菜单上的权限码 = 关联角色的权限"
  description="在这里改权限码，所有关联这个菜单的角色都会同步变——这是全局操作，不是只影响一个人。"
/>
```

**给一个用户的操作，和给所有人的操作，应该长得不一样。** 角色编辑页改的是「这个角色能看什么」，菜单编辑页改的是「所有挂了这个菜单的角色能干什么」。前者是局部，后者是全局。

## 删除保护：三条不能删的规则

权限系统最怕的是「删了个东西，某个用户静默失去了所有权限」。这类问题不报错、不告警，等发现时已经过了很久。

所以三处删除都做了前置检查。

### 角色下还有用户 → 拒绝

```python
def delete_role(db: Session, role_id: int) -> None:
    """删除角色。

    保护规则：角色下还有用户时拒绝删除——
    否则那些用户会静默失去所有权限（这是最难排查的一类问题）。
    """
    role = get_role_by_id(db, role_id)
    if role is None:
        raise RoleNotFoundError("角色不存在")
    if count_users_in_role(db, role_id) > 0:
        raise RoleError("该角色下还有用户，请先解绑")
    db.delete(role)
    db.commit()
```

实测：

```
DELETE /api/roles/2  →  {"detail":"该角色下还有用户，请先解绑"}   [HTTP 400]
```

### 菜单下还有子菜单 → 拒绝

删了父节点，子节点就成了孤儿——`parent_id` 指向一个不存在的行。

```
DELETE /api/menus/2  →  {"detail":"该菜单下还有子菜单，请先删除子菜单"}   [HTTP 400]
```

### 菜单还被角色引用 → 拒绝

这条和上一条同源但不同角度：菜单被角色引用着，删了菜单，那些角色会静默失去它带的全部权限码。

```python
if count_roles_with_menu(db, menu_id) > 0:
    raise MenuError("还有角色引用该菜单，请先解绑")
```

三条检查的顺序也有讲究：先查「有没有人用」，再删。**反过来做的话，检查和删除之间存在竞态窗口**——两个并发请求都通过了检查，然后都删了。

## 拆成两个角色接口

上一篇留了个尾巴：`/api/roles` 守卫挂 `menu:read`，路径名和权限码对不上。

这次改成了拆接口：

| 接口 | 守卫 | 返回 | 给谁用 |
| --- | --- | --- | --- |
| `GET /api/roles` | `role:read` | 完整角色（含权限码、用户数） | 角色管理页 |
| `GET /api/roles/options` | `menu:read` | 只有 id/code/name/remark | 用户编辑页的下拉框 |

拆开的理由是**「能改用户」和「能管角色」是两种不同的能力**。运营人员需要能给人分配角色，但不一定该看到所有角色的权限构成。

```python
@router.get(
    "/roles/options",
    summary="角色下拉选项（用户编辑页用）",
)
def api_role_options(
    db: DbSession,
    _admin: User = Depends(require_permission("menu:read")),
) -> list[dict]:
    """精简的角色列表，给「给用户分配角色」的下拉框用。
    ...
    """
    return [
        {"id": r.id, "code": r.code, "name": r.name, "remark": r.remark}
        for r in list_all_roles(db)
    ]
```

现在实测三个账号的权限矩阵：

| 账号 | `/api/users` | `/api/roles` | `/api/roles/options` | `/api/menus` | `/api/permissions` |
| --- | --- | --- | --- | --- | --- |
| admin | 200 | 200 | 200 | 200 | 200 |
| operator | 200 | **403** | **200** | 200 | 200 |
| viewer | **403** | **403** | **403** | **403** | **403** |
| 无 token | **401** | 401 | 401 | 401 | 401 |

operator 那一行最能说明问题：能读用户、能读菜单、能拿角色下拉选项，但**读不了完整角色列表**。这正是「能分配角色 ≠ 能管理角色」的量化表达。

对照着看三个账号的档案，差异更直观：

```
admin     perms = ['menu:read', 'menu:write', 'role:read', 'role:write', 'user:create', 'user:delete', 'user:read', 'user:update']
           menus = ['工作台', '系统管理']
operator  perms = ['menu:read', 'menu:write', 'user:create', 'user:delete', 'user:read', 'user:update']
           menus = ['工作台', '系统管理']
viewer    perms = []
           menus = ['工作台']
```

`menus` 那两行是**顶级菜单**（子菜单在 `children` 里）。把树展开就分叉了：

```
admin 的菜单树                     operator 的菜单树
工作台  (/dashboard)  comp=Dashboard   工作台  (/dashboard)  comp=Dashboard
系统管理  (/system)  comp=Layout        系统管理  (/system)  comp=Layout
  用户管理  (/system/user)  comp=system/user    用户管理  (/system/user)  comp=system/user
  角色管理  (/system/role)  comp=system/role    菜单管理  (/system/menu)  comp=system/menu
  菜单管理  (/system/menu)  comp=system/menu
```

operator 的菜单里**根本没有「角色管理」这一项**。所以前端按菜单树生成路由时，那个组件压根不会被注册——菜单栏里看不到，地址栏手输路径也进不去。

这比「进得去但页面报 403」更彻底。403 是让人以为「我有权限只是出错了」，菜单里没有则是**从一开始就不给这个入口**。

## 为什么 admin 角色能跳过所有检查

```python
def _checker(user: CurrentUser) -> User:
    if "admin" in {r.code for r in user.roles}:
        return user
    owned = {p.code for role in user.roles for m in role.menus for p in m.permissions}
    if not needed.issubset(owned):
        missing = ", ".join(sorted(needed - owned))
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=f"缺少权限：{missing}",
        )
    return user
```

`admin` 是**代码里写死的超级管理员**，不靠数据库配置。这意味着：即使把 admin 角色的菜单关联全删了，它依然能访问所有接口。

这是刻意的取舍。好处是「管理员永远不会被自己的权限配置锁在门外」；代价是 admin 这个 code 成了隐式后门——**谁能在库里建一个 code 为 `admin` 的角色，谁就是超级管理员**。生产环境得把这个角色的创建权限收紧。

另外注意 `needed.issubset(owned)`：多个权限码是「全部满足」的关系，不是「任一满足」。`require_permission("user:read", "user:write")` 意味着两个都要有。这跟前端 `usePermission` 传数组时的「任一命中即可」是**相反的语义**——这个差异容易踩坑。

## 部分更新：PUT 但只传改了的

用户编辑接口用 `PUT`，但语义是部分更新：

```python
class UserUpdate(BaseModel):
    """更新用户入参：所有字段可选，只传要改的。

    对标前端的 partial update——不传字段表示「不改」，
    区别于传 null 表示「清空」。
    """
    nickname: str | None = Field(default=None, max_length=64)
    email: str | None = Field(default=None, max_length=128)
    is_active: bool | None = None
    password: str | None = Field(default=None, min_length=6, max_length=128)
    role_codes: list[str] | None = None
```

全部字段是 `Optional` 且默认值是 `None`，服务端靠 `is not None` 判断要不要改：

```python
if nickname is not None:
    user.nickname = nickname
if email is not None:
    user.email = email
if is_active is not None:
    user.is_active = is_active
if password is not None:
    user.password_hash = hash_password(password)
```

**`is not None` 而不是 `if value:`**。区别在于空字符串和 `False`：

- `if nickname:` —— 昵称传空串会被当成「没传」，改不掉
- `if is_active:` —— 禁用一个账号（`False`）会被当成「没传」，**禁用功能直接失效**

第二种是真会出事的 bug。禁用账号用 `is_active=False`，而 `False` 在 Python 里 falsy。写 `if is_active:` 的话，禁用操作会静默失败，前端收到 200，账号却还活着。

前端配合：

```tsx
await updateUser(editing.id, {
  nickname: values.nickname,
  email: values.email,
  role_codes: values.role_codes,
  is_active: values.is_active,
  ...(values.password ? { password: values.password } : {}),
});
```

密码那行用条件展开 `...(cond ? {key} : {})`，因为**空字符串密码要表达「不改」而不是「把密码设成空」**。

## 异常分层：别用字符串比对判 404

业务层抛自定义异常，api 层翻译成 HTTP 状态码：

```python
class RoleError(Exception):
    """角色相关的业务错误（code 重复、角色下还有用户等）。"""


class RoleNotFoundError(RoleError):
    """角色不存在。

    单独一个子类，api 层据此决定返回 404 还是 400——
    靠字符串比对来判断是坏味道（改个文案就出错）。
    """
```

然后 api 层按类型分派：

```python
try:
    return update_role(db, role_id, ...)
except RoleNotFoundError as e:
    raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e)) from e
except RoleError as e:
    raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e)) from e
```

顺序有讲究：**子类必须在父类前面 except**，否则子类会被父类的 except 捕获，404 全变成 400。

反例是这样的写法：

```python
# ❌ 改个文案就 404 变 400
except RoleError as e:
    if "不存在" in str(e):
        raise HTTPException(status_code=404, detail=str(e))
    raise HTTPException(status_code=400, detail=str(e))
```

中文文案改一下（「角色不存在」→「找不到该角色」），所有 404 全变 400。**异常类型是给程序看的，文案是给人看的，两者不能混用。**

另外 `raise ... from e` 那个 `from` 不能省——它保留原始异常链，FastAPI 的日志里能看到「RoleNotFoundError → HTTPException」的过程。少了它，traceback 会断在半路。

## Alembic：把表结构纳入版本管理

之前建表用的是 `Base.metadata.create_all()`。它方便，但有个致命问题：**它只能建表，不能改表**。

一旦上线，字段要加要改，`create_all()` 完全帮不上忙——它只会看「表在不在」，表在就跳过，**新加的字段永远不会出现在已有表上**。

所以引入了 Alembic。对标 `prisma migrate` / `knex migrate`。

```bash
uv run alembic upgrade head                                # 应用到最新版本
uv run alembic downgrade -1                                # 回滚一版
uv run alembic revision --autogenerate -m "给 users 加字段"  # 按模型差异生成新迁移
uv run alembic current                                     # 当前版本
```

首次迁移生成 7 张表：

```python
def upgrade() -> None:
    op.create_table('menus', ...)
    op.create_table('permissions', ...)
    op.create_table('roles', ...)
    op.create_table('users', ...)
    op.create_table('menu_permissions', ...)
    op.create_table('role_menus', ...)
    op.create_table('user_roles', ...)
```

### 三条踩过的坑

**坑 1：`alembic.ini` 必须是纯 ASCII。**

Alembic 用 locale 编码读这个文件，中文 Windows 上 locale 是 GBK。文件里一句 UTF-8 的中文注释就能让它崩：

```python
# configparser.read(..., encoding="locale")
```

所以 `alembic.ini` 里现在全是英文注释，开头还专门写了一段警告：

```ini
# NOTE: keep this file ASCII-only. Alembic reads it with the *locale*
# encoding (configparser.read(..., encoding="locale")), which is GBK on
# Chinese Windows -- a UTF-8 Chinese comment here raises UnicodeDecodeError.
```

**坑 2：autogenerate 要对空库跑。**

`alembic revision --autogenerate` 的原理是「对比模型定义和数据库实际结构，算出差异」。如果数据库已经有表了，它算出来的差异就是空——**生成一个什么都不做的迁移文件**。

我第一次就是这么干的，生成的文件里 `upgrade()` 是空的，`downgrade()` 也是空的。看起来很美，实际上一点用没有。

正确做法：拿一个干净的空库跑 autogenerate，把生成的脚本**人工检查一遍**再提交。

**坑 3：测试清理用 `downgrade base`，不要用 `drop_all`。**

```python
def downgrade_to_base_with(engine: Engine) -> None:
    """用给定的 engine 回滚到初始状态。

    测试清理用这个而不是 `Base.metadata.drop_all()`——
    drop_all 不会碰 alembic_version 表，版本号还留在那儿，
    下一次 upgrade 就会以为「已经是最新了」而跳过建表。
    """
    cfg = get_config()
    with engine.connect() as connection:
        cfg.attributes["connection"] = connection
        command.downgrade(cfg, "base")
```

`drop_all` 只删业务表，**不删 `alembic_version`**。于是版本号残留，第二个测试的 `upgrade` 变成空操作，表根本没建出来——单跑一个测试绿，连跑全套就红。

这个坑的表现很有迷惑性：单独跑某个测试是过的，跑整个套件就挂。排查时容易怀疑是测试之间互相污染，实际上是迁移状态没清干净。

还有一个顺序问题：`menus.parent_id` 是自引用外键，直接 `drop_all` 可能触发 `FOREIGN KEY constraint failed`。按迁移的逆序回滚就没事。

### 把 Alembic 包成函数

Alembic 正常是命令行工具，但有些场景必须在 Python 里触发：种子脚本建表前先跑迁移、测试 fixture 准备数据库、部署脚本一步到位。

```python
def upgrade_to_head_with(engine: Engine) -> None:
    """用给定的 engine 升级到最新版本。

    测试用这个：内存 SQLite 的 engine 传进来，
    表结构由迁移脚本创建，和生产走同一套逻辑。

    Alembic 的 configure() 要的是 Connection 不是 Engine，
    所以这里自己 connect 并保证关闭。
    """
    cfg = get_config()
    with engine.connect() as connection:
        cfg.attributes["connection"] = connection
        command.upgrade(cfg, "head")
```

「要 Connection 不是 Engine」这个坑值得单说。直接把 Engine 塞进 `cfg.attributes["connection"]`，Alembic 内部调 `connection.begin()` 会报 `AttributeError`。而报错信息里完全看不出是这个原因，只能去翻 Alembic 源码才发现。

## 测试：56 个用例，四个角色

```
tests/test_auth.py     9
tests/test_menus.py   14
tests/test_roles.py   16
tests/test_users.py   17
```

```
56 passed, 1 warning in 51.88s
```

每个测试用独立的内存 SQLite，**表结构由 Alembic 迁移创建**（不是 `create_all`）：

```python
TEST_ENGINE = create_engine(
    "sqlite://",
    connect_args={"check_same_thread": False},
    poolclass=StaticPool,   # 让所有连接共用同一个内存库
)
```

`StaticPool` 是必须的。默认的连接池模式下，每开一个新连接就是一个**全新的空数据库**——迁移建好了表，下一个连接却什么表都看不到。

测试数据里四个角色，比种子的三个多一个：

| 角色 | 挂的菜单 | 权限码 |
| --- | --- | --- |
| admin | 全部 | 全量 |
| operator | 用户管理 + 菜单管理 | `user:*`, `menu:*` |
| **auditor** | 角色查看（只读） | `role:read` |
| viewer | 无 | 无 |

`auditor` 这一档是专门设计的。它证明「能读角色」和「能改角色」是两种能力，不只是 admin 全有、其他人全无的二元结构：

```python
def test_auditor_can_read_roles_but_not_write(
    client: TestClient, auditor_header: dict[str, str]
) -> None:
```

对应的测试数据里，「角色查看」这个菜单只声明 `role:read`，不含 `role:write`：

```python
role_view_menu = Menu(
    name="角色查看",
    path="/system/role-view",
    component="system/role",
    route_name="system-role-view",
    sort=2,
    parent_id=0,
    permissions=[perms["role:read"]],   # 只有读
)
```

**权限模型的正确性，靠肉眼看不出来。** 得设计出「只读但能进」这种中间档，写出断言，才算真的验证了。

还有一条测试专门验证「改菜单波及多角色」这个推论：

```python
def test_update_menu_permissions_changes_role_permissions(
    client: TestClient, auth_header: dict[str, str]
) -> None:
    """改菜单的权限码 → 关联角色的权限码跟着变。

    这是「菜单即权限载体」的直接后果：
    菜单上挂的权限码是这个菜单所有关联角色共享的。
    """
    ...
    # auditor 挂了「角色查看」这个菜单 → 权限码跟着变
    roles = {r["code"]: r for r in client.get("/api/roles", headers=auth_header).json()}
    assert "role:write" in roles["auditor"]["permissions"]
    # 没挂这个菜单的 operator 不受影响
    assert "role:write" not in roles["operator"]["permissions"]
```

**同一个操作，对不同角色影响不同**——这正是需要用测试钉住的行为。

## 前端：三个页面都能写了

前一篇里角色页是只读的（页面上如实标注了，没假装有编辑能力）。这次三个管理页全部可写：

| 页面 | 能力 | 权限码 |
| --- | --- | --- |
| 用户管理 | 新建 / 编辑 / 删除、分页、搜索 | `user:read` / `create` / `update` / `delete` |
| 角色管理 | 新建 / 编辑（勾菜单）/ 删除 | `role:read` / `role:write` |
| 菜单管理 | 新建 / 编辑（选权限码）/ 删除 | `menu:read` / `menu:write` |

### 两个 antd v5 的坑

**坑 1：`useForm` 未连接警告。**

```
Instance created by useForm is not connected to any Form element
```

原因是 Modal 关闭时 Form 被卸载了，但 `useForm` 的实例还在。解法是给 Modal 加 `forceRender`：

```tsx
<Modal
  ...
  forceRender
  destroyOnHidden
>
```

**坑 2：`destroyOnClose` 已废弃。**

antd v5 里改成了 `destroyOnHidden`。用旧属性会有 deprecation 警告。

### 一个更隐蔽的坑：菜单管理页的权限码选项

权限码不能在前端硬编码——后端加了新权限码，前端应该自动能选。所以菜单编辑页的选项是拉来的：

```tsx
const permissionOptions = useMemo(
  () => permissions.map((p) => ({ label: `${p.group} / ${p.code}`, value: p.code })),
  [permissions],
);
```

对应后端的 `/api/permissions`：

```python
@router.get("/permissions", response_model=list[PermissionOut], summary="全部权限码")
def api_all_permissions(
    db: DbSession,
    _admin: User = Depends(require_permission("menu:read")),
) -> list[PermissionOut]:
    """系统里定义的所有权限码。

    菜单编辑页要选权限码，不能把权限码字符串硬编码在前端——
    后端加一个权限码，前端应该自动能选。
    """
```

**权限码清单本身也是数据。** 硬编码在组件里的那一刻，它就成了一个必须靠人肉同步的副本。

## 跑起来

```bash
# 后端
cd admin-api
.venv/Scripts/python.exe -m admin_api.seed        # 幂等：迁移 + 灌种子
.venv/Scripts/python.exe -m uvicorn admin_api.main:app --host 127.0.0.1 --port 8020

# 前端
cd admin-web-demo
npm install
npm run dev                                      # http://127.0.0.1:5173
```

Swagger UI 在 <http://127.0.0.1:8020/docs>，FastAPI 根据类型注解自动生成，不用手写。

验证：

```bash
python -m pytest -q                              # 56 passed
python -m ruff check src tests                   # 全绿
```

> 用 `python -m pytest` 而不是 `pytest` 可执行文件——本机应用控制策略会拦部分可执行启动器。

代码规模：后端 2282 行（含 1011 行测试），前端 1882 行。

## 这篇真正想说的三件事

**第一，「授权 = 勾菜单」不是简化，是重新定义了授权的粒度。**

权限码挂在菜单上，意味着「能看到什么」和「能干什么」共用同一个开关。好处是天然一致——不会出现菜单里没有这个功能、但接口却允许调用的错位。代价是**改菜单权限码会波及所有关联角色**，这是全局操作，必须在 UI 上明确警示。理解了推论，这个设计就是优势；没理解，它就是随时会炸的地雷。

**第二，权限系统真正的成本在「破坏性操作」和「隐式约定」上。**

三条删除保护、code 和 route_name 不可改、`admin` 写死放行、`is not None` 而不是真值判断——这些都不是功能，是**防止静默错误**的护栏。写这类系统时，值得花的精力不在「怎么实现 CRUD」，而在「哪些操作会悄悄破坏别人的数据」。

**第三，模型约束要能被测出来，不能只靠读代码确认。**

「改菜单会波及多角色」「auditor 能读不能改」这些推论，写成测试才有意义。设计测试数据时**刻意造一个中间档**（auditor），比只测 admin/viewer 两端能发现的问题多得多。

## 下一步

这套系统现在能跑了，但离生产还差几样：

1. **权限变更的实时生效**——目前改权限后已登录用户要重新登录才生效，需要引入权限版本号或短有效期 token。
2. **密码重置流程**——现在只有管理员在编辑用户时能改密码，没有「用户自己忘记密码」的路径。
3. **登录失败锁定**——防止暴力破解。
4. **操作审计日志**——谁在什么时候改了谁的权限，现在查不到。
5. **`admin` 超级管理员改成配置项**——现在是代码里写死的 code。

这几个都是真实后台系统必须有的。回头挑一两个继续做。

> **踩坑提醒**：`require_permission` 传多个权限码是「全部满足」，前端 `usePermission` 传数组是「任一命中」——**两边语义相反**，写的时候容易搞混。
>
> **另一条提醒**：`PUT` 在这套接口里是部分更新语义（不传的字段表示「不改」），不是 HTTP 标准的全量覆盖。
>
> 系列前传：[FastAPI 权限路由后端实战](https://lpw94.github.io/post/fastapi-admin-api) · [权限路由前端落地](https://lpw94.github.io/post/admin-web-demo-permission-frontend) · [前端工程师如何项目驱动学 Python](https://lpw94.github.io/post/python-project-driven-learning)
