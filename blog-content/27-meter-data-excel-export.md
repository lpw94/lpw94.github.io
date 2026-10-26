水表取数与 Excel 导出实战：五个接口契约陷阱，和一份报表该有哪些列

> 这是「前端工程师项目驱动学 Python」系列的续篇。前两篇写了验证码离线识别（[第 16 篇](https://lpw94.github.io/post/dddocr-captcha-recognition)）和敏感配置治理（[第 26 篇](https://lpw94.github.io/post/sensitive-config-externalization)），这一篇接着往下走：登录拿到 token 之后，怎么把数据取出来，又怎么变成一份人能看懂的 Excel。
>
> 主角是一个看似普通的接口调用——`GET /api/largeCustomer/operationManagement/meterRealTimeDataTable`，拉水表读数。我以为写完请求就结束了，结果从「发出请求」到「导出报表」之间，踩了五个和直觉相反的坑。
>
> 最有价值的一个，不是接口怎么调，而是：**JS 的隐式类型转换，没有 Python 对应物。**

## 一、先说结论：这次做了什么

| 项 | 结果 |
|---|---|
| 新增模块 | `meter_data.py`（取数）、`excel_export.py`（导出） |
| 真实数据 | 5 台水表，明细 879 条 |
| Excel | 4 个 sheet：汇总 / 明细 / 整点数据 / 趋势 |
| 单测 | 61 → 129 条 |
| lint | ruff 全绿 |

跑起来是这样：

```bash
# 只打印
E:/workBuddy/pythonStudy/.py312/python.exe -m funeng_sync.meter_data

# 顺便导出 Excel
E:/workBuddy/pythonStudy/.py312/python.exe -m funeng_sync.meter_data --excel
```

## 二、取数接口的四个契约

先说接口本身。这四点是原 Node 脚本里写明的、或者实测出来的，不是我猜的。

### 2.1 鉴权要带两处

```javascript
// 原 Node 脚本
headers: {
  'Tw-Authorization': token,
  Cookie: `userId=${USER_ID}; userName=${USER_NAME}; Tw-Authorization=${token};`,
}
```

`Tw-Authorization` 既要放在**请求头**里，也要放在 **Cookie** 里。Python 侧我原样照抄：

```python
def build_headers(token: str, user_id: str, user_name: str) -> dict[str, str]:
    """构造请求头。"""
    if not token:
        raise MeterDataError("取数需要 token：请先登录")
    if not user_id:
        raise MeterDataError(
            "取数需要 userId：登录响应里没拿到 data.userId，"
            "请在 .env 里配置 FUNENG_USER_ID 兜底"
        )

    return {
        "Content-Type": "application/json;charset=UTF-8",
        "Accept": "application/json, text/plain, */*",
        # 鉴权头：token 原样放进去（服务端认这个不带 Bearer 前缀）
        "Tw-Authorization": token,
        # Cookie 里也要带一份，原脚本就是这么写的——两个都带才拿得到数据
        "Cookie": (
            f"userId={user_id}; userName={user_name}; Tw-Authorization={token};"
        ),
        "User-Agent": _BROWSER_UA,
    }
```

只带一个会拿到空数据。这里有个顺带的改进：`userId` 不写死在代码里，而是**从登录响应的 `data.userId` 取**：

```python
user_id = result.user_id or config.USER_ID
```

换账号不用改代码。

### 2.2 时间区间必须跨天

参数是毫秒时间戳的**字符串**：

```python
return {
    "startDate": str(start),
    "endDate": str(end),
    "fmAddress": device.fm_address,
    "meterId": device.meter_id,
}
```

关键是 `start` / `end` 怎么取。原脚本用的是「昨天 0 点 → 今天 23:59:59.999」，我一开始想当然改成「今天 0 点 → 现在」，结果报表的「日用量」全错。

原因在业务语义：**水表读数是累计值**。它是水表从安装至今流过的总水量，不是某个时刻的瞬时读数。要算「昨天用了多少水」，必须拿「昨天末尾那一条」和「今天末尾那一条」相减——只查今天，压根看不到昨天的起点。

```python
def yesterday_start_millis() -> int:
    """dayjs().subtract(1, 'day').startOf('day') —— 昨天 0 点毫秒戳。

    用于 getData 的查询区间：只要"昨天 0 点 → 今天结束"，
    这样服务端返回的表里就一定含有昨天的累计流量。
    """
    return start_of_day_millis(datetime.now() - timedelta(days=1))
```

### 2.3 接口会拒绝 requests 的默认 UA

这个坑很隐蔽：不加 UA 时请求能发出去，但返回的数据不对。加上浏览器 UA 立刻正常：

```python
# 部分接口会拒绝 python-requests 的默认 UA，原脚本给 session 统一换了浏览器 UA。
# 只对取数接口加——验证码与登录那条链路已实测通过，不去动它。
_BROWSER_UA = (
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
    "(KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
)
```

注意这里只给取数接口加。登录链路实测是通的，动它反而引入不确定性——**已验证能用的东西别碰**。

### 2.4 所有错误都是 HTTP 200

这是全家桶接口的通病，成败只看 body 里的 `code`：

```python
CODE_SUCCESS = 0

def parse_rows(body: dict[str, Any]) -> list[MeterRow]:
    if "code" not in body:
        raise MeterDataError(f"取数响应缺少 code 字段：{body}")

    code = body.get("code")
    if code != CODE_SUCCESS:
        message = body.get("message", "")
        # 原脚本在这里判断 token 失效并重新登录。
        # 统一抛 TokenExpiredError，让调用方决定要不要重新登录。
        raise TokenExpiredError(
            f"取数失败：code={code} message={message!r}（token 可能已失效）"
        )
```

`TokenExpiredError` 单独拆一类，理由是**处理方式不同**：其他错误重试也没用，只有这一个值得重新走一遍登录流程。

```python
class MeterDataError(RuntimeError):
    """取数失败（接口报错、响应结构异常等）。"""


class TokenExpiredError(MeterDataError):
    """token 失效——需要重新登录后重试。"""
```

注意 `table` 字段缺失**不是错误**：

```python
table = data.get("table")
if table is None:
    # 没有 table 字段 ≠ 报错，可能只是当天没数据。
    return []
```

## 三、最值钱的一个坑：readTime 是毫秒时间戳

这个坑差点让整条链路静默失效，而且**不报任何错**。

### 3.1 症状

我的整点过滤函数是这样的：

```python
def is_top_of_hour(raw: object) -> bool:
    """dayjs(readTime).minute() === 0 —— 是否整点。"""
    try:
        return parse_read_time(raw).minute == 0
    except Exception:
        return False
```

看起来没问题。跑真实数据，输出是：

```
共 129 条读数，其中整点 0 条（上报时只取整点）
```

**0 条。** 一条整点数据都没匹配上。

### 3.2 根因

原 Node 脚本的整点判断是：

```javascript
dayjs(readTime).minute() === 0
```

而接口返回的 `readTime` 实测是**毫秒时间戳**：

```
"readTime": 1792800000000
```

`dayjs` 接受数字毫秒时间戳——传进去就当 Unix 毫秒解析。这在 JS 里是**隐式类型转换**，写代码的人根本不会意识到这里有个类型问题。

Python 侧我原来的实现是：

```python
def parse_read_time(raw: object) -> datetime:
    s = str(raw).replace("Z", "+00:00")
    return datetime.fromisoformat(s)
```

`fromisoformat("1792800000000")` 抛 `ValueError` → 被 `except Exception` 吞掉 → 返回 `False`。

**注意这个失败的形状：它不报错。** 它返回一个看起来完全合理的 `False`。如果不做对照，我完全不会知道 129 条数据里有 33 条本该被选中。

### 3.3 修法：先认数字，再认字符串

```python
def parse_read_time(raw: object) -> datetime:
    """把 readTime 解析成 datetime。

    接口返回的 readTime 实测有三种形态：

    1. **毫秒时间戳**（最常见）：``1792800000000``，可能是 int 也可能是字符串；
    2. ``"2026-10-13 00:00:00"``；
    3. 带 Z 的 ISO 8601：``"2026-10-13T08:00:00Z"``。

    ⚠️ 第 1 种是**最容易漏掉**的：原 Node 脚本用 ``dayjs(readTime).minute() === 0``
    判断整点，而 dayjs 接受数字毫秒时间戳。Python 侧若只按 ISO 字符串解析，
    会走到 except 分支返回 False——**整点过滤全军覆没，一条都不上报**，
    而且不报错，只是安静地少发数据。

    所以这里必须先认数字，再认字符串。
    """
    # 毫秒时间戳：int / float，或纯数字字符串
    if isinstance(raw, bool):  # bool 是 int 的子类，要先排除
        raise ValueError(f"不是合法的时间：{raw!r}")
    if isinstance(raw, (int, float)):
        return datetime.fromtimestamp(raw / 1000)
    if isinstance(raw, str):
        stripped = raw.strip()
        if stripped.isdigit():
            return datetime.fromtimestamp(int(stripped) / 1000)
        # 把 Z 换成 +00:00 再交给 fromisoformat
        return datetime.fromisoformat(stripped.replace("Z", "+00:00"))
    raise ValueError(f"不是合法的时间：{raw!r}")
```

`isinstance(raw, bool)` 那一行不是洁癖——`bool` 是 `int` 的子类，`True` 会被当成毫秒时间戳 1，静默解析成 1970 年。

修完之后的实测：

```
共 129 条读数，其中整点 33 条（上报时只取整点）
```

**33 / 129**。这个数字正好对上原 Node 脚本 `slice(0, 33)` 的设计意图——一天多的整点数据。修复前是 0，修复后是 33。

### 3.4 这条经验的普适性

> **移植代码时，JS/Python 的隐式类型转换必须逐个查清。**
>
> JS 有一大堆「能吃就吃」的行为：`dayjs(数字)`、`dayjs("2026-10-13")`、`new Date("2026-10-13 08:00:00")` 都能跑。Python 的对应函数通常很严格——`fromisoformat` 遇到数字字符串直接抛异常。
>
> 而**异常被吞掉之后，函数返回一个语义上合理的默认值**（`False` / `None` / `0`），于是 bug 变成「数据莫名其妙少了一截」，而不是「报了个错」。
>
> 排查这类问题的通用手法：**拿原始返回值去打印，而不是拿解析后的结果去打印。**

我的排查过程就是这么走的——先写了个探针脚本把原始 JSON 打出来：

```python
print(json.dumps(rows[0], ensure_ascii=False, indent=2))
```

一眼就看到 `"readTime": 1792800000000`。如果我一开始就是拿解析后的 `datetime` 去排查，会一直以为是「时区不对」。

## 四、Excel 导出：先探字段，再设计列

拿到数据之后，我原本想直接写个简单的 CSV。但转念一想——**这份数据是要给人看的**，而人要看的表，列的设计本身就是需求。

所以我先写了个探针脚本，把接口返回的每行所有字段打出来：

```python
for item in table[:3]:
    print(json.dumps(item, ensure_ascii=False, indent=2))
```

打出来是这样（真实字段名）：

```json
{
  "readTime": 1792800000000,
  "totalFlux": 438940.97,
  "flux": 1.462,
  "plusTotalFlux": 438940.97,
  "reverseTotalFlux": 0.0,
  "receiveTime": 1792800000000
}
```

四个字段，四个和直觉相反的地方。

### 4.1 `totalFlux` 是净值，不是单调累计量

我先验证了一个恒等式：

```python
# 逐条检查：totalFlux == plusTotalFlux - reverseTotalFlux
# 实测 5 台表 879 条数据，0 处不符
```

**成立**。这意味着 `totalFlux` 会**下降**——因为 `reverseTotalFlux` 在涨。

实测有一台表，129 条里 **56 次下降**。

后果很直接：**不能用「末值 − 首值」当总用水量。**

那台表的实际数据是：

| 口径 | 值 |
|---|---|
| 区间正向用量 | 70.56 |
| 区间反向用量 | 32.96 |
| 区间净用量 | 37.59 |

只看净值 37.59，会以为「这表今天用了 37.59 方水」；实际上它**正向流过 70.56 方**（还有 32.96 方是反着走的回水/串表干扰）。

所以汇总表给了三个口径，不是一个：

```python
net_usage = total_last - total_first
plus_usage = plus_last - plus_first
reverse_usage = rev_last - rev_first
```

### 4.2 `flux` 是瞬时流速，不是用量

名字叫 flux，很容易当成「流量」直接求和。我验证了一下相邻两条的差值：

```
ΔtotalFlux ≈ flux × 0.25      # 0.25 小时 = 15 分钟
```

比例接近但**不恒定**。它是流速（方/小时），不是用量（方）。

**后果：不能对 `flux` 求和当用量。** 明细表里的「本期用量」一律用累计量差值算：

```python
net_delta = total - prev_total
plus_delta = plus - prev_plus
```

### 4.3 采样粒度不统一

5 台表实测：

| 设备 | 采样条数 | 采样间隔 |
|---|---|---|
| A | 129 | 15 分钟 |
| B | 129 | 15 分钟 |
| C | 129 | 15 分钟 |
| D | **363** | **5 分钟** |
| E | 129 | 15 分钟 |

**条数多 ≠ 采得久。** 那台 363 条的不是因为时间跨度长，是因为采得更密（同样的 32 小时，5 分钟一采就是 363 条）。

横向对比时如果不标粒度，一定会误读成「D 表用水多」或「D 表数据全」。

间隔怎么算？用**中位数**，不用平均值：

```python
def _sample_interval_minutes(rows: list[dict[str, Any]]) -> int | None:
    """估计采样间隔（分钟）——取相邻时间差的中位数。

    用中位数而不是平均值：偶发的时间跳变（补传数据会让某些点密集）
    会把平均值拉偏，中位数更稳。
    """
    times = sorted(t for t in (_dt(r.get("readTime")) for r in rows) if t is not None)
    if len(times) < 2:
        return None

    gaps = []
    for a, b in zip(times, times[1:], strict=False):
        minutes = (b - a).total_seconds() / 60
        if minutes > 0:
            gaps.append(minutes)
    if not gaps:
        return None

    gaps.sort()
    mid = len(gaps) // 2
    if len(gaps) % 2:
        return int(round(gaps[mid]))
    return int(round((gaps[mid - 1] + gaps[mid]) / 2))
```

### 4.4 `receiveTime` 是批量补传时间

这个字段一开始我不知道是干什么的。探测了一下：129 条数据里，`receiveTime` 只有 **5 个唯一值**，但和 `readTime` 的差值是连续递增的，最大差到 **7.77 小时**。

同一批几十条共用一个 `receiveTime`——这是**平台批量补传**的时间戳。

**这意味着数据不是实时上报的。** 如果拿它做实时监控看板，7.77 小时的延迟会让人完全误判。

所以明细表专门给了一列：

```python
def _delay_minutes(read_raw: Any, receive_raw: Any) -> float | None:
    """数据延迟（分钟）= 接收时间 - 读数时间。

    实测 `receiveTime` 是平台**批量补传**的时间戳：同一批里几十条
    读数共用一个 receiveTime，与 readTime 相差最多 7.77 小时。
    所以这个差值反映的是「数据补传滞后」，不是单表通信延迟。
    """
```

## 五、四个 sheet 的设计

列的语义定下来之后，sheet 的划分就是自然结果。

| Sheet | 内容 | 为什么单独一个 |
|---|---|---|
| **汇总** | 每台表一行：区间用量、条数、粒度、时间跨度、备注 + 用量对比柱状图 | 一眼看哪台表在用 |
| **明细** | 879 条逐条列出，含本期用量差值、数据延迟，开筛选 | 要逐条排查时用 |
| **整点数据** | 163 条，只留整点 | **上报口径在文件里一眼可见** |
| **趋势** | 371 个时间点 × 5 台表的透视表 + 折线图 | 看走势 |

### 5.1 「整点数据」为什么要单列一个 sheet

下一阶段是 MQTT 上报，而上报只发整点数据。这个口径如果只存在于文档里，读者得自己拿明细去筛一遍才能确认「上报的到底是哪些」。

**单列一个 sheet，是让口径成为文件的一部分**，而不是文件之外的一条说明。

### 5.2 差值计算的一个细节

写「整点数据」sheet 时，我最初写成「只遍历整点行，算相邻差值」。这是错的。

```python
for row in rows:
    is_top = is_top_of_hour(read_time)
    if top_only and not is_top:
        # 整点 sheet 也要算差值——不能因为跳过了非整点行
        # 就把差值算错（差值是「相邻两条」，不是「相邻整点两条」）
        t = _num(row.get("totalFlux"))
        p = _num(row.get("plusTotalFlux"))
        if t is not None:
            prev_total = t
        if p is not None:
            prev_plus = p
        continue
```

差值是「这一条减上一条」，**上一条是上一条读数，不是上一条整点读数**。跳过非整点行时，得把 `prev_*` 往前推进，否则差值会算成「隔了一整段」的量。

顺便说，服务端返回的是**倒序**（最新在前），算差值前必须**升序排**：

```python
def _sort_rows(rows: list[dict[str, Any]]) -> list[dict[str, Any]]:
    """把一个设备的读数按时间**升序**排。

    服务端返回的是**倒序**（最新在前）——原 Node 脚本直接 slice(0, 33)
    截的是「最新的 33 条整点」。升序排是算「本期用量差值」的前提：
    差值必须是「这一条 减 上一条」，方向反了符号就全错。
    """
```

方向反了的话，所有用量都会变成负数——但因为是净额，可能看着还挺合理，不容易发现。

## 六、修掉一个我自己写错的判定

汇总表有个「备注」列，用来标注「读这张表时容易看错的地方」。我第一版写的是：

```python
# ❌ 第一版
if reverse_usage is not None and net_usage is not None and net_usage > 0:
    if reverse_usage > net_usage:
        notes.append("反向流量显著")
```

这个条件**几乎永远不成立**。反向要超过净，意味着净已经被反向吃光了。

而真正危险的区间恰恰是那个「看着完全正常」的：

| 口径 | 值 |
|---|---|
| 正向 | 70.56 |
| 反向 | 32.96 |
| 净 | 37.59 |

净还有 37.59，看着很正常——但单看净用量会低估将近一半的过水量。这正是**最该被提示**的场景，却被我的条件漏掉了。

改成**占比**判定：

```python
# 反向占正向的比例超过 10% 就要提醒：净用量会显著低估实际过水。
#
# 这里用**占比**而不是「反向 > 净」。早期版本写的是
# `reverse_usage > net_usage`，几乎永远不成立：反向要超过净，
# 意味着净已经被反向吃光了。而真正危险的区间恰恰是
# 正向走了 70、反向倒回 33（占 47%）——净还有 37 看着完全正常，
# 但单看净用量会低估将近一半的过水量。
if (
    reverse_usage is not None
    and plus_usage is not None
    and reverse_usage > 0
    and plus_usage > 0
):
    ratio = reverse_usage / plus_usage
    if ratio >= 0.1:
        notes.append(f"反向流量显著（占正向流量的 {ratio:.0%}）")
```

改完之后实测的汇总表：

```
设备   条数  整点  间隔  净用量   正向     反向     备注
A      129   33    15    37.59    70.56    32.96    反向流量显著（占正向流量的 47%）
B      129   33    15    187.34   187.31   0        -
C      129   33    15    350.28   350.28   0        -
D      363   31    5     1.23     1.376    0.151    反向流量显著（占正向流量的 11%）
E      129   33    15    484.72   484.72   0        -
```

这台 47% 的表被标出来了，那台 11% 的也标了（三台没有反向流量的标 `-`）。

**这条判定必须有回归测试**，不然下次重构就悄悄改回去了：

```python
class TestReverseRatioNote:
    """反向流量占比的备注判定。

    这条是真实 bug 的回归测试：早期实现写成
    `reverse_usage > net_usage`，而反向要超过净意味着净已被吃光，
    条件几乎永远不成立——正好漏掉最该提示的场景
    （正向 70 / 反向 33，净还有 37 看着正常，实际少算了近一半）。
    """

    def test_flags_reverse_when_net_still_positive(
        self, devices, tmp_path: Path
    ) -> None:
        """净用量为正但反向占正向 47% → 必须提示。"""
        data = {
            "DEV-G": [
                _row(T0 + M15, 137.59, plus=170.56, reverse=32.96),
                _row(T0, 100.0, plus=100.0, reverse=0.0),
            ]
        }
        wb = _read(export_to_excel(data, tmp_path / "o.xlsx", devices=devices))
        ws = wb["汇总"]
        note = ws.cell(row=2, column=14).value
        assert "反向流量显著" in note
```

## 七、自查脚本又抓了我一次

上一篇文章里我写过 `check_secrets.py`，扫工作区 + git 历史里的敏感信息。这次导出 Excel 加了新的内容，跑一遍自查：

```
⚠ 发现 3 处疑似敏感内容：
  • [水表设备编号] src/funeng_sync/excel_export.py:17
  • [水表设备编号] src/funeng_sync/meter_data.py:58
  • [水表设备编号] README.md:111
```

全是我自己写的**注释和文档字符串**里举的例子——我为了说明「反向流量占 47%」这个案例，把真实的设备编号写进了注释。

上一篇文章里我就写过这条规矩：**注释同样进版本库**。结果这次自己又犯了。改成只描述格式、不给具体样例：

```python
    (
        "水表设备编号",
        # 设备编号形如 XT 加 6 位数字 —— 是厂区水表的真实编号。
        # 它不是凭据，但公开仓库里出现等于把厂区水表清单送上门，
        # 和地址、账号属于同一性质，所以一并拦。
        #
        # 只拦 6 位以上的：真实编号是 XT + 6 位数字，占位符用 XT + 3 位
        # （如 XT001）就不会被误伤。
        re.compile(r"\bXT\d{6,}\b"),
        "真实设备编号（XT + 6 位以上数字），应移到 .env 的 FUNENG_DEVICES 里",
    ),
```

顺便把设备清单也外置了——它和地址、账号是同一性质：

```bash
# .env
FUNENG_DEVICES=[{"fmAddress":"...","meterId":"...","deviceCode":"..."}]
```

## 八、导出本身也有两个工程细节

### 8.1 缺依赖时的报错要能指路

这个项目有**三套 Python 环境**（`.venv` 3.13 跑单测、`.py312` 3.12 跑 OCR、还有 uv）。所以「No module named openpyxl」这种默认报错完全不够用——用户根本不知道该往哪个环境装。

```python
def _require_openpyxl() -> Any:
    """导入 openpyxl，没装时给出能指路的报错。

    这个项目有三套 Python 环境（.venv / .py312 / uv），
    光说「No module named openpyxl」用户根本不知道该往哪个环境装。
    """
    try:
        import openpyxl  # noqa: PLC0415
    except ImportError as e:
        raise ExportError(
            "缺少 openpyxl，无法导出 Excel。\n"
            "  3.12 环境（跑取数的那个）："
            " E:/workBuddy/pythonStudy/.py312/python.exe -m pip install openpyxl\n"
            "  3.13 环境（跑单测的）："
            " funeng_mqtt_sync/.venv/Scripts/python.exe -m pip install openpyxl"
        ) from e
    return openpyxl
```

顺带一个设计选择：`openpyxl` 是**延迟导入**的，不放在模块顶层。

```python
    # 延迟导入 excel_export：openpyxl 没装时也要能正常跑完取数打印，
    # 只在真的要导出时才报缺依赖。
    from funeng_sync.excel_export import (
        ExportError,
        default_output_path,
        export_to_excel,
    )
```

理由和登录模块里的 `ddddocr` 一样：**可选依赖不该拖垮主流程。** 没装 openpyxl 的人照样能跑取数打印。

### 8.2 输出路径带时间戳

```python
def default_output_path(prefix: str = FILE_PREFIX) -> Path:
    """生成默认输出路径：out/水表数据_YYYYMMDD_HHMMSS.xlsx。

    带时间戳是为了让多次导出不互相覆盖——取数是每天都在做的事，
    昨天的报表不该被今天的覆盖掉。
    """
    stamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    return OUT_DIR / f"{prefix}_{stamp}.xlsx"
```

另外 `out/` 必须在 `.gitignore` 里——**Excel 里含真实表号**。

### 8.3 CLI 参数的一个小设计

```python
# `--excel` 不带路径时用它占位：走默认输出目录（out/水表数据_<时间戳>.xlsx）。
# 用一个显式常量而不是 None，是因为 None 已经被「不导出」占用了。
DEFAULT_EXCEL_FLAG = "__default__"
```

`--excel` 是一个可选值的参数：

```bash
python -m funeng_sync.meter_data --excel                    # 导出到默认路径
python -m funeng_sync.meter_data --excel D:/x.xlsx           # 导出到指定路径
python -m funeng_sync.meter_data                             # 不导出
```

三种状态里，`None` 已经被「不导出」占了，所以需要一个哨兵值区分「不导出」和「导出到默认路径」。

## 九、验证

不能只看「文件生成了」，得**回读验证数字对得上**。我写了个验证脚本，把汇总表的净用量和明细表逐条推算的结果对一遍：

```python
# 汇总表的「区间净用量」必须等于明细表累加出来的差值
for code, rows in payload.items():
    summary_net = summary_sheet_lookup[code]
    detail_net = sum(row.net_delta for row in detail_rows_of(code))
    assert abs(summary_net - detail_net) < 1e-6
```

实测 **5 / 5 一致**。

完整检查项：

| 项 | 结果 |
|---|---|
| 单测 | 61 → **129 passed** |
| ruff | All checks passed |
| 敏感自查 | 工作区 + git 历史均干净 |
| 真实环境 | 5 台表导出成功 |
| 数字一致性 | 汇总 vs 明细推算 **5/5 一致** |

## 十、几条能直接用的经验

1. **移植代码时，隐式类型转换必须逐个查清。** JS 的 `dayjs(数字)` 在 Python 里没有对应物，而失败形态是「返回默认值」而不是「抛异常」——这类 bug 不报错，只是安静地少数据。
2. **排查先打原始值。** 拿解析后的结果排查会一直在错的方向上找原因。
3. **接口字段的语义要靠恒等式验证，不能靠字段名猜。** `totalFlux` 叫「累计流量」，但 `totalFlux == plusTotalFlux - reverseTotalFlux` 才告诉了你真相。
4. **报表的列 = 业务语义 + 容易看错的地方。** 「区间正向/反向/净」三列不是冗余，是三种不同的问题。
5. **判定的边界条件要用真实案例验证。** `反向 > 净` 写出来很合理，真实数据一跑就露馅——而且露的是「漏报」不是「误报」，更隐蔽。
6. **异常要按「处理方式」分类，不按「原因」分类。** `TokenExpiredError` 单独拆出来，是因为只有它值得重新登录。
7. **注释和文档字符串同样进版本库。** 我在这件事上已经犯了两次。

---

*配套代码：[`funeng_mqtt_sync`](https://github.com/lpw94/pythonStudy/tree/dev/funeng_mqtt_sync) · 取数模块 [`meter_data.py`](https://github.com/lpw94/pythonStudy/blob/dev/funeng_mqtt_sync/src/funeng_sync/meter_data.py) · 导出模块 [`excel_export.py`](https://github.com/lpw94/pythonStudy/blob/dev/funeng_mqtt_sync/src/funeng_sync/excel_export.py) · 时间工具 [`time_utils.py`](https://github.com/lpw94/pythonStudy/blob/dev/funeng_mqtt_sync/src/funeng_sync/time_utils.py) · 导出单测 [`test_excel_export.py`](https://github.com/lpw94/pythonStudy/blob/dev/funeng_mqtt_sync/tests/test_excel_export.py)*
