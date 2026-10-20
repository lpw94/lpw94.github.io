> 这是「前端工程师项目驱动学 Python」系列的第二篇实战。第一篇聊了路线和个人记账 CLI（见 `python-project-driven-learning.md`）；这一篇直接拿团队里一个真实 node 脚本，用 Python 完整重写一遍，并记录两个真正踩到的坑。

把别人写好的脚本用新语言重写，是练手性价比最高的方式——需求你门儿清，不需要想"做什么"，只需要想"怎么用新语言做"。这次的素材是一个水表数据同步脚本 `funeng_api_iemp/node/index.js`。

## 一、原脚本在干什么

一句话：**登录 → 拉水表小时数据 → 经 MQTT 上报**。拆解后是这条链路：

1. 拉取验证码图片（接口会下发一个会话 cookie）；
2. OCR 识别验证码；
3. 带着 cookie + 验证码 POST 登录拿 token；
4. 用 token 拉取每台水表的"实时数据表"；
5. 只对"整点"那条数据，组装 payload 发布到 MQTT。

原 JS 用了一堆 `setTimeout` 递归 + 全局变量来调度，读起来像意大利面。重写的目标不是"运行结果一样"就行，而是**把逻辑收纳成清晰的分层**，同时 1:1 保留业务行为。

## 二、技术栈映射（前端/Node → Python）

这是我最喜欢的环节，把熟悉的东西逐个对号入座：

| 原 Node | Python | 说明 |
|---------|--------|------|
| `axios` / `fetch` | `requests` | HTTP 客户端 |
| `mqtt` (mqtt.js) | `paho-mqtt` | MQTT 发布 |
| `dayjs` | `datetime` | 时间处理（毫秒、整点判断） |
| `fs` / `path` | `pathlib` | 文件落盘 |
| `setInterval` 倒计时 | `while + time.sleep` | 主循环 |
| 全局变量 + `setTimeout` 递归 | 一个持有状态的 class | 消除递归嵌套 |
| 命令行启动 | 模块入口 `python -m` | —— |

最终目录（分层思路和前端的 `store / service / api` 一致）：

```
funeng_mqtt_sync/
├── src/funeng_sync/
│   ├── config.py        # 全局常量（host / MQTT / 设备列表 / 重试策略）
│   ├── time_utils.py    # 毫秒、起止日、整点判断（dayjs 等价）
│   ├── http_client.py   # 下载验证码 / OCR / 登录 / 拉数据
│   ├── mqtt_client.py   # paho 连接与发布
│   ├── sync.py          # 登录流程 + 取数发布 + 8h 主循环
│   └── main.py          # 入口
├── tests/               # pytest（保留"识别失败"等分支的用例）
├── pyproject.toml       # 依赖 + ruff / pytest 配置
└── run.bat              # 启动脚本
```

## 三、第一个坑：验证码识别选百度云，报了 error_code=6

验证码识别有两个思路：**云端 OCR**（百度通用文字识别）和**本地离线识别**（`ddddocr`）。我一开始用了百度云，结果一跑就报：

```
INFO OCR 原始返回 status=200 body={"error_code":6,"error_msg":"No permission to access data"}
```

`error_code=6` 的字面意思是"应用没有该接口权限"。我用真实请求验证了一下，定位过程很关键：

- 换 `access_token` **成功** → 说明 AK/SK 本身有效、没写错；
- `general_basic` 和 `accurate_basic` 两个接口**都**返回 6 → 说明这个 AK/SK 所属的应用压根没在百度控制台勾选"通用文字识别"。

结论：**不是代码 bug，是应用没开通接口**。而且容易踩一个隐蔽点——百度不同产品线（文字识别 / 图像识别 / 千帆大模型）的 AK/SK **不通用**，你拿"图像识别"应用下的密钥去调 OCR 接口，照样 6。解决办法是去"文字识别 OCR"控制台新建应用并勾选接口。

> 给后来者：这种"接口返回错误码"的问题，最忌讳瞎改代码。先写个只验证"换 token + 识别"的**自检脚本**（不登录、不连 MQTT），把每一步结论打出来，问题一眼就定位了。

## 四、第二个坑（更硬）：Python 3.13 装不了 ddddocr

我索性切到**本地离线识别** `ddddocr`（专为验证码训练，无需联网和密钥，对带干扰线的验证码识别率比通用 OCR 还高）。结果卡了 23 分钟装不上，最后查明白：

**`ddddocr` 依赖 `opencv-python`，而 OpenCV 在 PyPI 上没有任何 `cp313 / win_amd64` 轮子（所有版本都没有）**。于是 pip 只能从源码编译 OpenCV——耗时极长且基本会失败。官方 MSI 静默安装也走不通（报 `Could not access network location`）。

解法：**用免安装的 embeddable Python 3.12**。OpenCV 的 cp312 轮子正常存在。步骤：

1. 下载 `python-3.12.x-embed-amd64.zip`（纯解压，不需要管理员、不走 MSI）；
2. 改 `python312._pth`，放开 `import site` 并加上 `Lib\site-packages`；
3. 用 `get-pip.py` 引导 pip；
4. `pip install ddddocr requests paho-mqtt`。

项目源码通过一个 `.pth` 文件挂到这个 3.12 环境里，直接 `import` 即可。验证效果：对已有的 5 张验证码样本，ddddocr 全部输出 4 位；人工核对约 3/4 完全正确（个别把数字 `5` 误读成字母 `b`），配合登录的 5 次重试，成功率足够。再跑一次真实"下载 → 识别 → 登录"链路，**第一次就成功拿到 token**。

> 这个坑的本质提醒：**选 Python 版本时，要先看关键依赖有没有对应平台的预编译轮子**。科学计算 / 视觉库（OpenCV、PyTorch 等）常常落后新版本 Python 半年以上。新手无脑上最新 3.13，很容易在装包这步碰壁。

## 五、工程化收尾

重写不是"能跑"就完了，顺手把习惯对齐：

- **分层 + 类型注解**：每个函数带类型与 docstring，业务状态收进 `FunengSync` 类；
- **质量门禁**：`ruff check` 全绿、`pytest` 通过；
- **密钥不入库**：登录密码（md5）和百度 AK/SK 从 `.env` 读取，`config.py` 只保留非敏感配置；`.env` 被 git 忽略，模板留在 `.env.example`；
- **可运行交付**：给了 `run.bat`，双击即用 3.12 环境启动。

## 六、小结

一个真实 node 脚本的重写，比任何语法教程都练手：你练的是"把已知需求翻译成新语言的工程结构"，而不是语法本身。这趟下来最值钱的两个认知——**接口报错先写自检脚本定位**、**装包前先查轮子兼容性**——都是文档里不会写、只有踩过才记得住的东西。

下一步，这套本地离线识别 + 定时同步的骨架，可以抽出来做成更通用的"验证码登录型数据采集"模板。如果你也在前端转 Python 的路上，欢迎一起交流。

## 七、番外：同一套思路在 Node 端也落地了

Python 端搞定本地离线识别后，我顺手把原 Node 脚本里那一坨阿里云 OCR（带 `appcode` 鉴权）也换了。既然 ddddocr 能离线、能不联网，Node 端当然也能用——靠 `ddddocr-node` 这个 npm 包（底层是 `onnxruntime-node`，把 ddddocr 的 ONNX 模型用 JS 跑起来）。

原来的验证码识别是走阿里云 OCR，依赖 `appcode` 鉴权，要联网、要钱，和云厂商绑死。改成单例的 ddddocr 调用：

```js
import { DdddOcr } from 'ddddocr-node';
const ddddOcr = new DdddOcr(); // 全进程一个实例即可，不必每次 new

const recognizeCaptcha = async (localPath) => {
  try {
    const text = await ddddOcr.classification(path.resolve(localPath));
    console.log("识别验证码结果:", text);
    if (text && text.length === 4) return text;
    console.log("识别结果非 4 位，识别失败");
    return false;
  } catch (error) {
    console.error('识别验证码时发生错误:', error);
    return false;
  }
};

// 调用处：code = await recognizeCaptcha(imgSrc);
```

`npm install ddddocr-node@^2.3.0` 即可，依赖里不再有阿里云 `appcode` 的残留。

又踩到一个小坑：`ddddocr-node` 的 `setRanges(CHARSET_RANGE.NUM_CASE)` 在本机返回的是**空字符串**——python 版本我也没用它，靠 5 次登录重试兜底偶尔的误读。去掉 `setRanges` 用默认模式，结果反而正确：对同一批验证码样本，Node 端输出 `xsrx / zgqj / xbaq / bhku / NyWR / Bjdr`，和 Python 端 ddddocr 的输出**一字不差**。`node --check` 通过，旧的阿里云 / `appcode` 逻辑已彻底清除。

这趟下来一个完整闭环：同一个业务（验证码登录 + 定时同步），既能在 Python 端用 ddddocr 离线识别，也能在 Node 端用 ddddocr-node 离线识别，两端识别结果一致，且都不依赖任何云 OCR 密钥。
