## 为什么是 supervision

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
