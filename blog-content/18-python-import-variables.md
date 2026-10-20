作为一个前端 / Node 工程师，刚学 Python 时第一个卡点通常不是语法，而是：**怎么在一个文件里用另一个文件里定义的变量？** 在 JS 里你写 `import { x } from './config'`，Python 也有 import，但语义和坑不太一样。这篇就用最小示例把这件事讲透。

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
