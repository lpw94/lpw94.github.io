> 这是「前端工程师项目驱动学 Python」系列的续篇。前几篇写了验证码离线识别（[第 16 篇](https://lpw94.github.io/post/dddocr-captcha-recognition)）、权限路由后端（[第 22 篇](https://lpw94.github.io/post/fastapi-admin-api)）和水表取数导出（[第 27 篇](https://lpw94.github.io/post/meter-data-excel-export)），这一篇换个方向：**图像识别**。
>
> 起因很朴素——我想搞清楚「给一张明星剧照，能不能说出这是谁」。我以为这属于 CV 的深水区，做完才发现：**难点不在模型，在候选空间**。整个项目最有价值的部分，是三次把准确率从 77.8% 提到 90.0% 的过程，而三次都不是「换了更厉害的模型」。

## 一、先说结论：这次做出了什么

一个叫 `celebrity_recognition` 的命令行工具，3500 行 Python，给定一张图片，输出里面每个人的名字和置信度，并画出标注框。

核心是**两个引擎协同**，不是二选一：

| 引擎 | 回答的问题 | 需要建库？ | Top-1 准确率 | 耗时 |
| --- | --- | --- | --- | --- |
| **CLIP 零样本** | 「像谁」 | 不需要 | **90.0%** | 0.11 s/张 |
| **SFace 人脸特征库** | 「是谁」 | 需要参考图 | **99.1%** | 0.02 s/张 |

数据来源是 HuggingFace 上的 `celebrity-1000`（997 位名人、18184 张图），我从中抽了 18 位名人、180 张人脸图做评估。

整条链路是这样的：

```
图片
  ↓
① YuNet 检测人脸          找到脸在哪、歪了多少
  ↓
② SFace 提取特征          128 维人脸向量（用于精确匹配 + 合并同一人）
  ↓
③ 两条路同时跑
   ├─ 人脸库比对 → 命中 ≥0.5 → 直接出结论（99.1% 准确率）
   └─ CLIP 分类  → 在 1132 位候选里找最像的（90.0% 准确率）
  ↓
④ 人脸库命中优先，否则用 CLIP；都不够就报「未识别」
```

**为什么值得做成双引擎？** 因为 CLIP 和 SFace 的强项完全不重叠：

- CLIP 见过成千上万张图，知道「这张脸长得像谁」，但它**没见过你要认的那个人**。所以它给的是「最像的候选人」，是猜测。
- SFace 只见过你给它的那几张参考图，但它做的是**像素级身份比对**。所以它给的是「是这个人」，是确认。

一句话：**CLIP 是召回，SFace 是精确**。生产系统里这俩是互补关系，不是替代关系。

## 二、先把评估方法做对，否则一切都是自欺欺人

这一节我想单独拎出来，因为**评估方法错了，后面所有优化都是在优化一个错误的指标**。

### 2.1 人脸库必须 leave-one-out

最直觉的做法是：拿一个人的 10 张图，全部存进人脸库，然后拿其中一张去测。这会得到接近 100% 的准确率。

**这个数字是假的。** 因为它测的是「模型见过这张图吗」，不是「模型认得这个人吗」。人脸特征库在同图场景下会退化成近似的图片哈希。

正确做法是 **leave-one-out**：每个人的 10 张图里，4 张建库、6 张测试，测试图绝不进库。

```
正确：  [建库] [建库] [建库] [建库] [测] [测] [测] [测] [测] [测]
错误：  [建库] [建库] [建库] [建库] [建库+测] [建库+测] ...  ← 同一张图既建库又测试
```

两种方式的差距：**100% vs 99.1%**。看起来差不多，但后者才是真实能力。

### 2.2 CLIP 零样本的评估要摊开看

CLIP 没有建库过程，「正确」的判定标准是：图片所属的名人是否出现在 Top-1 预测里。

但零样本有个绕不开的前提——**这个人得在候选表里**。人不在表里，模型再强也只能给你一个「像某个陌生人」的答案。所以评估要同时报两个数：总体 Top-1，以及**「Top-1 不对但真人在候选表里」的情况有多少**。

我最初的评估脚本有两个 bug，导致准确率被低估了 4.4 个百分点：

```python
# ❌ 第一版：目录名直接当期望名
def to_display(folder: str) -> str:
    return folder.replace("_", " ")

# 数据集目录叫 "Robert_Downey_Jr"，转换后是 "Robert Downey Jr"，
# 少了句点。而候选表里写的是 "Robert Downey Jr."（带句点），
# → 明明 5 张全识别对了，却因为字符串不等被判成「未命中」。
```

另一个 bug 更隐蔽：我自己**凭印象乱写的英文名**混进了候选表。比如有个条目叫 `AlGdna`（我以为是某个冷门演员），结果它**主动抢走了真实名人的匹配**——Mila Kunis 的 5 张测试图全被它吸走，Top-1 一次都没命中。

> **教训**：零样本模型的候选表必须严格用真名。任何错条目都在稀释正确条目的得分。这比「换一个更强的模型」重要得多。

## 三、准确率 77.8% → 90.0%：三步，每步都有数据

这三步是整个项目最有价值的部分，因为它们揭示了零样本识别真正的瓶颈在哪。

| 步骤 | 做了什么 | Top-1 | Top-5 |
| --- | --- | --- | --- |
| 起点 | 192 位内置候选 | 77.8% | 83.3% |
| 第一步 | 修候选表错条目 + 修评估脚本 | 82.2% | — |
| 第二步 | **候选表扩到 1132 位** | **90.0%** | **98.9%** |

### 3.1 第一步：修掉自己造的噪声（+4.4%）

上一节已经说了，两件事：

1. 清掉 `AlGdna` 这类错条目（它们会主动抢匹配）
2. 修评估脚本的目录名映射（`Robert_Downey_Jr` → `Robert Downey Jr.` 要补句点）

这一步是「修噪声」，本质上是**先让测量可信**，再谈优化。

### 3.2 第二步：根因不在模型，在候选空间（+7.8%）

修完之后还剩 3 位名人**全错**，每人 10 张图一张都没中：

```
Dwayne Johnson  →  被认成 Jason Statham / Kobe Bryant
Hugh Jackman    →  被认成 Ben Affleck
Mila Kunis      →  被认成 Katy Perry
```

第一反应是「CLIP 不认识这几个人」。但我做了个对照实验：**把这三个人手动加进候选表再跑**——

```
Dwayne:  Dwayne Johnson 32%   ← 立刻认出来
Hugh:    Hugh Jackman   33%   ← 立刻认出来
Mila:    Mila Kunis     24%   ← 立刻认出来
```

**假设完全验证**：模型认识他们，只是他们根本不在那 192 人的候选表里。CLIP 只能在这 192 人里挑最像的，它给出的 Jason Statham 已经是「在这 192 人里谁最像 Dwayne Johnson」的最优解了——**问题出在搜索空间，不在模型能力**。

解法很直接：把 `celebrity-1000` 数据集里那 997 位名人的真名全部导出成候选表。

```python
# scripts/export_dataset_candidates.py
# 数据集的 README 里有一张「序号 → 姓名」对照表，直接解析成候选表
# 输出 models/candidates.txt，格式：中文名|英文名|别名1,别名2
```

内置 192 位 + 数据集 997 位，去重后 **1132 位**。Top-1 从 82.2% 直接跳到 **90.0%**，Top-5 到 **98.9%**。

> 这是整个项目最值钱的一条经验：
> **零样本模型的瓶颈通常在候选空间，不在模型本身。**
> 先量一下「真人在不在候选表里」，比换模型见效快一个数量级。

### 3.3 第三步：别名机制——CLIP 认识的是艺名和角色名

还有一个现象：**候选表里有的人，即使加了别名也认不准**。因为 CLIP 在互联网图文对上训练，它记住的是：

| 本名 | CLIP 更熟悉的标签 |
| --- | --- |
| Dwayne Johnson | **The Rock** |
| Hugh Jackman | **Wolverine**（金刚狼） |
| Mila Kunis | **Black Swan**（黑天鹅） |
| Emma Watson | **Hermione Granger**（赫敏） |

我原本以为「Dwayne Johnson」这个组合 CLIP 应该认识，但显然「The Rock」的图文对更多、embedding 更强。

所以给候选加了别名，同一候选取**本名与所有别名里的最高分**：

```python
@dataclass(frozen=True)
class Candidate:
    zh: str
    en: str
    aliases: tuple[str, ...] = ()

    @property
    def names(self) -> tuple[str, ...]:
        """参与文本匹配的所有名字：本名 + 别名。"""
        return (self.en, *self.aliases)
```

别名可以写在候选表里（`英文名|别名1,别名2`），内置候选表里直接写了 70 多条典型映射：

```python
Candidate("艾玛·沃特森", "Emma Watson", aliases=("Hermione Granger",)),
Candidate("小罗伯特·唐尼", "Robert Downey Jr.", aliases=("Tony Stark",)),
Candidate("基努·里维斯", "Keanu Reeves", aliases=("Neo",)),
```

匹配时不是取平均，而是**每个名字各生成一组 prompt，全部拼在一起算相似度，最后按候选聚合取最大值**——这跟「多 prompt 取最大值」是同一个思路：相当于在「最有利角度下」投票。

## 四、性能：文本特征缓存，18 倍提速

候选表扩到 1132 位之后，性能出了个反直觉的问题——**变慢了**。

原因是 CLIP 的文本编码：1132 位候选人 × 4 个 prompt 模板 = **4528 条文本**，每张图都要重新编码一遍。评估 180 张图 = 80 万次文本编码，在 CPU 上直接跑到 351.6 秒。

但候选表是**固定的**。同一批候选的文本特征，第二次用的时候跟第一次一模一样，有什么理由重算？

```python
def _text_features(self, candidates):
    # 缓存 key 用「名字 + 别名」，候选表变了自然失效
    key = tuple((c.en, c.aliases) for c in candidates)
    cached = self._text_cache.get(key)
    if cached is not None:
        return cached

    texts, owner = self._candidate_prompts(candidates)
    feats = self._encode_texts(texts)
    self._text_cache[key] = (feats, owner)
    return feats, owner
```

效果：

| | 耗时 | 每张 |
| --- | --- | --- |
| 缓存前 | 351.6 s | 1.95 s |
| 缓存后 | **19.4 s** | **0.11 s** |

**18 倍提速**。而且缓存 key 用的是「候选的名字和别名」而不是「候选列表对象」，所以候选表改了会自动失效重建，不会拿到过期结果。

> 这条经验在任何「固定输入 + 重复计算」的场景都成立：embedding、tokenize、schema 校验、权限查询……先问一句「这个输入真的每次都不一样吗」。
>
> 反过来说，如果你的候选表是**动态的**（比如按用户权限过滤），缓存 key 就必须包含过滤条件，否则会串号。我这里候选表固定，是安全的。

## 五、九个实测坑

下面这些每个都花了我真实时间，全部写进了项目 README。

### 5.1 模型下载：LFS 文件不走 raw.githubusercontent.com

下载 YuNet 和 SFace（opencv_zoo 的模型）时一直 404。原因是这两个模型用 Git LFS 存，raw 路径拿不到，得走 media 路径：

```bash
# ❌ 不通
https://raw.githubusercontent.com/opencv/opencv_zoo/main/models/face_detection_yunet/face_detection_yunet_2023mar.onnx

# ✅ 通（media 是 LFS 的实际内容服务）
https://media.githubusercontent.com/media/opencv/opencv_zoo/main/models/face_detection_yunet/face_detection_yunet_2023mar.onnx
```

顺带记一下本机的网络可达性（2026-10 实测）：`hf-mirror.com`、`media.githubusercontent.com`、`download.pytorch.org` 通；`huggingface.co`、`raw.githubusercontent.com`、`modelscope.cn` 不通。**换源是解决下载问题最快的一招**，比研究报错信息快。

### 5.2 OpenCV 5.0 移除了 Haar 级联

第一版想用最老牌的 `cv2.CascadeClassifier` + Haar 人脸分类器，结果：

```python
AttributeError: module 'cv2' has no attribute 'CascadeClassifier'
```

OpenCV 5 已经把它删了。改用 DNN 版 **YuNet**（228KB，基于 `cv2.FaceDetectorYN`），效果反而更好——它是 2023 年的模型，精度远高于 Haar。

```python
detector = cv2.FaceDetectorYN.create(
    str(model_path), "", (320, 320), score_threshold=0.9, nms_threshold=0.3
)
```

### 5.3 `alignCrop` 第二参必须是 numpy 数组

SFace 的接口签名看起来能接受各种类型，实际不行：

```python
# ❌ 传 dataclass
ValueError: face_box is not a numpy array

# ✅ 传 1×15 的 float32 数组（5 个关键点 + 框）
aligned = self._recognizer.alignCrop(image, face.to_array())
```

5 个关键点的顺序是：右眼、左眼、鼻尖、右嘴角、左嘴角。顺序错了不会报错，但对齐结果是歪的，特征明显偏移。

### 5.4 transformers 5.x 的返回值变了

`get_text_features` 在 5.x 不再返回 tensor，而是 `BaseModelOutputWithPooling`：

```python
# ❌ transformers 5.x
feats = self.model.get_text_features(**inputs)
feats = feats / feats.norm(dim=-1, keepdim=True)
# AttributeError: 'BaseModelOutputWithPooling' object has no attribute 'norm'

# ✅ 取 pooler_output
feats = self._as_tensor(self.model.get_text_features(**inputs))
```

我加了个兼容层，4.x / 5.x 都能跑：

```python
@staticmethod
def _as_tensor(output: Any) -> Any:
    """把 get_*_features 的返回值统一成 tensor，兼容 transformers 4.x / 5.x。"""
    if hasattr(output, "pooler_output"):
        return output.pooler_output
    return output
```

### 5.5 BGR→RGB 切片是负 stride 视图

OpenCV 读出来是 BGR，CLIP 要 RGB，最自然的写法是 `img[:, :, ::-1]`：

```python
# ❌
rgb = [img[:, :, ::-1] for img in images]
# RuntimeError: At least one stride in the given numpy array is negative

# ✅ 负 stride 的视图必须拷成连续内存
rgb = [np.ascontiguousarray(img[:, :, ::-1]) for img in images]
```

这个坑很隐蔽——在 numpy 里切片完全合法，只有 `torch.from_numpy` 才拒绝。

### 5.6 `cv2.imread` 和 `cv2.imwrite` 都不支持中文路径

Windows 上 OpenCV 内部走 `fopen`，非 ASCII 路径**静默失败**：

```python
img = cv2.imread("C:/Users/xxx/图片/示例.jpg")   # → None，不报错！
```

写入更阴——不报错，但**文件名会变成乱码**：

```python
cv2.imwrite("out/示例.jpg", img)
# 实际落盘：out/绀轰緥.jpg     ← UTF-8 被按 GBK 解读
```

我修 `imread` 的时候漏了 `imwrite`，后来生成标注图才暴露出来。**两个必须一起修**：

```python
# 读
data = np.fromfile(path, dtype=np.uint8)
img = cv2.imdecode(data, cv2.IMREAD_COLOR)

# 写
ok, buf = cv2.imencode(suffix, img)
buf.tofile(str(path))
```

### 5.7 静默失败比崩溃更难查

有一次建库全失败，但评估脚本报的是「0 张测试，准确率 0%」——异常被 `except` 吞了，只剩一个 0。

```python
# ❌ 异常被吞，什么线索都没了
try:
    feats = [r.feature(img, f) for f in faces]
except Exception:
    continue

# ✅ 建库失败要明确报出来
except Exception as e:
    logger.error("特征提取失败 %s: %s", image_path, e)
    raise
```

**0% 这个数字特别有欺骗性**——它长得像「模型不行」，实际是「一行代码抛异常」。排查时先看分子分母，再看结论。

### 5.8 `cv2.putText` 画不了中文

标注框上的中文用 OpenCV 画会变成一堆问号（`cv2.putText` 只支持 Hershey 字体）。最后是**两个引擎分工**：OpenCV 画框和线条（快），PIL 画中文（用 `msyh.ttc`）。

### 5.9 标签位置：会遮脸，也会自己撞自己

贴顶的人脸框，标签放框上方正好压在额头上；两张竖排的脸，标签会互相重叠（上面那张被迫放下方，正好盖住下面那张的额头）。

最后做了候选位置 + 碰撞检测：

```python
# 候选位置：框上方 → 框下方 → 缩小字号放上方 → 框内侧
for use_font, place in (
    (font, "above"),
    (font, "below"),
    (load_font(max(14, font_size - 8)), "above"),
    (font, "inside"),
):
    ...
    if box_y1 >= 0 and box_y2 <= pil_img.height:
        placed = True
        break
```

这个坑不影响准确率，但**直接影响可用性**——一张看不清名字的标注图等于没有输出。

## 六、GPU 的诚实结论：能装上，但用不了

本机是 RTX 5060（Blackwell，sm_120），按理说 GPU 推理应该快得多。但实测下来，**GPU 在这个项目里帮不上忙**。

首先是安装：直接 `pip install torch` 不会换成 CUDA 版，因为 2.14.1 已经满足 `torch>=2.0`，pip 认为不用动手。必须先卸载再指定源：

```bash
pip uninstall -y torch
pip install torch --index-url https://download.pytorch.org/whl/cu128
```

装完 `torch 2.11.0+cu128`，CUDA 确实可用。但跑起来就炸了：

```
AcceleratorError: CUDA error: CUDA error unknown
  发生在 transformers/masking_utils.py 的 padding_mask 高级索引
```

具体表现是：**图像编码在 GPU 上正常，带 padding 的文本编码必崩**。这是 torch 2.11 + Blackwell (sm_120) 的内核兼容问题，而 cu128 索引里 torch 最高只到 2.11.0，换不了版本。

所以最终方案是：

```python
# 默认走 CPU（可靠）
# --device cuda 显式开启，且任何 CUDA 错误都自动降级
def _encode(self, fn):
    try:
        return fn(self.device)
    except (RuntimeError, self._torch.cuda.OutOfMemoryError) as e:
        # ⚠️ 只判 "out of memory" 会漏掉 cudaErrorUnknown
        if self.device == "cpu":
            raise
        self.fallback_reason = str(e)
        self.device = "cpu"
        self._torch.cuda.empty_cache()
        return fn("cpu")
```

**这里有个容易犯的错**：我最初只按 `"out of memory" in str(e)` 判断是否降级，结果 `cudaErrorUnknown` 的 `str(e)` 是空的，异常直接往上抛，降级逻辑形同虚设。改成「只要是 CUDA 错误就降级」才对。

顺带说一句：Windows 是 WDDM 模式，显存调度比较特殊——`nvidia-smi` 显示还剩 5GB 空闲，PyTorch 照样报 OOM。所以**推理阶段的 OOM 回退是必须的**，不能只在模型加载阶段做。

> 结论：**GPU 加速不是免费的**。你的模型、框架版本、硬件架构三者的兼容性得自己验证，别假设「装上 CUDA 就能跑」。
>
> 而且这次的性能瓶颈根本不在 GPU——瓶颈在文本编码的重复计算，一个缓存就解决了 18 倍的问题。**先找真正的瓶颈，再考虑加速。**

## 七、代码结构

```
celebrity_recognition/
├── src/celebrity_recognition/
│   ├── config.py        配置与路径
│   ├── candidates.py    候选表（内置 + 外置 + 别名）
│   ├── detector.py      YuNet 人脸检测
│   ├── clip_engine.py   CLIP 零样本分类（含缓存）
│   ├── gallery.py       SFace 特征库（建库 + 比对）
│   ├── pipeline.py      编排：检测 → 双引擎 → 决策 → 合并
│   ├── render.py        标注图渲染
│   └── cli.py           命令行入口
├── scripts/             下载模型、导出样本、评估脚本
├── tests/               43 个测试
└── data/candidates.txt  1132 位候选表
```

几个设计决策值得说：

**候选表分内置和外置。** 内置 192 位在代码里，外置 997 位在 `data/candidates.txt`（一行一个 `中文名|英文名|别名`）。因为内置的 192 位是我「知道的名人」，外置的是从数据集导出的——混在一起会让代码体积膨胀且难维护。

**决策逻辑集中在一处。** 双引擎的结果怎么合并，就一个函数：

```python
def _decide(self, matches, gallery_match) -> tuple[str, float, str]:
    # 人脸库优先：拿参考图比出来的结果比「看起来像」可靠
    if gallery_match and gallery_match.similarity >= 0.5:
        return self._display_name(gallery_match.name), gallery_match.similarity, SOURCE_GALLERY

    if matches and matches[0].similarity >= rec.min_similarity:
        return matches[0].display, matches[0].similarity, SOURCE_CLIP

    return "未识别", 0.0, SOURCE_UNKNOWN
```

注意 CLIP 的阈值 `min_similarity` 默认 **0.18**，很保守——**宁可说不知道，也不要瞎报一个名字**。一个识别系统如果总能给答案，那它的答案就没有信息量。

**合影里的同一人要合并。** 一张合影里同一个人出现两次（正脸 + 侧脸），应该报一个人，不是两个人。用 SFace 特征做聚类：

```python
threshold = self.config.recognize.merge_similarity  # 默认 0.6
for i in range(len(results)):
    for group in groups:
        rep = group[0]
        sim = float(np.dot(features[i], features[rep]))
        if sim >= threshold:
            group.append(i)
            break
    else:
        groups.append([i])
```

**两个引擎的输出格式必须统一。** 一开始人脸库直接返回目录名 `Tom_Cruise`，CLIP 返回 `汤姆·克鲁斯（Tom Cruise）`，同一次识别里两种格式混排，非常别扭。现在统一走 `_display_name()`，用候选表把英文名映射成中文展示名。

## 八、最终效果

真实环境跑一张合成的合影（Tom Cruise 两张 + Emma Watson + Messi）：

```
图片 512×512，检测到 3 张人脸（0 张未识别）

[1] 汤姆·克鲁斯（Tom Cruise）  置信度 85%  （来源：人脸库，合并了 1 张同脸）
    位置：x=20 y=10 w=230 h=240
[2] 艾玛·沃特森（Emma Watson） 置信度 66%  （来源：人脸库）
    位置：x=20 y=270 w=230 h=240
```

验证情况：**43 个测试全部通过，ruff 全绿**。

### 已知限制（都得诚实写出来）

- **CLIP 零样本不是身份认定**。它回答「像谁」，不回答「是谁」。要确认身份必须用人脸库。
- **候选表决定 CLIP 的天花板**。人不在表里就只能是陌生人——这也是为什么我把数据集的 997 位全导进去了。
- **SFace 跨库泛化有限**。它在 VGGFace2 上训练，中东/东亚面孔的特征区分度弱一些；同一人不同年龄、妆造差别大时可能匹配失败。
- **不做活体检测**。给一张打印照片同样能识别。这是识别，不是认证。
- **YuNet 有检测边界**。合成拼图里 Messi 那张脸，阈值降到 0.3 也检不出（单独看能检出 0.93）——是拼图布局的边缘情况，真实照片不受影响。

## 九、这次学到的三件事

**一、零样本模型的瓶颈在候选空间，不在模型。**

这个认知的价值远超任何单个技术点。它适用于所有「模型从固定集合里选一个」的场景——分类、检索、推荐、路由。**先量「真答案在不在搜索空间里」，再谈调模型。**

**二、评估方法比模型精度更值得先修。**

我一开始 77.8%，修完评估脚本的 bug 和候选表的错条目变 82.2%——**这 4.4% 跟模型一点关系都没有**，是测量本身在骗我。留着错误的评估，后面每个优化决策都会跟着错。

**三、固定输入就该缓存。**

候选表不变，文本特征就不该重算。351.6s → 19.4s，一个字典的事。有时候最大的性能问题不是「算得慢」，而是「根本不该算」。

---

这个项目在 [GitHub](https://github.com/lpw94/pythonStudy/tree/dev/celebrity_recognition)，`src/` + `scripts/` + `tests/` 共 3500 行，模型与素材不入库。有兴趣的话，下一篇我打算写**把这套双引擎接成一个 FastAPI 服务**，顺便处理多人并发下的模型复用和显存管理——那是另一个有意思的坑。

> 系列方法论总纲见 [前端工程师如何项目驱动学 Python](https://lpw94.github.io/post/python-project-driven-learning)。
