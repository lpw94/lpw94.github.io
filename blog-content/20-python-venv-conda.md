## 为什么要做依赖隔离

Python 默认把包装到**全局** `site-packages`。问题立刻来：项目 A 要 `requests==2.25`，项目 B 要 `requests==2.31`，全局只能留一个——直接 `pip install` 会互相覆盖、互相污染，哪天你升级了全局包，老项目可能突然跑不起来。

虚拟环境 = 给每个项目**复制一份独立的 Python + 独立的 `site-packages`**。`pip install` 只装进当前 env，删 env 也不碰全局。

这也是很多前端转 Python 第一个踩的坑："为什么装完包别的项目炸了"——因为 Node **默认**每个项目自带 `node_modules` 天然隔离，而 Python **默认**装全局，得主动建 venv 才隔离。

## 隔离模型

把"全局解释器"和"项目级 env"拆开看就清楚了：

```
┌─────────────────────────────────────────┐
│  系统全局 Python                          │
│  site-packages：别人 / 老项目的包          │
│  （不希望被你当前项目污染）                │
└─────────────────────────────────────────┘
        │ 建 venv 后，复制出独立副本
        ▼
┌──────────────┐  ┌──────────────┐  ┌──────────────┐
│ 项目A/.venv  │  │ 项目B/.venv  │  │ 项目C/.venv  │
│ 只看得到自己 │  │ 只看得到自己 │  │ 只看得到自己 │
│ 的 site-packages│ 的 site-packages│ 的 site-packages│
└──────────────┘  └──────────────┘  └──────────────┘
   互不影响，删 env 不伤全局
```

## venv —— Python 标准库自带（推荐先学这个）

从 Python 3.3 起内置，**不需要装任何东西**。下面是一套可复制的完整链路，也是我本机实际跑过的。

### 1. 创建

```bash
# 在项目根目录创建（会生成 .venv/）
python -m venv .venv
```

我本机用的是 managed Python 3.13.12，实际建出来是 3.13.14：

```bash
C:\Users\lpw94\.workbuddy\binaries\python\versions\3.13.12\python.exe -m venv .venv
```

创建后 `.venv/Scripts/` 下会出现 `python.exe`、`pip.exe`、`activate` 等文件。

### 2. 激活 + 隔离验证

```bash
# Windows（cmd / Git Bash）
.venv\Scripts\activate
```

激活后命令行前缀会出现 `(.venv)`，`which python` 指向 `.venv/Scripts/python`——证明解释器已经被隔离到项目级。

### 3. 装包（只进这个 env）

```bash
pip install requests
```

我实测装成功了（PyPI 走代理可达）：

```
Successfully installed certifi-2026.10.18 charset-normalizer-3.5.2
idna-3.20 requests-2.34.2 urllib3-2.8.0
```

### 4. 导出可复现清单

```bash
pip freeze > requirements.txt
```

生成的 `requirements.txt`：

```text
certifi==2026.10.18
charset-normalizer==3.5.2
idna==3.20
requests==2.34.2
urllib3==2.8.0
```

别人拿到这份清单，一条 `pip install -r requirements.txt` 就能复现出一模一样的环境。

### 5. 退出

```bash
deactivate
```

### 关键一步：隔离证明

跑完之后我特意验证了"全局确实没被污染"：

| 检查项 | 结果 |
| --- | --- |
| 全局 managed 3.13 是否含 `requests` | **不含** —— 隔离成功 |
| 刚建的 venv 是否含 `requests` | **含** —— 装包只进了 env |

两者互不影响，这就是虚拟环境的价值。

> 坑提醒：`.venv/` 本身**不要提交 git**（你仓库 `.gitignore` 已加），只提交 `requirements.txt`。可以用 `git check-ignore .venv` 确认它确实被忽略了。

## conda —— 不止管 Python

`conda` 是第三方（Anaconda / Miniconda），它不是 pip 的替代品，而是**更大范围的包管理器**：

```bash
# 创建时可任意指定 Python 版本，还能装非 Python 的 C 库 / R 等
conda create -n funeng python=3.12

conda activate funeng
conda install numpy          # 优先 conda（自带编译好的原生库）
pip install ddddocr          # conda 里没有的再用 pip

conda env export > environment.yml   # 导出（含 Python 版本 + 所有依赖）
conda env create -f environment.yml  # 复现
conda deactivate
```

## venv vs conda 怎么选

| 维度 | venv | conda |
| --- | --- | --- |
| 来源 | 标准库（3.3+ 自带） | 第三方（Miniconda 几百 MB） |
| 管什么 | 只管 Python 包 | Python 包 + 非 Python 依赖（C 库、R…） |
| 能否指定 Python 版本 | 用哪个解释器建就用哪个 | 可任意 `python=3.12` |
| 适合 | 纯 Python 项目 | 数据科学 / ML（要编译好的原生库） |

**结论**：纯 Python 项目用 `venv` 就够，轻、快、零额外安装；只有要装大量带编译依赖的科学计算库（NumPy / PyTorch / OpenCV 的官方 wheel 不够时）才上 conda。你之前 `ddddocr→OpenCV` 在 3.13 翻车，用 `venv` + Python 3.12 也是标准解法之一。

## 和 Node 的对照（前端同学速记）

| 需求 | Node | Python |
| --- | --- | --- |
| 项目级隔离 | `node_modules`（默认就有） | `venv` / `conda env`（要手动建） |
| 装依赖 | `npm install` | `pip install` |
| 依赖清单 | `package.json` + `package-lock.json` | `requirements.txt` / `environment.yml` |
| 锁定运行时版本 | `nvm use` | venv 建在哪个 python 上就锁定哪个 |

## 和 funeng 现有做法对照

你现在的 `funeng_mqtt_sync` 走的是 **embeddable Python 3.12 + `.pth` 挂载源码**（`E:/workBuddy/pythonStudy/.py312/`）。它**本质上也是隔离**——那份 3.12 完全独立于系统 Python，没污染任何东西。差别只在"建 env 的方式"：

- **教科书做法**：装官方 Python 3.12 → `python3.12 -m venv .venv` → `pip install ddddocr`（自动进 `.venv/lib/site-packages`）
- **你的做法**：下 embeddable 3.12 压缩包解压 → 手动 bootstrap pip → 用 `.pth` 把项目源码挂进 `site-packages`

之所以走手动版，是因为本机没装 3.12 解释器（只有 managed 3.13/3.14，而 ddddocr 缺 cp313 轮子）。两种都能用，但 `venv` 更标准、能用 `requirements.txt` 一键复现，协作和迁移更省心。等你有空装个官方 3.12，把它换成正经 `venv` 会更顺手。

## 小结

- 虚拟环境解决的是"全局包互相覆盖"的问题，每个项目一份独立 `site-packages`；
- `venv` 是标准库自带的轻量方案，够纯 Python 项目用；`conda` 适合需要编译好原生库的科学计算场景；
- 记住那条命令链：`python -m venv .venv` → `activate` → `pip install` → `pip freeze > requirements.txt` → `deactivate`；
- 把 `requirements.txt` 提交 git，把 `.venv/` 加进 `.gitignore`；
- 它和 Node 的 `node_modules` 是同一类东西，只是 Python 默认不隔离、得主动建。

下一篇可以聊聊：有了干净的环境，怎么把 `funeng` 的练手脚本从"embeddable + `.pth`"平滑迁移到标准 `venv`。
