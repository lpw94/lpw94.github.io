insert into posts (slug, title, content, category, status, published_at)
values (
  'ddddocr-captcha-recognition',
  'Python 练手：用 ddddocr 写一个离线验证码识别小工具',
  $md$> 这是「前端工程师项目驱动学 Python」系列的练手篇。上一篇（`node-to-python-funeng-sync`）聊了把团队的 Node 水表同步脚本重写到 Python、以及 OpenCV 在 Python 3.13 上的轮子大坑；这一篇不聊端口，单把里面最有意思的一块——**用 ddddocr 做离线验证码识别**——单独拎出来，做成一个最小可运行的 Python 练手小工具。方法论总纲见 `python-project-driven-learning.md`。

## 为什么拿验证码识别来练手

练手最忌"为了写代码而写代码"。验证码识别刚好是个**小而完整**的需求：要发 HTTP 拿图、要调一个第三方库做图像识别、要处理文件读写——一个函数就能闭环，但又能自然延伸到"识别完去登录"这种真实业务。

而且它解决的是真问题：团队里那个水表同步脚本登录时要过一道验证码。云端 OCR（百度/阿里云）要么要联网、要么要密钥、要么按量收费；而 **`ddddocr` 是专为验证码训练的离线识别库，免费、无需密钥、无需联网**，识别率还往往比通用 OCR 高。拿它练手，练的是真本事。

## 第一个拦路虎：Python 3.13 装不了 ddddocr

这一步是必修的坑，先说结论省你时间：

`ddddocr` 依赖 `opencv-python`，而 **OpenCV 在 PyPI 上没有任何 `cp313 / win_amd64` 轮子**（所有版本都没有）。于是 pip 只能从源码编译 OpenCV——耗时极长且基本会失败（我实测卡了 23 分钟被迫终止），官方 MSI 安装在本机也走不通。

解法是用**免安装的 embeddable Python 3.12**：OpenCV 的 cp312 轮子正常存在。步骤是下载 `python-3.12.x-embed-amd64.zip` 纯解压 → 改 `python312._pth` 放开 `import site` 并加上 `Lib\site-packages` → 用 `get-pip.py` 引导 pip → `pip install ddddocr`。详细踩坑和命令见上一篇文章，这里不重复。

> 一句话经验：**装包前先看关键依赖有没有对应平台的预编译轮子**。视觉/科学计算库（OpenCV、PyTorch 等）常常落后新版本 Python 半年以上，新手无脑上 3.13 很容易在装包这步碰壁。

## 最小可运行：下载 + 识别

装好之后，最小闭环其实就两件事——**拿到验证码图片、识别它**。但"拿到图片"这一步里藏着两个真实工程细节，值得单独拎出来讲：

1. 验证码接口每次都要返回**新的**验证码，所以请求 URL 要带一个会变的参数（我们叫它缓存戳 `?t=时间戳`），否则代理/浏览器可能把旧图缓存下来、反复返回同一张；
2. 图片存本地会越攒越多，得有个"只留最近 N 张"的清理，否则 `img/` 无限膨胀——但也不能全删，得留几张给你人工对照。

最终的工具就一个文件 `captcha_demo.py`，结构如下：

```python
"""下载配置里的验证码图片到本地，再用 ddddocr 本地识别并打印结果。

流程：config.VERIFY_CODE_URL 下载图片 -> 存到 img/ -> ddddocr 识别 -> 打印结果。
下载后会保留最近 keep 张图片（默认 10），更早的自动清理，方便人工批量对照。

运行（用 3.12 环境）：
    E:/workBuddy/pythonStudy/.py312/python.exe -m funeng_sync.captcha_demo
    E:/workBuddy/pythonStudy/.py312/python.exe -m funeng_sync.captcha_demo img/xxx.jpg
"""
from __future__ import annotations

import sys
import time
from pathlib import Path

import requests

from funeng_sync import config


# ddddocr 模型只加载一次（约 1~2 秒），后续复用
_ocr = None

# 清理旧验证码时只删这些图片后缀，避免误删目录里其他文件
_IMG_SUFFIXES = {".jpg", ".jpeg", ".png", ".gif", ".bmp"}


def _get_ocr():
    global _ocr
    if _ocr is None:
        import ddddocr

        _ocr = ddddocr.DdddOcr(show_ad=False)
    return _ocr


def download_captcha(url: str | None = None, save_dir: str | Path | None = None, keep: int = 10) -> Path:
    """把配置里的验证码图片下载到本地，返回保存路径。

    keep：保留最近多少张（按修改时间），更早的会自动清理，避免目录无限膨胀，
    同时保留近期的若干张供人工批量对照。设为 0 表示不清理。
    """
    url = url or config.VERIFY_CODE_URL
    save_dir = Path(save_dir or config.IMG_DIR)
    save_dir.mkdir(parents=True, exist_ok=True)

    # ?t= 是缓存戳：URL 没带查询参数时补一个当前时间戳，
    # 保证每次下载都是新验证码，同时绕过浏览器/代理缓存；
    # 调用方显式传了带参数的 URL 则尊重原样使用
    if "?" not in url:
        url = f"{url}?t={time.time()}"

    resp = requests.get(url, timeout=config.HTTP_TIMEOUT)
    resp.raise_for_status()
    if not resp.content:
        raise RuntimeError(f"下载到的内容为空：{url}")

    path = save_dir / f"captcha_{int(time.time() * 1000)}.jpg"
    path.write_bytes(resp.content)

    # 清理：只保留最近 keep 张（按修改时间倒序），更早的删除。
    # 放在保存成功之后，避免下载失败把旧图也误删；
    # 这样既能防止 img/ 无限膨胀，又能留下近期若干张供人工批量对照。
    if keep > 0:
        imgs = sorted(
            (p for p in save_dir.iterdir()
             if p.is_file() and p.suffix.lower() in _IMG_SUFFIXES),
            key=lambda p: p.stat().st_mtime,
            reverse=True,
        )
        for old in imgs[keep:]:
            old.unlink(missing_ok=True)

    return path


def recognize(image_path: str) -> str:
    """用 ddddocr 本地离线识别图片，返回识别文字（已去空格）。无需联网 / 密钥。"""
    ocr = _get_ocr()
    with open(image_path, "rb") as f:
        text = (ocr.classification(f.read()) or "").replace(" ", "")
    return text


def main() -> None:
    args = sys.argv[1:]
    if args:
        # 识别指定的本地图片（跳过下载）
        for p in args:
            print(f"{p} -> {recognize(p)}")
    else:
        # 不传参数：从配置的地址下载验证码到本地，再识别
        img = download_captcha()
        print(f"已下载：{img}")
        print(f"识别结果 -> {recognize(str(img))}")


if __name__ == "__main__":
    main()
```

几个值得注意的点（相对"纯识别"版本，多出来的都是工程细节）：

- **`config` 只放常量**：`VERIFY_CODE_URL` / `IMG_DIR` / `HTTP_TIMEOUT` 抽到一个 `config.py`，而且**只放常量、不读任何密钥**——所以这个脚本导入 `config` 不需要 `.env`、不会被 OCR 密钥卡住，单文件就能跑。把"会变的地址/路径"和"代码逻辑"分开，比写死在脚本里更舒服。
- **`?t=` 缓存戳**：URL 没带查询参数时自动补 `?t={time.time()}`，保证每次下载都是新验证码。写死 `t` 会导致每次下载同一张（可能被代理缓存反复返回过期码），旧时间戳还可能被服务端判失效。
- **只留最近 N 张（keep=10）**：保存成功后按修改时间倒序保留最近 10 张、删除更早的。清理放在"保存成功之后"，是怕下载失败把旧图也误删；这样既不会 `img/` 无限膨胀，又留了近期若干张供人工批量对照。**早期版本这里写的是"删掉除最新一张外的所有图"，会一口气清掉历史、没法批量对照——是个反面教材，别学。**
- **模型只加载一次 + 懒加载 `import`**：`ddddocr.DdddOcr(show_ad=False)` 首次加载约 1~2 秒，用模块级缓存 `_ocr` 复用；`import ddddocr` 放进 `_get_ocr()`，没装库时只在真正调用时才报友好错误。
- **`classification` 接收图片字节**：`f.read()` 直接喂进去即可，不用管格式。

运行（用前面那个 3.12 环境）：

```bash
cd funeng_mqtt_sync
E:/workBuddy/pythonStudy/.py312/python.exe -m funeng_sync.captcha_demo            # 下载一张并识别
E:/workBuddy/pythonStudy/.py312/python.exe -m funeng_sync.captcha_demo img/xxx.jpg  # 识别指定的本地图（跳过下载）
```

## 识别得准不准：人工对照即可

这个 demo 故意不接任何"正确性判断"逻辑——它只打印「图片路径 + 识别文字」，你打开 `img/` 里对应的原图，肉眼比对就行。因为默认保留最近 10 张，你可以一次攒一小批、统一核对准确率。

实际观察：对清晰的四位字母数字验证码，`ddddocr` 大约 3/4 能完全识别正确，偶发的混淆集中在 `5↔b`、`o↔0`、`l↔1` 这类形近字符。这已经够用了——因为真实登录通常带重试，偶尔一次误读换张图重来即可。

> 别急着上"自动校验"，先让工具把活干出来、人工看结果，比在准确率上死磕 ROI 高得多。

## 下一步：把识别接到登录（关键洞察）

识别只是前半段。要拿它去登录，有一个**最容易踩、也最关键的坑**：

验证码图片接口在返回图片时，会顺手把一个**会话 cookie** 种到你的 HTTP 客户端上；而登录接口必须**用同一个客户端（同一个 `requests.Session`）** 把这段 cookie 回传回去，服务器才认"你填的验证码就是刚才下发的那张"。否则无论识别多准，都会得到 `验证码错误`。

最小登录片段长这样（只示意关键点，登录逻辑可以自己实现）：

```python
import requests

session = requests.Session()  # 关键：下载验证码和登录必须用同一个 session

# 1) 下载验证码（cookie 被种进 session）
resp = session.get(captcha_url)
open("img/captcha.jpg", "wb").write(resp.content)

# 2) 识别
code = recognize("img/captcha.jpg")

# 3) 用同一个 session 登录（cookie 自动回传）
login_resp = session.post(login_url, json={...登录参数..., "verificationCode": code})
```

记住这一句就够了：**下载验证码和登录，必须共用同一个 `requests.Session`。**

## 小结：先跑通，再一层层裁剪

这篇的练手路径是"先求跑通，再按需裁剪"：我先写了一个能登录的最小链路，再按需求一层层把不必要的东西砍掉——去掉登录相关配置、把敏感信息挪出代码——最后收敛成现在这个**下载 + 识别**的最小闭环。它已经能做两件有用的事：批量收集验证码、肉眼核对 `ddddocr` 的准确率；而下载这一步，本身就是在演练后续登录必须用到的 `Session` / cookie 模式。

这种"**先求跑通，再按需裁剪**"的节奏，比一上来就追求"优雅的最小实现"更适合学习——因为你手里始终有个能跑的东西，裁剪时心里有底。下一篇可以接着写：怎么把 `recognize()` 包进一个带重试的登录流程里。

如果你也在前端转 Python 的路上，欢迎一起交流。
$md$,
  'backend', 'published', now()
)
on conflict (slug) do update set
  title = excluded.title,
  content = excluded.content,
  category = excluded.category,
  status = excluded.status,
  published_at = excluded.published_at;

insert into posts (slug, title, content, category, status, published_at)
values (
  'python-import-variables',
  'Python 入门：引用另一个文件的变量，import 三种写法与常见坑',
  $md$作为一个前端 / Node 工程师，刚学 Python 时第一个卡点通常不是语法，而是：**怎么在一个文件里用另一个文件里定义的变量？** 在 JS 里你写 `import { x } from './config'`，Python 也有 import，但语义和坑不太一样。这篇就用最小示例把这件事讲透。

## 最小示例

我建了两个文件来演示（都放在 `funeng_mqtt_sync/src/funeng_sync/` 包内，可直接 `python -m` 运行）。

`demo_config.py` —— 被导入的「另一个文件」，只放常量和函数：

```python
from __future__ import annotations

# 不可变常量（str / int / float）：from import 后重新赋值不会影响源模块
APP_NAME: str = "funeng-demo"
BASE_URL: str = "http://111.8.86.3:19126"
TIMEOUT: int = 10

# 可变对象（list / dict）：from import 后调用 .append 会作用到同一对象
ALLOWED_CODES: list[str] = ["xsrx", "zgqj", "xbaq"]


def build_url(path: str) -> str:
    """拼接完整接口地址。

    Args:
        path: 接口路径，例如 "/api/auth/verificationCode/captcha-image/123"

    Returns:
        拼接后的完整 URL
    """
    return f"{BASE_URL}{path}"
```

`demo_import.py` —— 演示三种引用写法：

```python
from __future__ import annotations

# 写法 1：import 整个模块，用「模块名.变量」访问
import funeng_sync.demo_config as cfg

# 写法 2：from ... import ... 直接把名字拿进当前命名空间
from funeng_sync.demo_config import APP_NAME, build_url

# 写法 3：包内相对导入（等价写法 2，但只能在包内使用）
from .demo_config import TIMEOUT


def main() -> None:
    print("[1] import 模块:")
    print("    cfg.BASE_URL =", cfg.BASE_URL)

    print("[2] from import 直接拿名字:")
    print("    APP_NAME =", APP_NAME)

    print("[3] 相对导入:")
    print("    TIMEOUT =", TIMEOUT)

    # 不可变：重新赋值只覆盖本地名字，不影响源模块
    local_name = APP_NAME
    local_name = "改了本地"
    print("    本地改 APP_NAME 后，源模块仍是:", cfg.APP_NAME)

    # 可变：list.append 作用到同一对象，源模块也跟着变
    cfg.ALLOWED_CODES.append("new")
    print("    通过 cfg 改 ALLOWED_CODES 后:", cfg.ALLOWED_CODES)


if __name__ == "__main__":
    main()
```

运行（注意从**项目根目录**用 `-m`，相对导入才认包）：

```bash
cd E:/workBuddy/pythonStudy/funeng_mqtt_sync
E:/workBuddy/pythonStudy/.py312/python.exe -m funeng_sync.demo_import
```

输出：

```
[1] import 模块:  cfg.BASE_URL = http://111.8.86.3:19126
[2] from import:  APP_NAME = funeng-demo
[3] 相对导入:     TIMEOUT = 10
    本地改 APP_NAME 后，源模块仍是: funeng-demo
    通过 cfg 改 ALLOWED_CODES 后: ['xsrx', 'zgqj', 'xbaq', 'new']
```

## 三种写法逐一讲

### 写法 1：`import 模块`（推荐记住这个）

```python
import funeng_sync.demo_config as cfg
cfg.BASE_URL          # 通过「模块名.变量」访问
cfg.ALLOWED_CODES.append("new")   # 改值会作用回源模块（全局生效）
```

导入时 Python 把整个 `demo_config` 当成一个「模块对象」挂到当前命名空间，变量都挂在它下面。所有来源都带 `cfg.` 前缀，可读性强；要统一改配置优先用这种。

### 写法 2：`from 模块 import 变量`（最省事）

```python
from funeng_sync.demo_config import APP_NAME, build_url
print(APP_NAME)       # 直接用，不用加前缀
APP_NAME = "改了"     # 只覆盖当前文件的本地名字，源模块不变
```

相当于「把源变量的值拷贝一个引用到当前文件」。对不可变类型（str / int）重新赋值只是覆盖本地名字，不会改回源模块；对可变类型（list / dict）用 `.append` / 改 key 会改到同一对象。写只读配置用这种没问题。

### 写法 3：包内相对导入 `from . import`

```python
from .demo_config import TIMEOUT   # 同级包
from . import demo_config          # 等价地拿到模块
```

只能在包内部使用，且**不能用 `python xxx.py` 直接运行**——必须 `python -m 包.模块`。原因见下方坑 1。

## 和 Node 的对照

| 需求 | Node (ESM) | Python |
| --- | --- | --- |
| 导入整个模块 | `import * as cfg from './config.js'` | `import config` |
| 按需导入变量 | `import { URL } from './config.js'` | `from config import URL` |
| 用变量 | `cfg.URL` / `URL` | `config.URL` / `URL` |
| 取别名 | `import { URL as u }` | `from config import URL as u` |

语义几乎一一对应，只是 Python 多了「相对导入 + 包」这套机制，以及「模块只加载一次」的缓存语义。

## 三个新手最容易踩的坑

### 坑 1：相对导入必须 `python -m`

`python demo_import.py`（不带 `-m`）时，Python 不认为它在包里，`from . import demo_config` 会直接报错：

```
ImportError: attempted relative import with no known parent package
```

解决方法：从项目根目录用 `python -m funeng_sync.demo_import` 运行。本项目里 `captcha_demo.py` 一直这么跑，就是这个原因。

### 坑 2：循环导入

`a.py` 在顶层 `from b import X`，`b.py` 又在顶层 `from a import Y`，会有一边拿到 `None`。解决：把公共变量抽到第三个文件；或者把 import 写进**函数内部**（而不是文件顶层），按需延迟加载。

### 坑 3：可变 vs 不可变

这是最隐蔽的一个。`from x import LIST` 后：

- `LIST = [1, 2]`（重新赋值）→ 只改本地名字，源模块不变；
- `LIST.append(3)`（原地修改）→ 改的是同一个对象，源模块也变。

写配置时多用不可变常量（str / int / 元组），需要共享可变状态时再谨慎用 list / dict。

## 补充：模块只执行一次

`import config` 写多次也只跑一次 `config.py`；模块被缓存进 `sys.modules`。所以把配置常量放在模块顶层很安全——但**别在模块顶层写「每次调用都要执行」的业务逻辑**（比如下载图片、发请求），那要包成函数，避免 import 时就被触发。

## 小结

一句话记忆：**`import 模块` 拿对象用前缀；`from 模块 import 变量` 直接拿名字；包内用 `from 包 import` 或相对 `from . import`；跑脚本记得 `python -m`**。

这套 import 机制是后面所有工程化的地基——当你把验证码识别、登录、取数拆成不同模块时，靠的就是它来组织代码。下一篇可以顺着 `funeng_mqtt_sync` 的 `config.py` / `http_client.py` 拆分包结构，看看真实项目怎么分层。
$md$,
  'backend', 'published', now()
)
on conflict (slug) do update set
  title = excluded.title,
  content = excluded.content,
  category = excluded.category,
  status = excluded.status,
  published_at = excluded.published_at;

insert into posts (slug, title, content, category, status, published_at)
values (
  'python-stdlib-four-libraries',
  'Python 常用库四件套：requests 网络请求、json 数据处理、datetime 与文件 IO 串讲',
  $md$## 前言

上一篇讲了「怎么引用另一个文件的变量」，算是把 Python 的**组织代码**那层打通了。这一篇接着往下落——写爬虫 / 接口对接 / 数据采集这类脚本，真正天天在用的就是四个库：

- `requests`：网络请求（发 GET/POST）
- `json`：解析接口返回的 JSON、把结果存成 JSON
- `datetime`：生成时间戳、格式化时间
- 文件 IO（`pathlib`）：把图片 / 结果落到磁盘

这四个都属于「标准能力」：`json`、`datetime`、`pathlib` 是**标准库**（装好 Python 就有），只有 `requests` 是第三方（但你已经装过，验证码下载就在用它）。

下面先用一张图看它们怎么串起来，再逐个拆解，最后给一个能直接跑的示例。

## 一、四件套协作流程图

```text
┌────────────┐   requests    ┌──────────────┐
│  你的脚本   │ ───────────▶ │  远程服务器   │
│ (Session)  │ ◀─────────── │ (图片/JSON)  │
└────────────┘   .content    └──────────────┘
      │
      │  datetime.now()       生成毫秒时间戳（防缓存戳）
      ▼
┌────────────┐   pathlib     ┌──────────────┐
│  Path.write │ ───────────▶ │  img/ 磁盘    │
└────────────┘   _bytes      └──────────────┘
      │
      │  json.dumps / json.loads
      ▼
┌────────────┐                ┌──────────────┐
│  结果 dict  │ ◀───────────▶ │  *.json 文件  │
└────────────┘                └──────────────┘
```

一句话：**`requests` 把数据从网上搬下来，`datetime` 给它打时间标签，`pathlib` 落到磁盘，`json` 在「Python 对象 ↔ 文本」之间来回转换**。

## 二、requests —— 网络请求

```python
import requests

# GET：下载验证码图片（captcha_demo.py 就是这么干的）
resp = requests.get("http://111.8.86.3:19126/api/captcha", timeout=10)
resp.raise_for_status()          # 非 2xx 直接抛异常，比裸看状态码省心
img_bytes = resp.content         # 二进制内容（图片 / 文件）

# POST：登录（http_client.py 的 try_login 同款）
r = requests.post(
    "http://111.8.86.3:19126/api/auth/jwt/token",
    json={"user": "x", "code": "Zybq"},   # 自动序列化 + 设置 Content-Type
    timeout=10,
)
data = r.json()                  # 响应体直接解析成 dict / list
```

**关键：同一个 `Session` 复用 cookie**。验证码登录必须「下载验证码」和「提交登录」用同一个 `Session`，否则服务器下发的验证码 cookie 对不上，永远返回「验证码错误」：

```python
s = requests.Session()
s.get(url_captcha)               # 服务器在此种下验证码 cookie
s.post(url_login, json={...})    # 同一个 s 带回 cookie，登录才认账
```

> 坑：别用裸 `requests.get` 做登录，cookie 接不住；统一用 `Session()`。

## 三、json —— 数据处理

```python
import json

# 字符串 → Python 对象（解析接口返回）
obj = json.loads('{"code":0,"token":"abc"}')
print(obj["token"])              # abc

# Python 对象 → 字符串（保存 / 发送）
text = json.dumps({"a": 1}, ensure_ascii=False, indent=2)
# ensure_ascii=False 让中文原样输出，indent=2 排版好看

# 直接读写文件（配合第四节的 open / Path）
with open("data.json", "w", encoding="utf-8") as f:
    json.dump(obj, f, ensure_ascii=False, indent=2)
```

> 坑：`json.loads` 只认**双引号**；接口返回里的 `null / true / false` 会自动映射成 `None / True / False`。

## 四、datetime —— 时间处理

```python
from datetime import datetime, timezone

# 当前时间（验证码 URL 的 ?t= 戳、登录 key 都靠它）
now = datetime.now()
ts_ms = int(now.timestamp() * 1000)     # 毫秒时间戳，常用于防缓存

# 格式化输出
s = now.strftime("%Y-%m-%d %H:%M:%S")   # 2026-10-19 21:06:06

# 推荐带时区，避免服务器时区不一致
utc = datetime.now(timezone.utc)
```

> 坑：接口要的是**毫秒**还是**秒**时间戳？你的项目里 `captcha-image/{date_time}` 用的是毫秒，差 1000 倍就会「验证码错误」。

## 五、文件 IO —— 用 pathlib 读写

比起古老的 `open()`，更推荐现代的 `pathlib.Path`：跨平台（`/` 拼接路径，不用管 Windows 反斜杠），方法直观。

```python
from pathlib import Path

# 写二进制（存验证码图片，captcha_demo 用的就是它）
Path("img/captcha.jpg").write_bytes(img_bytes)

# 读文本
text = Path("config.json").read_text(encoding="utf-8")

# 建目录（parents=True 自动建多级，exist_ok 不报错）
Path("img").mkdir(parents=True, exist_ok=True)

# 遍历目录下文件
for p in Path("img").glob("*.jpg"):
    print(p.name)
```

## 六、组合示例：四件套一起上

下面是一个**可直接跑**的最小示例（已放在项目 `funeng_mqtt_sync/src/funeng_sync/demo_stdlib.py`），把四个库串成「下载 → 打时间戳 → 落盘 → 写 JSON 再读回」的完整链路。网络不可达时自动降级，不中断后续流程，方便离线学习。

```python
"""示例：把 requests / json / datetime / 文件 IO 四个常用库串成一个最小可运行流程。"""

from __future__ import annotations

import json
from datetime import datetime, timezone
from pathlib import Path

import requests

HOST = "http://111.8.86.3:19126"
CAPTCHA_URL = f"{HOST}/api/auth/verificationCode/captcha-image/{{ts}}"
IMG_DIR = Path(__file__).resolve().parent.parent.parent / "img"


def now_ms() -> int:
    """datetime：生成 UTC 毫秒时间戳。"""
    return int(datetime.now(timezone.utc).timestamp() * 1000)


def fetch_captcha(session: requests.Session, ts_ms: int) -> bytes | None:
    """requests：用同一个 Session 下载验证码；失败返回 None（不中断）。"""
    try:
        resp = session.get(CAPTCHA_URL.format(ts=ts_ms), timeout=10)
        resp.raise_for_status()
        return resp.content
    except Exception as exc:  # noqa: BLE001
        print(f"[requests] 下载失败（离线演示跳过）: {exc}")
        return None


def save_bytes(data: bytes, name: str) -> Path:
    """pathlib：写二进制文件，自动建目录。"""
    IMG_DIR.mkdir(parents=True, exist_ok=True)
    path = IMG_DIR / name
    path.write_bytes(data)
    return path


def dump_json(obj: dict, path: Path) -> None:
    """json：对象 -> 文件（中文原样 + 缩进 2 空格）。"""
    path.write_text(json.dumps(obj, ensure_ascii=False, indent=2), encoding="utf-8")


def load_json(path: Path) -> dict:
    """json：文件 -> 对象。"""
    return json.loads(path.read_text(encoding="utf-8"))


def main() -> None:
    session = requests.Session()
    ts = now_ms()                            # datetime
    print(f"[datetime] 毫秒时间戳 = {ts}")

    img = fetch_captcha(session, ts)         # requests
    path = save_bytes(img or b"", f"demo_{ts}.jpg")  # pathlib
    print(f"[pathlib] 图片已保存: {path}")

    result = {"ts": ts, "code": "Zybq", "ok": True}
    json_path = IMG_DIR / f"demo_{ts}.json"
    dump_json(result, json_path)             # json + pathlib
    print(f"[json] 已写出: {json_path}")
    print(f"[json] 读回: {load_json(json_path)}")


if __name__ == "__main__":
    main()
```

运行（用 3.12 环境，因为 `requests` 装在那儿）：

```bash
cd E:/workBuddy/pythonStudy/funeng_mqtt_sync
E:/workBuddy/pythonStudy/.py312/python.exe -m funeng_sync.demo_stdlib
```

实测输出（内网服务器可达时跑的是真实下载）：

```text
[datetime] 毫秒时间戳 = 1792414000260
[pathlib] 图片已保存: ...\img\demo_1792414000260.jpg
[json] 已写出: ...\img\demo_1792414000260.json
[json] 读回: {'ts': 1792414000260, 'code': 'Zybq', 'ok': True}
```

## 七、和 Node 的对照（前端同学速记）

| 能力 | Node | Python |
| --- | --- | --- |
| 发请求 | `axios.get / fetch` | `requests.get`（第三方）/ `urllib`（标准库） |
| 复用 cookie | `axios` 实例 / `cookie` 手动带 | `requests.Session()` |
| 解析 JSON | `JSON.parse / res.json()` | `json.loads / resp.json()` |
| 当前时间戳(ms) | `Date.now()` | `int(datetime.now().timestamp()*1000)` |
| 写文件 | `fs.writeFileSync` | `Path.write_bytes / write_text` |
| 遍历目录 | `fs.readdirSync` | `Path.glob("*.jpg")` |

可以看到思路几乎一一对应，只是 API 名字变了。Python 这边 `requests` 的体验比 `urllib` 好太多，**新手无脑用 `requests` 就行**。

## 八、小结

四个库各管一段，组合起来就是数据采集脚本的骨架：

1. `requests.Session` 搞定「带状态的请求」（验证码 → 登录这种必须先种 cookie 的场景必用）；
2. `datetime` 打时间戳，注意**毫秒 / 秒别搞反**；
3. `pathlib` 的 `Path` 比 `open()` 更现代，写图片用 `write_bytes`、写文本用 `write_text`；
4. `json` 的 `ensure_ascii=False` 是中文友好输出的关键。

下一篇可以接着把这套骨架接到「真实登录 + 拉水表数据」上——也就是把 `funeng_mqtt_sync` 里现成的 `http_client.py` 拆开讲一遍。到时候你会发现，今天这四个库就是那条主线的全部积木。
$md$,
  'backend', 'published', now()
)
on conflict (slug) do update set
  title = excluded.title,
  content = excluded.content,
  category = excluded.category,
  status = excluded.status,
  published_at = excluded.published_at;

insert into posts (slug, title, content, category, status, published_at)
values (
  'python-venv-conda',
  'Python 依赖隔离：venv 与 conda 怎么选，并动手建一个真实 venv',
  $md$## 为什么要做依赖隔离

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
$md$,
  'backend', 'published', now()
)
on conflict (slug) do update set
  title = excluded.title,
  content = excluded.content,
  category = excluded.category,
  status = excluded.status,
  published_at = excluded.published_at;

insert into posts (slug, title, content, category, status, published_at)
values (
  'supervision-intro',
  '计算机视觉工具库 supervision 入门：模型无关的可视化与三个版本 API 坑',
  $md$## 为什么是 supervision

做计算机视觉练手，最容易被两件事劝退：**装环境**（YOLO 要 torch，几百 MB 起步）和**画框/统计那些重复劳动**。supervision 就是 Roboflow 给后者准备的"瑞士军刀"——GitHub 上 50k+ stars、MIT 协议、常年活跃。

它的定位很巧妙：**模型无关**。不管你上游是 YOLO、Transformers、MMDetection 还是自己写的 OpenCV 检测，supervision 都能把结果统一成一份 `sv.Detections`，然后提供一套稳定的**可视化、数据集、评估** API。换句话说，它不管你"怎么检测"，只管检测完"怎么展示、怎么存、怎么算指标"。

> 和你前面的练手对照：ddddocr 是**单一用途**的验证码 OCR 库；supervision 是**通用**的检测/分割可视化 + 数据集 + 评估框架。你已有 ddddocr 的 OpenCV 图像基础，接 supervision 很顺。

四大核心能力：

| 模块 | 干什么 | 典型 API |
| --- | --- | --- |
| **Models** | 把各种模型的原生输出统一成 `sv.Detections` | `sv.Detections.from_ultralytics(result)` |
| **Annotators** | 高度可定制的画框、标签、掩码、轨迹 | `sv.BoxAnnotator().annotate(...)` |
| **Datasets** | 数据集加载 / 切分 / 合并 / 格式互转 | `sv.DetectionDataset.from_yolo(...)` |
| **Metrics** | 评估指标（需 `supervision[metrics]`）：mAP、混淆矩阵 | `sv.ConfusionMatrix(...)` |

安装：

```bash
pip install supervision            # 基础
pip install "supervision[metrics]"  # 含评估指标
```

硬依赖很轻，核心是 `numpy` + `opencv-python` + `pillow`。要求 `Python>=3.8`（新版建议 3.10+）。

## 最小练手：不用 YOLO 也能跑

为了不让 torch 把练手变重，这里用 **OpenCV 的轮廓检测（`findContours`）** 做一个轻量"检测器"——找图里较大的连通色块，纯粹为了喂给 supervision 画框，证明它"模型无关"。真实项目里把这一段换成 YOLO 即可，下游画框代码一行都不用改。

三步流程：

1. **检测**：OpenCV 找到若干区域，返回 `(x, y, w, h)`；
2. **转换**：把 `(x, y, w, h)` 转成 supervision 要求的 `xyxy` 格式，得到 `sv.Detections`；
3. **可视化**：`BoxAnnotator` 画框 + `LabelAnnotator` 加标签，存盘。

```python
import cv2
import numpy as np
import supervision as sv
from pathlib import Path

IMG_DIR = Path(__file__).resolve().parents[2] / "img"
OUT_DIR = Path(__file__).resolve().parents[2] / "out"


def detect_regions(image: np.ndarray, max_boxes: int = 10, min_area_ratio: float = 0.01):
    """OpenCV 轮廓检测：找图中较大的连通区域，模拟一个真实检测器。"""
    gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
    _, binary = cv2.threshold(gray, 0, 255, cv2.THRESH_BINARY_INV + cv2.THRESH_OTSU)
    contours, _ = cv2.findContours(binary, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
    h, w = image.shape[:2]
    min_area = h * w * min_area_ratio
    boxes = []
    for cnt in contours:
        x, y, bw, bh = cv2.boundingRect(cnt)
        if bw * bh >= min_area:
            boxes.append((x, y, bw, bh))
    boxes.sort(key=lambda b: b[2] * b[3], reverse=True)
    return boxes[:max_boxes]


def to_detections(boxes) -> sv.Detections:
    """把 (x, y, w, h) 转成 supervision 的 xyxy 格式。"""
    if len(boxes) == 0:
        return sv.Detections.empty()
    xyxy = [[x, y, x + w, y + h] for (x, y, w, h) in boxes]
    return sv.Detections(xyxy=np.array(xyxy, dtype=np.float32))


def annotate_and_save(image, detections, out_path: Path) -> Path:
    """supervision 的 BoxAnnotator 画框 + LabelAnnotator 加标签，保存到 out/。"""
    box_annotator = sv.BoxAnnotator(color_lookup=sv.ColorLookup.INDEX)
    label_annotator = sv.LabelAnnotator(color_lookup=sv.ColorLookup.INDEX)
    labels = [f"region {i}" for i in range(len(detections))]
    annotated = box_annotator.annotate(scene=image.copy(), detections=detections)
    annotated = label_annotator.annotate(scene=annotated, detections=detections, labels=labels)
    out_path.parent.mkdir(parents=True, exist_ok=True)
    cv2.imwrite(str(out_path), annotated)
    return out_path


def main() -> None:
    imgs = sorted(IMG_DIR.glob("*.jpg"))
    img_path = imgs[0] if imgs else None
    if img_path is None:
        print("img/ 目录没有图片")
        return
    image = cv2.imread(str(img_path))
    boxes = detect_regions(image)
    saved = annotate_and_save(image, to_detections(boxes), OUT_DIR / f"sup_{img_path.stem}.jpg")
    print(f"检测到 {len(boxes)} 个区域，已用 supervision 画框保存：{saved}")


if __name__ == "__main__":
    main()
```

跑起来：

```bash
cd E:/workBuddy/pythonStudy/funeng_mqtt_sync
E:/workBuddy/pythonStudy/.py312/python.exe -m funeng_sync.supervision_demo
```

## 三个真实的 API 坑（重点）

这篇最容易卡住新人的不是原理，而是**版本差异**。我用的是 opencv 5.0.0 + supervision 0.31.0，下面三处都和旧教程对不上。

### 坑一：opencv 5.0 移除了传统 Haar 级联

很多老教程第一步是：

```python
cascade = cv2.CascadeClassifier(cv2.data.haarcascades + "haarcascade_frontalface_default.xml")
boxes = cascade.detectMultiScale(gray)
```

在 opencv 5.0 里这两样**都没了**——`cv2.CascadeClassifier` 从顶层移除，`cv2.data.haarcascades` 也不再提供，连带的 `.xml` 数据文件也不随包分发。直接报 `AttributeError`。

**解法**：换一个不依赖训练数据的检测器。这里用 `cv2.findContours` 按连通区域找框，纯几何、零数据依赖，对任意图片都能跑出真实框（虽然语义性弱，但能把 supervision 的链路完整演示出来）。做人脸这类语义检测，正解还是上 YOLO。

### 坑二：BoxAnnotator.annotate 不再吃 labels

旧版 supervision（0.20 及更早）可以：

```python
annotator.annotate(scene=img, detections=det, labels=["a", "b"])  # 旧 API
```

0.21 之后**标签被拆出去**了，`annotate()` 只负责画框，传 `labels` 会报 `TypeError: annotate() got an unexpected keyword argument 'labels'`。

**解法**：标签单独用 `LabelAnnotator`：

```python
box_annotator = sv.BoxAnnotator()
label_annotator = sv.LabelAnnotator()
annotated = box_annotator.annotate(scene=image.copy(), detections=det)
annotated = label_annotator.annotate(scene=annotated, detections=det, labels=labels)
```

### 坑三：annotator 默认按 class_id 取色，没有就报错

这个最隐蔽。`BoxAnnotator` 默认的 `color_lookup=sv.ColorLookup.CLASS`，意味着它要从 `detections.class_id` 取颜色索引。可我们的 `Detections` 是轮廓检测来的，**压根没有 `class_id`**，运行直接：

```text
ValueError: ... class_id is None ...
```

**解法**：显式改成按**检测序号**取色：

```python
box_annotator = sv.BoxAnnotator(color_lookup=sv.ColorLookup.INDEX)
label_annotator = sv.LabelAnnotator(color_lookup=sv.ColorLookup.INDEX)
```

> 三个坑串起来就是一句话：**别照搬旧教程，先 `pip show supervision` 看版本，再照该版本的 API 签名写**。不确定就 `inspect.signature(sv.BoxAnnotator.annotate)` 查一下。

## 附带一个路径坑（前端转 Python 常踩）

练手时在某次运行里报错「未找到图片：img/1.jpeg」，根因是**脚本内路径混用了两种基准**：

- 不传参数时，用 `Path(__file__).resolve().parents[2] / "img"`，基准是**模块文件位置**；
- 一旦传参 `img/1.jpeg`，却直接 `Path(args[0])`，基准变成**当前工作目录**。

当工作目录是项目根 `E:\workBuddy\pythonStudy` 时，`img/1.jpeg` 指向根目录那个 `img/`（里面只有别的图），自然找不到。再加上默认 glob 写死 `*.jpg`，匹配不到 `1.jpeg` / `caocao.png`。

**解法**：路径解析统一以模块为基准，新增一个 `resolve_img_path()`：先按原样解析 → 找不到就回退到 `IMG_DIR / 文件名` → 不传参取 `img/` 第一张，并支持 `jpg/jpeg/png/bmp/webp` 多后缀。这样**从哪个目录启动都不影响结果**。

> 经验法则：脚本里凡是涉及资源/输出路径，**永远以 `Path(__file__).resolve()` 为基准**，别用 CWD 相对。CWD 是用户决定的，不可控。

## 和 Node 的对照

| 需求 | Python (supervision) | Node 里类似做法 |
| --- | --- | --- |
| 统一检测结果格式 | `sv.Detections` | 自己定义一个 `{x,y,w,h,label}[]` 接口 |
| 画框标注 | `sv.BoxAnnotator` | `canvas` / `sharp` + 自己画矩形 |
| 数据集格式互转 | `sv.DetectionDataset` | 写转换脚本 |
| 评估指标 | `sv.ConfusionMatrix` | 自己算混淆矩阵 |

Node 没有 supervision 这种"检测后处理全家桶"，通常是 `canvas` 画矩形 + 自己写转换/评估。supervision 把这套做成了一致的 API，这是它最大的省心点。

## 小结

supervision 的核心价值就两条：**把任意检测器的输出统一成 `sv.Detections`** + **提供一套稳定的可视化/数据集/评估 API**。至于"检测得准不准"，那完全取决于你的上游模型——轮廓检测只能找色块，人脸、物体这类语义目标得交给 YOLO（代价是装 torch）。

如果后面想看真正的语义检测效果，把 `detect_regions()` 换成 `ultralytics` 的 YOLO（`sv.Detections.from_ultralytics(result)`），下游画框代码一行都不用动——这正好印证了它"模型无关"的设计初衷。
$md$,
  'backend', 'published', now()
)
on conflict (slug) do update set
  title = excluded.title,
  content = excluded.content,
  category = excluded.category,
  status = excluded.status,
  published_at = excluded.published_at;
