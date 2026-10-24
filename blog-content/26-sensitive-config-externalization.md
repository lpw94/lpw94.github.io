敏感配置外置实战：公开仓库里的一次完整凭据治理

> 起因是一次例行的提交前自查。我在自己的 Python 练手项目里写了个扫敏感信息的脚本，跑完发现工作区干净——但脚本顺带查了 git 历史，结果揪出一件让我后背发凉的事。
>
> 内网地址和登录账号，已经躺在 5 个历史提交里了。而那个仓库，是公开的。

## 一、先看清问题的规模

仓库叫 `pythonStudy`，是「项目驱动学 Python」的练习场：一个记账 CLI、一个 FastAPI 后端、一个 Node 脚本的 Python 移植。三个子项目挤在一个仓库里，是那种个人练习仓库的典型形态。

问题出在第三个。移植的那个 Node 脚本要连公司内网的水表同步服务，配置写在 `config.py` 里：

```python
# 改之前的样子
HOST_URL = "http://111.8.86.3:19126"
USER_NAME = "yh_zhongxyy"
PASSWORD_MD5 = "40233af31b41b8101d5a194a78fe139b"
```

密码 md5 后来我挪到 `.env` 了，但**地址和账号还留在代码里**。而这两个都不是什么无关痛痒的装饰：

- 内网地址 + 端口，直接暴露网络拓扑，知道的人可以据此判断这套系统部署在哪、走的什么协议；
- 登录账号，配合任何途径拿到的口令，就是一次完整的越权访问。

更关键的是——**这个仓库是公开的**。我原本以为「个人练习仓库没人看」，但 GitHub 上 `private = false` 意味着任何人都能 clone 下来，逐个 commit 翻查。

### 历史才是真正的泄露面

这是整件事里最反直觉的一点。

我知道 `.gitignore` 里写了 `.env`，也知道 `git rm` 能删掉当前版本的文件。但我漏算了一件事：

> **提交过的值，永远留在历史里。**

`git log -S` 一查，真实情况是这样的：

```
$ git log --all --oneline -S "111.8.86.3"
6dc7495 feat(auth): 接入 /api/auth/jwt/token 登录换 token
d5f218c fix(captcha): 识别结果长度不为 4 时重新下载再识别
855232c feat(funeng_sync): 新增 Python 学习练手 demo 与 supervision 示例
0d0dca6 feat(captcha_demo): 添加极简验证码识别脚本，支持本地图片识别
dd08ee3 feat(funeng): 移植富能水表同步脚本到 Python

$ git log --all --oneline -S "yh_zhongxyy"
6dc7495 feat(auth): 接入 /api/auth/jwt/token 登录换 token
0d0dca6 feat(captcha_demo): 添加极简验证码识别脚本，支持本地图片识别
dd08ee3 feat(funeng): 移植富能水表同步脚本到 Python
```

5 个提交里有内网地址，3 个里有账号。

（上面这些 commit hash 是**重写之前**的。等会儿清历史时所有 hash 都会变——这也是「历史重写」这件事的另一面：它不可逆，连引用关系一起改掉。）

而如果我当时只是「把当前代码改干净然后 commit」，历史里那 5 个提交照样能被翻出来——`git rm` 只影响 HEAD 指向的那一版，对 `.git/objects` 里的旧 blob 毫无作用。

**这意味着：改代码不等于解决泄露，清历史才是。**

## 二、处理策略：分两层做

我把这件事拆成了两层，因为它们的性质完全不同：

| 层 | 问题 | 手段 | 可逆性 |
|---|---|---|---|
| **当前代码** | 新的提交别再带敏感值 | 配置外置到 `.env` | 完全可逆 |
| **git 历史** | 旧的提交里已经带上了 | 重写历史 | 不可逆，需强推 |

先做第一层（安全、可回滚），再做第二层（需要 force push）。

### 第一层：配置外置，但不给兜底默认值

大部分教程教外置配置时会这么写：

```python
# ❌ 看似外置，实则没解决问题
HOST_URL = os.getenv("FUNENG_HOST_URL", "http://111.8.86.3:19126")
```

值挪到了 `.env`，但**兜底默认值还留在源码里**。`.env` 一旦缺失、变量名拼错、CI 环境没注入，程序照样会用这个硬编码值跑起来——你只是换了个地方藏着它。

我的做法是**彻底不给默认值**：

```python
HOST_URL = _get("FUNENG_HOST_URL").rstrip("/")
USER_NAME = _get("FUNENG_USER_NAME")
PASSWORD_MD5 = _get("FUNENG_PASSWORD_MD5")


def _require(key: str, value: str, hint: str) -> str:
    """配置项缺失时抛 ConfigError，并给出「去哪填」的明确指引。"""
    if not value:
        raise ConfigError(
            f"缺少配置项 {key}：请在 {ROOT / '.env'} 中填写{hint}"
            f"（模板见 {ROOT / '.env.example'}），"
            f"或设置同名系统环境变量。"
        )
    return value


def require_host_url() -> str:
    return _require(
        "FUNENG_HOST_URL",
        HOST_URL,
        "生产服务端地址（形如 http://<内网IP>:<端口>）",
    )
```

核心是一句话：**宁可启动失败，也不要假装正常。**

一个报「缺少 FUNENG_HOST_URL，请到 .env 里填」的启动错误，比一个用兜底地址静默跑起来、然后在某个奇怪的时刻连上错误环境的进程，要安全得多。

配套地，`.env.example` 模板里也不能有「能直接用的值」：

```bash
# ---- 必填三项 ----------------------------------------------------------
FUNENG_HOST_URL=http://<内网IP>:<端口>
FUNENG_USER_NAME=<你的账号>
FUNENG_PASSWORD_MD5=<32位小写md5>
```

模板的价值在于「告诉你该填什么格式」，不在于「给你一个能跑的默认值」。

### 一个连带发现：示例代码也会泄露

改完主代码后我顺手扫了一遍，结果发现两个「纯教学 demo」里也写着真实地址：

```python
# demo_config.py —— 原本长这样
BASE_URL: str = "http://111.8.86.3:19126"

# demo_stdlib.py —— 也一样
HOST = "http://111.8.86.3:19126"
```

这俩文件是给人看的 import / 标准库用法示例，**它们的价值跟连不连得上真实服务毫无关系**。改成占位符反而更合适：

```python
# 这里用示例地址而非真实内网地址：demo 是给人看的教学样例，
# 不该把生产拓扑带进公开仓库。真实地址在 config.py 里，从 .env 读。
BASE_URL: str = "http://10.0.0.1:8080"
```

顺带一个经验：**文档里的示例输出也是泄露面**。README 里那段「真实运行结果」我原本贴的是完整输出：

```
下载验证码：http://111.8.86.3:19126/api/auth/verificationCode/captcha-image/1792758014212 -> .../img
...
  "data": { "token": "...", "name": "yh_zhongxyy", "userId": 1990 }
```

现在全改成了占位符。贴真实日志确实更有说服力，但那是**内部文档**该干的事，公开仓库里的示例输出应该保持「形状对、内容假」。

### 顺手清掉的：一个已经没用的凭据

`.env` 里还躺着百度 OCR 的 AK/SK：

```bash
BAIDU_API_KEY=m7W9oDTIYuw9DsWo8LNmuyUQ
BAIDU_SECRET_KEY=chIifMWKp77hegM3KURVU9Sa8Ru6ywSL
```

云端识别方案早随 `http_client.py` 一起裁掉了，这俩密钥**没有任何使用场景**。但它们仍然是一份「现在还能用」的凭据——留在磁盘上只是纯风险。我直接删了。

> 判断标准可以更简单：**当前代码里读不到的配置项，就是该清理的配置项。**

## 三、写个脚本自查，而不是靠眼睛

手工 grep 靠不住——这次我能记住 `111.8.86.3`，下次就忘了。所以我写了个自查脚本 `scripts/check_secrets.py`，两件事：

1. **扫工作区**：正则匹配内网 IP、32 位 md5、AK/SK、硬编码口令；
2. **扫 git 历史**：用 `git log -S` 反查每个真实值是否曾被提交。

历史那部分的思路有点巧：不写死敏感值，而是**从当前 `.env` 读出真实值，再逐个反查**。

```python
def scan_history() -> list[tuple[str, str]]:
    """扫描 git 历史，返回 [(规则名, 命中摘要)]。

    用 `git log -S` 逐个敏感值反查，比遍历所有 blob 快得多。
    """
    hits: list[tuple[str, str]] = []

    # 需要在历史里反查的具体值（从当前 .env 读取真实值）
    secrets: list[str] = []
    env_file = ROOT / ".env"
    if env_file.is_file():
        for raw in env_file.read_text(encoding="utf-8").splitlines():
            line = raw.strip()
            if not line or line.startswith("#") or "=" not in line:
                continue
            _, _, value = line.partition("=")
            value = value.strip()
            # 只查看起来像真凭据的值（占位符跳过）
            if len(value) >= 8 and not value.startswith("<"):
                secrets.append(value)

    for value in secrets:
        result = subprocess.run(
            ["git", "log", "--all", "--oneline", "-S", value],
            cwd=REPO,
            capture_output=True,
            text=True,
            timeout=60,
            check=False,
        )
        commits = [ln for ln in result.stdout.splitlines() if ln.strip()]
        if commits:
            hits.append(
                (
                    "敏感值出现在 git 历史",
                    f"值以 *{value[:4]}**** 开头，出现于 {len(commits)} 个提交：",
                )
            )

    return hits
```

这样做的额外好处是：**换环境不用改脚本**。`.env` 里换了一组凭据，脚本自动跟着查新的那组。

跑出来的结果：

```
[1/2] 扫描工作区 ...
  ⚠ 发现 2 处疑似敏感内容：

  • [password 赋值] funeng_mqtt_sync\src\funeng_sync\login.py:9
      password: '<明文密码的 md5>',   // 原脚本里是硬编码的 32 位 md5
  • [内网端口组合] funeng_mqtt_sync\README.md:111
      下载验证码：http://111.8.86.3:19126/api/...

[2/2] 扫描 git 历史 ...
  ⚠ 发现 2 处历史泄露：

  • [敏感值出现在 git 历史]
      值以 *http**** 开头，出现于 5 个提交
  • [敏感值出现在 git 历史]
      值以 *yh_z**** 开头，出现于 3 个提交
```

### 关于误报：让规则「聪明」比让规则「简单」重要

第一版脚本跑完有两处误报。`password: '<明文密码的 md5>'` 明明是占位符说明，却被判成硬编码口令。

我一开始的修法是加白名单——把整个「已知安全的值」列出来，命中就跳过。但马上发现这写法有问题：

```python
# ❌ 整行比对会误放行
if any(allow in line for allow in ALLOWLIST):
    continue
```

一行里**同时**有示例地址和真实值时，整行被放行了——检查就失效了。

正确做法是只拿「匹配到的那段文本」去比白名单：

```python
# ✅ 只比对命中片段
matched = m.group(0)
if matched in ALLOWLIST:
    continue
```

顺便把 password 规则也改得更精确——**值被尖括号包裹时不算硬编码**：

```python
(
    "password 赋值",
    # 只在值不是尖括号占位符时才判定为疑似硬编码
    re.compile(
        r"[\"']?password[\"']?\s*[=:]\s*[\"'](?![<\[])[^\"']{6,}[\"']",
        re.IGNORECASE,
    ),
    "疑似硬编码口令",
),
```

还有个自指的坑：脚本自己的正则里写着「内网网段长什么样」，于是每次跑都把自己报一遍。解决办法是把脚本自身排除在扫描范围外：

```python
self_path = Path(__file__).resolve()
# ...
if _is_skipped(p) or p.resolve() == self_path:
    continue
```

### 规则怎么定：一开始我写窄了

第一版规则只匹配 `10.x` / `172.16-31.x` / `192.168.x` 这三个标准私有网段。结果它**漏掉了真正的目标地址** `111.8.86.3`——那是个公网段，但公司拿它做内网部署。

后来我改成「所有 IPv4 一律命中，靠白名单放行示例值」：

```python
(
    "内网 / 私有 IP 地址",
    re.compile(
        r"\b(?:"
        r"10\.\d{1,3}\.\d{1,3}\.\d{1,3}"          # 10.0.0.0/8
        r"|172\.(?:1[6-9]|2\d|3[01])\.\d{1,3}\.\d{1,3}"  # 172.16.0.0/12
        r"|192\.168\.\d{1,3}\.\d{1,3}"             # 192.168.0.0/16
        r"|169\.254\.\d{1,3}\.\d{1,3}"             # 链路本地
        # 其余 IPv4（含 111.x 这类「公网段里做内网部署」的情况）
        r"|\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}"
        r")\b"
    ),
    "真实服务地址，公开仓库里等于泄露网络拓扑与部署信息",
),
```

思路是：**默认全部命中，只对「明确知道是示例」的值开白名单。**反过来做——默认全部放过、只拦已知的——在这个场景下会漏。

至于 `111.8.86.3` 这种「公网段做内网」的情况，我后来想通了一件事：**在公开仓库的语境下，公网 IP 和内网 IP 一样敏感**。它虽然能路由到，但照样暴露了部署位置。所以规则直接不区分网段，全部拦。

### 自查脚本本身也要被测试

写了工具不等于工具是对的。我给「模板里不能有真实值」这条写了条测试，然后**故意把模板改坏**，确认它真的会失败：

```
>       assert "FUNENG_PASSWORD_MD5=<32位小写md5>" in text
E       AssertionError: assert 'FUNENG_PASSWORD_MD5=<32位小写md5>' in '...'
tests\test_config_security.py:192: AssertionError
1 failed, 13 passed
```

改回来就绿了。这种「故意破坏 → 确认能抓到」的动作，比写完测试直接跑一遍绿了更有说服力。

## 四、清历史：filter-branch 在 Windows 上是个坑

第二层才是重写历史。我先试了 `git filter-branch`：

```sh
git filter-branch --tree-filter '
  find . -type f -not -path "./.git/*" -exec sed -i -f rules.sed {} +
' --prune-empty -- --all
```

然后就等啊等。**20 个提交，10 分钟没跑完。**

原因在 `--tree-filter` 的工作方式：它要为每一个提交完整 checkout 一遍文件树。仓库里虽然没大文件，但 Windows 上 `find -exec sed` 是「每个文件起一个进程」，几百个文件 × 21 个提交 × 每个进程几百毫秒的启动开销——慢到离谱。

`git filter-branch` 自己的警告里其实就写着：

```
WARNING: git-filter-branch has a glut of gotchas generating mangled history rewrites.
... use an alternative filtering tool such as 'git filter-repo'
```

于是换 `git-filter-repo`：

```sh
# pip install git-filter-repo
git filter-repo --replace-text rules.txt --force
```

替换规则文件格式是「原值==>新值」：

```
111.8.86.3==>10.0.0.1
:19126==>:8080
yh_zhongxyy==>your_account
40233af31b41b8101d5a194a78fe139b==>00000000000000000000000000000000
```

**4.7 秒。** 同一个仓库，同样 21 个提交。

### 先在克隆里试跑，别直接动真仓库

重写历史是不可逆操作——它会改变所有 commit hash。动手前我先克隆了一份到临时目录：

```sh
git clone pythonStudy /tmp/rewrite_test
cd /tmp/rewrite_test && sh scripts/rewrite_history.sh
```

在副本上验证通过，才对真仓库执行。这不是多余——万一规则写错，代价就是整个仓库历史报废。

### 验证不能只看 `git log -S`

`git log -S` 只查 diff 内容。所以我做了更严格的检查：**把历史上所有 blob 对象全 dump 出来 grep**。

```sh
git rev-list --objects --all | cut -d" " -f1 \
  | git cat-file --batch-check="%(objectname) %(objecttype)" \
  | awk '$2=="blob"{print $1}' > /tmp/blobs.txt

while read b; do git cat-file blob "$b"; done < /tmp/blobs.txt > /tmp/allblobs.txt

for v in "111.8.86.3" "yh_zhongxyy" "40233af31b41b8101d5a194a78fe139b" "19126"; do
  echo "$v -> $(grep -c "$v" /tmp/allblobs.txt) 处"
done
```

结果：

```
blob 总数: 172
--- 命中检查 ---
111.8.86.3 -> 0
yh_zhongxyy -> 0
40233af31b41b8101d5a194a78fe139b -> 0
19126 -> 0
```

提交消息也扫了一遍，同样零命中。172 个 blob——**每一个历史版本**都干净了。

### 最关键的一步：从 GitHub 重新 clone

本地干净不代表远程干净。`git push --force` 之后，我做了一次真正的验证：

```sh
git clone git@github.com:lpw94/pythonStudy.git /tmp/verify_public
cd /tmp/verify_public

for v in "111.8.86.3" "yh_zhongxyy" "40233af31b41b8101d5a194a78fe139b"; do
  echo "$v -> $(git log --all --oneline -S "$v" | wc -l) 个提交"
done
```

```
21 个提交
111.8.86.3 -> 0
yh_zhongxyy -> 0
40233af31b41b8101d5a194a78fe139b -> 0
```

**从公开仓库克隆下来，21 个提交全部干净。** 这才算真的处理完了。

改完之后功能也得照常：61 条单测全绿、ruff 全绿、真实登录连跑成功。

## 五、顺手修的一个行为问题

改配置的过程中，暴露出一个之前没注意的毛病。

原来 `.env` 缺失时，登录流程是这样的：

```
[1/5] 下载失败：Invalid URL '/api/auth/verificationCode/captcha-image/...'
[2/5] 下载失败：Invalid URL '/api/auth/verificationCode/captcha-image/...'
[3/5] 下载失败：Invalid URL '/api/auth/verificationCode/captcha-image/...'
[4/5] 下载失败：Invalid URL '/api/auth/verificationCode/captcha-image/...'
[5/5] 下载失败：Invalid URL '/api/auth/verificationCode/captcha-image/...'
登录失败：尝试 5 次仍未登录成功
```

两个问题叠在一起：

1. **报错完全指不到根因。** `Invalid URL '/api/...'` 是 requests 抛的，看不出是「.env 没配地址」。而实际原因是我把 `HOST_URL` 的默认值去掉了，`.env` 里又漏写了这个新项。
2. **重试 5 次毫无意义。** 配置没配好，再试一百次也一样。

所以我加了一个**不可重试**的异常类型：

```python
class ConfigMissingError(CaptchaError):
    """缺少必要配置（.env 没写地址等）。

    单独一类是因为它**不该重试**：重试不会让配置凭空出现，
    只会白白消耗 5 次尝试并把日志刷满。调用方应当直接中止。
    """
```

重试循环里加一条：

```python
for attempt in range(1, max_retry + 1):
    try:
        img, key = download_captcha(save_dir=save_dir)
    except ConfigMissingError:
        # 配置缺失重试也没用——直接抛出，别刷 5 遍同样的错。
        raise
    except CaptchaError as e:
        ...
```

外层 `login()` 里也要拦一道，把配置错误归一成 `LoginError`（调用方只需捕获一种异常）：

```python
        except CaptchaError as e:
            last_err = str(e)
            print(f"[{attempt}/{max_retry}] 取验证码失败：{last_err}")
            if isinstance(e, ConfigMissingError):
                # 配置没配好，再试多少次都一样，直接中止。
                raise LoginError(str(e)) from e
            continue
```
现在报错长这样：

```
[1/5] 取验证码失败：未配置服务端地址：请在项目根目录 .env 里设置
      FUNENG_HOST_URL（生产服务端地址，形如 http://<内网IP>:<端口>）
登录失败：未配置服务端地址：请在项目根目录 .env 里设置 FUNENG_HOST_URL...
```

一次就停，且明确告诉你去改哪个文件、填哪个变量。

> 这里有个我踩过的坑：一开始我把校验函数返回的**基础地址**当成了**完整登录地址**发出去，结果服务端返回 404（`Sorry, Page Not Found`）。地址校验用 `require_host_url()`，但请求还是得用 `LOGIN_URL`。**校验和取值是两件事。**

## 六、留个能复用的脚本

这次的操作浓缩成了一个脚本，`scripts/rewrite_history.sh`：

```sh
#!/bin/sh
set -e
cd "$(git rev-parse --show-toplevel)"

echo "== 重写前 =="
for v in "111.8.86.3" "yh_zhongxyy"; do
  echo "  $v -> $(git log --all --oneline -S "$v" | wc -l) 个提交"
done

RULES=$(mktemp)
cat > "$RULES" <<'EOF'
111.8.86.3==>10.0.0.1
:19126==>:8080
yh_zhongxyy==>your_account
EOF

# 优先用 git-filter-repo 命令；没有则退回 python -m git_filter_repo
if command -v git-filter-repo >/dev/null 2>&1; then
  git-filter-repo --replace-text "$RULES" --force
elif python -m git_filter_repo --version >/dev/null 2>&1; then
  python -m git_filter_repo --replace-text "$RULES" --force
else
  echo "未找到 git-filter-repo，请先安装：pip install git-filter-repo" >&2
  rm -f "$RULES"
  exit 1
fi

rm -f "$RULES"

echo "== 重写后（都应为 0）=="
for v in "111.8.86.3" "yh_zhongxyy"; do
  echo "  $v -> $(git log --all --oneline -S "$v" | wc -l) 个提交"
done

echo ""
echo "⚠️  下一步需要 force push 才能让远程历史也干净："
echo "    git push --force --mirror origin"
```

脚本末尾特意留了 force push 的提醒——因为重写历史这件事，**本地干净只是完成了一半**。

## 七、几条容易忽略的收尾

### 备份

动手之前先整目录复制了一份：

```sh
cp -r pythonStudy pythonStudy_backup
```

1.1 GB，但换来的是「改坏了能立刻回去」的底气。重写历史这种事，值得这个成本。

### GitHub 上旧对象还在

`git push --force` 之后，GitHub 的服务端**可能还保留着旧对象**一段时间（悬空引用、缓存、某些场景下的 fork 关系）。彻底清除需要联系 GitHub Support 清理缓存，或者干脆**换个仓库重建**。

我选择的是：force push + 从 GitHub 重新 clone 验证。日常场景下这已经足够——真要对抗有组织的爬取，托管平台的缓存也得算进去。

### 最重要的：轮换凭据

**历史重写只能减少未来泄露面，不能追溯过去的暴露。**

这个仓库公开了多久？期间有没有被搜索引擎收录？有没有第三方爬虫扫过 GitHub？没人知道。

所以最该做的一件事其实不是技术手段，而是：

> **在服务端把密码改了。**

我在博文里把这个单独列出来，因为技术手段再完美，也替代不了「凭据可能已经被别人看到了」这个事实。历史清理是消除证据，轮换才是消除风险。

## 八、清单

这次的处理拆开来看，其实是一套可以照着做的检查清单：

| # | 动作 | 关键点 |
|---|---|---|
| 1 | 确认仓库可见性 | `private = false` 意味着一切都是公开的 |
| 2 | 敏感项全部移到 `.env` | 包括地址、账号、密钥，不只是密码 |
| 3 | **不给兜底默认值** | 兜底默认值 = 把秘密留在源码里的另一种写法 |
| 4 | 模板只放占位符 | `.env.example` 不能有「能直接用的值」 |
| 5 | 清理读不到的死配置 | 用不到的凭据 = 纯风险 |
| 6 | demo 与文档也脱敏 | 示例代码、示例输出都是泄露面 |
| 7 | 写自查脚本 | 扫工作区 + 扫历史，别靠眼睛 |
| 8 | 给自查脚本写测试 | 故意改坏，确认它真能抓到 |
| 9 | 重写历史 | 用 filter-repo，别用 filter-branch |
| 10 | 全 blob 扫描验证 | `git log -S` 不够，得扫所有对象 |
| 11 | 从远程重新 clone 验证 | 本地干净 ≠ 远程干净 |
| 12 | **服务端轮换凭据** | 清理历史是消除证据，轮换才是消除风险 |

第 12 条最重要，也最容易被忘掉。

---

*配套代码：[`funeng_mqtt_sync`](https://github.com/lpw94/pythonStudy/tree/dev/funeng_mqtt_sync) · 自查脚本 [`scripts/check_secrets.py`](https://github.com/lpw94/pythonStudy/blob/dev/funeng_mqtt_sync/scripts/check_secrets.py) · 历史重写 [`scripts/rewrite_history.sh`](https://github.com/lpw94/pythonStudy/blob/dev/scripts/rewrite_history.sh)*
