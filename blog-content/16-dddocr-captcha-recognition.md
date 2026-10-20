> 这是「前端工程师项目驱动学 Python」系列的练手篇。上一篇（`node-to-python-funeng-sync`）聊了把团队的 Node 水表同步脚本重写到 Python、以及 OpenCV 在 Python 3.13 上的轮子大坑；这一篇不聊端口，单把里面最有意思的一块——**用 ddddocr 做离线验证码识别**——单独拎出来，做成一个最小可运行的 Python 练手小工具。方法论总纲见 `python-project-driven-learning.md`。

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
