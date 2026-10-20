## 前言

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
