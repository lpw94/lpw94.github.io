# 前端工程师如何项目驱动学 Python

> 一个会 node / vue / react 的前端，想学 Python，最差的学法是从语法书第一页啃到最后一页；最好的学法是：直接做一个你本来就用得上的小项目，边做边查。

我自己的背景是前端（node + vue + react），最近想补一补 Python。踩了一圈之后发现：**前端工程师学 Python 几乎是降维打击**——你缺的从来不是"编程能力"，只是语法和生态的对应关系。

这篇文章把我走过的路线和第一个实战项目（一个命令行记账工具）完整记下来，给同样处境的前端同行参考。

## 一、为什么前端学 Python 是降维打击

你已经具备的工程化思维，在 Python 里全都有对应物：

- **模块化 / 包管理**：你用过 npm / pnpm，理解 `package.json` 即依赖清单——Python 的 `pyproject.toml` + `uv` 一模一样。
- **异步**：你写过 `async/await`，理解事件循环——Python 的 `asyncio` 思路相通（虽然 API 不同）。
- **构建工具 / CI/CD**：你配过 vite、GitHub Actions——Python 的 `ruff`、`pytest`、Actions 部署没有任何认知负担。
- **类型系统**：你写过 TypeScript——Python 的类型注解 + `Pydantic` 比 TS 还强一点（运行时可校验）。

**缺的只是映射表**。下面这张表是我入门时最想要的：

| 你熟悉的 | Python 对应 | 备注 |
|----------|------------|------|
| npm / pnpm | **uv**（首选） | Rust 写的，快，管 Python 版本 + 依赖 + venv |
| package.json | **pyproject.toml** | 依赖 + 项目配置一体 |
| node 脚本 | python + **Typer** | CLI 参数解析，装饰器即路由 |
| Express / Koa 路由 | **FastAPI** | 装饰器即路由，`async def` 直接写异步 |
| TypeScript 类型 | 类型注解 + **Pydantic v2** | 运行时可校验 |
| Prisma / TypeORM | **SQLAlchemy 2.0** | async ORM，Alembic 管迁移 |
| ESLint + Prettier | **Ruff** | lint + format 一个工具搞定 |
| Jest / Vitest | **pytest** | fixture 机制是核心 |

## 二、四阶段项目驱动路线

核心原则：**每个阶段只做一个能跑起来的小项目，用你熟悉的前端项目做迁移练习**。

### 阶段 1 · 语法核心（1~2 周）
对照 JS 快速过语法：列表推导（对标 `map/filter`）、解包、f-string、dataclass（对标 interface）、类型注解。
**项目**：个人记账 CLI（Typer + 富终端表格）。

### 阶段 2 · 脚本自动化（2 周）
把你手上现成的 JS 脚本用 Python 重写一遍——需求你门儿清，只换语言。
**项目**：拿 `pandas + openpyxl + httpx + schedule` 重写你已有的 Excel 定时导入脚本。

### 阶段 3 · Web 后端（3~4 周）
**项目**：给你的前端项目写一个 FastAPI 后端，REST + SQLite + SQLAlchemy + JWT。分层：`api / services / repositories / schemas`。

### 阶段 4 · 全栈实战
**项目**：前端（vue/react） + Python 后端的完整交付闭环，用 Docker + GitHub Actions 部署。

## 三、实战：阶段 1 个人记账 CLI

技术栈：`Typer`（CLI 框架）+ `rich`（终端美化）。目标是一个能在命令行记账、统计、导出 CSV 的小工具。

### 分层结构

```
ledger-cli/
├── pyproject.toml        # 依赖 + 工具配置（对标 package.json）
├── src/ledger/
│   ├── models.py         # dataclass + Enum（对标 TS interface）
│   ├── storage.py        # JSON 持久化（pathlib + 列表推导）
│   ├── service.py        # 业务逻辑（生成器 / defaultdict）
│   └── main.py           # Typer CLI（装饰器即路由，对标 commander.js）
└── tests/                # pytest（conftest fixture + 用例）
```

每一层只干一件事，和前端的 `store / service / api` 分层完全一致。

### 数据模型（对标 TS interface）

```python
from dataclasses import dataclass
from datetime import date
from enum import Enum

class TxType(str, Enum):
    INCOME = "income"
    EXPENSE = "expense"

@dataclass
class Transaction:
    id: str
    amount: float          # 金额，统一存正数，正负靠 type 区分
    type: TxType           # 收入 / 支出
    category: str          # 分类，如「餐饮」「工资」
    note: str = ""         # 备注，默认空串
    created_at: date = date.today()
```

`dataclass` 自动生成构造器、`__repr__`，不用像 TS 那样手写一堆样板；`Enum` 继承 `str` 是为了 JSON 序列化友好。

### 业务逻辑（几个前端熟悉的写法）

```python
from collections import defaultdict

def summary(self):
    # 生成器表达式 sum(x for x in ... if ...) 对标 arr.reduce
    income = sum(t.amount for t in self.all() if t.type == TxType.INCOME)
    expense = sum(t.amount for t in self.all() if t.type == TxType.EXPENSE)
    return {"income": income, "expense": expense, "balance": income - expense}

def by_category(self):
    # defaultdict(float)：key 不存在自动给 0.0
    # 对标前端 acc[cat] = (acc[cat] || 0) + amt
    totals = defaultdict(float)
    for t in self.all():
        totals[t.category] += t.amount
    return dict(totals)
```

### CLI 入口（对标 commander.js）

```python
import typer
from rich.console import Console

app = typer.Typer()
console = Console()

@app.command()
def add(
    amount: float = typer.Argument(..., help="金额，如 38.5"),
    category: str = typer.Argument(..., help="分类，如 餐饮"),
    type: TxType = typer.Option(TxType.EXPENSE, "--type", "-t"),
    note: str = typer.Option("", "--note", "-n"),
) -> None:
    """新增一笔收支。"""
    tx = service.add(amount, type, category, note)
    console.print(f"[green]已记录[/green] #{tx.id} {tx.amount} · {tx.category}")
```

`@app.command()` 装饰一个函数就是注册一条子命令，函数名即命令名；`Typer` 根据类型注解自动解析参数，连 `--help` 和枚举选项都帮你生成了。

最终这个 CLI 暴露了 8 个命令：`add / list / rm / summary / report / clear / export / monthly`。

## 四、前端转 Python 的 5 个坑

1. **缩进即语法**：没有花括号，tab/空格混用直接报错，编辑器设 4 空格。
2. **异步模型不同**：`asyncio` 和 node 事件循环思路相似但 API 完全不同；CPU 密集型任务不会像 node 那样自动让出，需要丢进线程/进程池。
3. **没有 node_modules**：依赖装进 venv，`uv run` 自动激活，别全局 `pip install`。
4. **装饰器是灵魂特性**：对标高阶函数 + AOP，FastAPI 的路由、pytest 的 fixture 全靠它。
5. **别用 print 调试**：直接上 `logging` + `ruff check`，养成工程习惯。

## 五、结语

学一门新语言，**用你已有的项目当练习素材**是最快的——因为你不需要想"做什么"，只需要想"怎么用新语言做"。我第一阶段做的记账 CLI，本质就是把一个前端 `store` 的增删查统计用 Python 重写了一遍，半天就能跑起来。

下一步我打算把团队里现成的能源数据 Excel 导入脚本（node 写的）用 Python 重写，正好是阶段 2 的练手。如果你也在前端转 Python 的路上，欢迎一起交流。
