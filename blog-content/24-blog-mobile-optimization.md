## 一、先说方法：别凭感觉改移动端

这个博客一直是"响应式"的——`index.css` 里躺着几条 `@media`，桌面端看着也还行。但"能响应"和"手机上像样"是两回事：断点里只压了点 padding 和字号，真正的布局问题一个没碰。

于是我给自己定了个规矩：**先量，再改，改完再量**。具体做法是启动 dev server，用 Chrome headless 的 CDP（`Emulation.setDeviceMetricsOverride`）把视口精确设成 iPhone 的 390×844 / DPR 2 / 移动 UA，逐页截图，再用 `Runtime.evaluate` 把关键元素的 `getBoundingClientRect()` 打出来——看数据说话，不靠"感觉有点挤"。

### 这里有个假象，先排掉

第一版我图省事，直接用命令行截图：

```bash
chrome --headless=new --window-size=390,844 --screenshot=tools.png http://localhost:5173/tools
```

截出来一看：整个页面右侧被裁掉一大块，导航按钮、副标题、卡片全被切了，活像横向溢出。

差点就去查 `overflow-x` 了。直到我把视口宽度打出来——`innerWidth` 是 **500 多**，不是 390。原因是 **Windows 下 Chrome 窗口有最小宽度限制**，`--window-size` 传 390 会被忽略，实际开出来的是个更宽的窗口，再被裁成 390 宽的图。所谓"横向溢出"纯粹是截图假象。真实视口 390 下，`document.scrollWidth === innerWidth`，一点没溢。

结论：**移动端调试必须用 `Emulation.setDeviceMetricsOverride`，别信 `--window-size`**。这个坑值得单独记一笔，因为它会把你引向完全不存在的 bug。

## 二、量出来的问题清单

数据一摆，问题很清楚（视口 390×844）：

| 问题 | 实测数据 |
| --- | --- |
| 顶栏占三行 | 高度 **128px**：logo 一行、导航整行、搜索框再整行 |
| 文章标题过大 | `<h1>` 是浏览器默认 **32px / 行高 51px**，长标题占四行 = 205px，首屏几乎只剩标题 |
| 文章 meta 挤坏 | 「2026-10-20」被折成两行，日期读起来像两个数字 |
| 首页一屏只 2 条 | 卡片标题 24px + padding 20px，390 宽下太占地方 |
| 分类筛选占 2 行 | 按钮换行堆积，把文章列表往下推 |
| 工具箱 tab 占 3 行 | 同上，更严重 |
| 3D 展厅画框被裁 | 竖屏时后墙两侧的画框各被切掉一半 |
| 提示文案不对 | 「滚轮缩放」——手机没有滚轮 |
| 触控手感差 | 点完卡片一直亮着蓝色 hover 边框；点了还有灰色方块闪烁 |
| 刘海屏贴边 | 内容直接顶到屏幕边缘 |

条条都是硬的，没有一条是"感觉"。

## 三、顶栏：128px → 96px，三行压两行

顶栏原本的结构是 `logo + 搜索框 + 导航` 一个 flex 容器，移动端有条既有规则：

```css
/* 原有规则：搜索框独占一整行，排到最后 */
.search-box { flex: 1 1 100%; order: 3; }
```

`flex-basis: 100%` 加上 `order: 3`，等于强制搜索框换行。我第一次只覆盖了 `flex`，忘了 `order`，改完截图一看——**还是三行**。因为 `order` 没重置，搜索框照样被排到最后去了。补上 `order: 0` 才生效：

```css
@media (max-width: 720px) {
  .search-box { flex: 1 1 auto; min-width: 0; max-width: none; order: 0; }
}
```

`min-width: 0` 这行不能少——flex 子项默认 `min-width: auto`，里面的 `<input>` 有自己的默认宽度，不给 0 的话搜索框不肯缩，照样把 logo 挤出去。

改完的效果：

| | 优化前 | 优化后 |
| --- | --- | --- |
| 行数 | 3 行 | **2 行**（第一行 logo + 搜索框，第二行导航） |
| 高度 | 128px | **96px** |

顺带把导航收敛成 `.site-header nav`，字号 13px、间距压缩、允许换行居中。

## 四、被 `nav` 选择器误伤的分类栏

分类筛选原本是换行的按钮组，我改成单行横向滑动：

```css
.category-filter {
  flex-wrap: nowrap;
  overflow-x: auto;
  scrollbar-width: none;              /* Firefox 隐藏滚动条 */
  -webkit-overflow-scrolling: touch;  /* iOS 惯性滚动 */
}
.category-filter::-webkit-scrollbar { display: none; }
```

结果截图里第一个「全部」按钮**被切掉一半，跑到容器外面去了**。

查计算样式才发现原因：`.category-filter` 这个元素本身是个 `<nav>`。我为了压顶栏写的那条 `nav { justify-content: center }` 把它一起命中了；另外文件里本来就还躺着一条 720 断点的 `nav { justify-content: center }`。**当 flex 内容溢出容器时，`justify-content: center` 会让内容向两侧对称溢出**——左边那半直接滚出了可视区，而且因为 `overflow-x: auto` 的滚动起点在最左，用户还滚不到它。

两个修法一起上：

1. 顶栏规则收敛成 `.site-header nav`，别再用裸 `nav`
2. 分类栏显式重置 `justify-content: flex-start`

这条经验挺通用：**写响应式规则时，选择器一定要足够具体**。裸标签选择器在移动端断点里是定时炸弹，你永远不知道哪天新加一个同标签的元素就被误伤，而且症状（内容偏出容器）跟原因（居中 + 溢出）看起来毫无关系。

## 五、正文与卡片：字号收敛

`<h1>` 的问题最典型——全站没给 `h1` 定过字号，浏览器默认的 `2em`（16px × 2 = 32px）在桌面宽屏下勉强能看，手机上就是灾难。390 宽、长标题四行、205px 高，一屏全是标题。

```css
.post-detail h1 { font-size: 23px; line-height: 1.38; letter-spacing: 0; }
```

23px / 1.38 是试出来的：再小正文标题就没了层级感，再大就要四行。同理往下扫一遍：

| 元素 | 优化前 | 优化后 |
| --- | --- | --- |
| 正文 | 默认 | 15px / 行高 1.78（手机上比桌面更松） |
| `h2` | 22px | 19px |
| `h3` | 18px | 16px |
| 代码块 | 13px | 12px（宁可小一点也不要横向滚） |
| 表格 | 撑破正文 | `display: block; overflow-x: auto`，整块自己横向滚 |
| 首页卡片标题 | 24px | 18px |
| 卡片 padding | 20px | 14px |
| 卡片封面高 | 180px | 150px |

卡片这一组改完，首页一屏从 **2 条**变成 **4~5 条**，体感差别最大。

文章 meta 单独处理了一下——它是个 `flex-wrap` 容器，本来就允许换行，但每个子项内部也在折，导致日期被拆开：

```css
.post-detail .post-meta { flex-wrap: wrap; gap: 6px 10px; font-size: 12px; }
.post-detail .post-meta > * { white-space: nowrap; }   /* 整体换行，但内部不折 */
```

一句话总结这类改法：**容器允许换行，原子项不许折行**。

## 六、3D 展厅：竖屏时相机得往后退

展厅是 Three.js 的一个房间，五幅画挂在后墙和左右墙上，相机固定 `fov: 55`、`position.z = 5.2`。桌面 16:9 下构图刚好，手机竖屏（390×844，宽高比 0.46）就完了——**水平视野被压窄，后墙两侧的画框各被裁掉一半**。

透视相机的 `fov` 是**垂直**视野角，垂直方向不变、水平方向随宽高比收缩。所以竖屏时得手动把垂直 fov 拉开：

```ts
const applyCamera = () => {
  const aspect = host.clientWidth / host.clientHeight
  // 竖屏：垂直视野拉宽，等价于把画面「退远」
  camera.fov = aspect < 0.95 ? 70 : 55
  camera.position.z = aspect < 0.95 ? 7.4 : 5.2
  camera.updateProjectionMatrix()
}
```

`updateProjectionMatrix()` 不能忘——改了 `fov` 不调用它，Three.js 还用着旧的投影矩阵，等于白改。

另外两处配套：
- `controls.maxDistance` 从 8 放宽到 12，手机双指缩放能退得更远
- `resize` 时重算一遍，横竖屏切换（很多人躺着刷手机）不用刷新页面

还有那个提示文案——「🖱️ 拖拽旋转 · 滚轮缩放」在手机上很滑稽，滚轮根本不存在。用 CSS 做文案切换：

```css
.hint-touch { display: none; }                  /* 默认藏起触屏文案 */
@media (max-width: 720px) {
  .hint-touch { display: inline; }
  .hint-pointer { display: none; }
}
```

**这里我第一版写错了**：把 `.hint-touch { display: none }` 放在媒体查询**后面**。同样的选择器、同样的优先级，后面的规则胜出，于是移动端那句 `display: inline` 被覆盖，两边文案都不见了。CSS 是级联的，默认态必须放在断点前面——这种"改完反而更糟"的 bug，纯粹是顺序问题。

## 七、触控、安全区，和那些看不见的细节

| 项 | 做法 |
| --- | --- |
| 粘滞 hover | `@media (hover: none)` 里把 `.post-card:hover` 还原成默认边框、`.tools-card/.note-card:hover` 去掉位移——触屏没有"移开"这个动作，hover 会一直亮着 |
| 点击灰块 | `html { -webkit-tap-highlight-color: transparent }`，去掉 iOS/Android 点击元素时的灰色方块 |
| 触控尺寸 | 翻页按钮、卡片按钮 `min-height: 38px`，拇指点得中 |
| 刘海屏 | `viewport-fit=cover` + `padding-left/right: max(12px, env(safe-area-inset-left/right))`，横屏时不压到刘海下的圆角 |
| 底部横条 | `footer` 与悬浮按钮统一加 `padding-bottom: max(24px, env(safe-area-inset-bottom))` |
| 弹窗高度 | `.modal { max-height: calc(100dvh - 24px) }`——`100vh` 在移动浏览器里算的是"地址栏收起时"的高度，弹窗会顶出屏幕；`dvh` 才跟着可视区走 |
| 横向滚动条 | 分类栏和 tab 的滚动条用 `scrollbar-width: none` + `::-webkit-scrollbar` 一起隐掉，滑动仍然可用 |

这些单拎出来都不算"功能"，但叠起来就是"像不像一个手机应用"的差别。

## 八、又一次撞上 dev server 的陈旧缓存

改完分类栏的对齐后重新截图，**新图和上一张像素级完全一致**——连我明明确认已经改掉的居中错位都还在。

之前踩过一次同样的坑（书签弹窗挂载目标丢失那次），所以这次反应快：不是 CSS 没生效，是 dev server 的文件监听又漏了变更，还在 Serving 旧版本。`touch src/styles/index.css` 一下，重新 transform，再截图——立刻正常。

这类问题的排查套路固定：

```bash
# 看服务器到底在 Serving 什么
curl -s http://localhost:5173/src/styles/index.css | head -40
# 如果和磁盘对不上
touch src/styles/index.css
```

**别急着改代码**。当"改了没反应"或"改完更奇怪"时，先确认浏览器拿到的到底是不是你刚写的那份。

## 九、结果

| 指标 | 优化前 | 优化后 |
| --- | --- | --- |
| 顶栏高度 | 128px / 3 行 | 96px / 2 行 |
| 文章 `h1` | 32px / 行高 51（四行 205px） | 23px / 1.38（三行） |
| 首页首屏条数 | 2 条 | 4~5 条 |
| 分类 / tab | 2~3 行换行 | 单行横滑 |
| 展厅竖屏 | 两侧画框各裁一半 | 完整，转屏自动重算 |
| 横向溢出 | — | 390 / 320 两档均 `scrollWidth === innerWidth` |

全部规则都限定在 `@media (max-width: 720px)` 和 `@media (hover: none)` 里，**桌面端样式一行没动**。这是刻意守的边界：移动端优化最怕的就是顺手改通用规则，桌面端悄悄回退了还没人发现。

三条经验收尾：

1. **先量再改**。`getBoundingClientRect()` 打出来的数字，比"感觉有点挤"可靠一百倍，也能立刻证伪假象（比如那个 `--window-size` 的坑）。
2. **断点里的选择器要具体**。裸 `nav`、裸 `h1` 会误伤，症状和原因之间还隔着一层，查起来极费劲。
3. **改完必须复验**。截图 → 改 → 截图，比对的是同一套设备指标；发现"完全没变"先怀疑工具链缓存，别怀疑自己的代码。

下一步想做的：把断点从 720 再细分一档（480 以下给超窄屏单独收字号），以及给文章页加一个移动端浮动目录。有坑继续写。
