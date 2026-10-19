## 一、这次改了什么

博客又动了四刀，主题从"加功能"拐向了"做减法"——前两刀是给首页加一道锁，后两刀是把太吵的东西拿掉：

- **首页锁屏遮罩**：进首页先盖一层全屏遮罩，内容不是空白，而是问候、随机标语、实时时钟和漂浮的 emoji
- **算术题密码**：解锁方式从"点一下"改成"答对一道随机算术题"，答错换题重来
- **2 分钟空闲自动锁屏**：人离开一会儿，页面自己锁上；顶部还放了个 🔒 按钮随时手动唤出
- **背景做减法**：把原来那套鼠标视差 + 自转的 3D 粒子星河换成了锁屏同款的静态深色渐变——上一版背景太显眼，抢正文的戏

老规矩：加了什么 / 怎么做的 / 为什么这么做。

## 二、锁屏遮罩：怎么盖住一个已经在滚动的页面

锁屏的骨架很简单：一个 `position: fixed; inset: 0` 的全屏层。但这里有个前面踩过的老坑要绕开——中间白卡 `.container` 带 `backdrop-filter` 玻璃拟态，它会让内部所有 `position: fixed` 元素改为相对容器定位。所以锁屏层照例走 `createPortal` 挂到 `document.body`：

```tsx
return createPortal(
  <div className="lock-screen" role="dialog" aria-modal="true" aria-label="锁屏">
    {/* 背景漂浮 emoji + 中间卡片 */}
  </div>,
  document.body,
)
```

`z-index: 9998`，压在内容层之上、点击特效层（9999）之下。整个遮罩 `overflow: hidden`，页面高度怎么变都滚不动它。

### 遮罩里放点有意思的

全屏遮罩最容易做成一块纯色板，于是往里塞了几样东西：

| 内容 | 做法 |
| --- | --- |
| 按时段问候 | 0–5 点「夜深了，注意休息」、6–11 点「早上好」、中午 / 下午 / 晚上各一句 |
| 随机标语 | 十几条开发者吐槽 / 鼓励语，挂载时随机抽一条（`useMemo` 固定，避免每秒重抽） |
| 实时时钟 | `setInterval` 每秒跳一次，秒数用小字号上标，等宽数字不抖动 |
| 漂浮 emoji | 10 个 💻🚀☕🌟… 随机水平位置、延迟、时长，`lockFloat` 从底部缓慢上浮旋转淡出 |
| 日期星期 | 中文年月日 + 星期几 |

一句 `animation` 就能造出"背景在动但不吵"的效果，关键是**慢**：上浮 7–13 秒一轮、自转幅度 40 度封顶，比粒子星空克制得多。

## 三、解锁方式：从「点一下」到「答对一道题」

第一版锁屏是点任意位置解锁，简单直接。但既然叫"锁屏"，点一下就开总觉得差点意思，于是改成了算术题密码：**挂载时随机出一道题，输入正确答案才 `onUnlock()`**。

```ts
function rand(min: number, max: number) {
  return Math.floor(Math.random() * (max - min + 1)) + min
}

function makeProblem() {
  const op = ['+', '-', '×'][rand(0, 2)]
  if (op === '+') {
    const a = rand(2, 19), b = rand(2, 19)
    return { a, b, op, answer: a + b }
  }
  if (op === '-') {
    const a = rand(6, 20), b = rand(1, a - 1) // 保证结果非负
    return { a, b, op, answer: a - b }
  }
  const a = rand(2, 9), b = rand(2, 9)         // 九九表范围
  return { a, b, op, answer: a * b }
}
```

题目难度特意压低：加法两位数、减法保证不出现负数、乘法限制在九九表内。锁屏是为了拦"顺手点开的人"，不是考数学。

几个交互细节：

- **输入框自动聚焦**，进来直接敲数字，不用先点一下
- 输入用 `inputMode="numeric"`，`onChange` 里 `replace(/\D/g, '')` 只留数字
- 答对 → `onUnlock()`
- 答错 → 清空输入、**换一道新题**、表单左右抖动 0.45 秒、下面一行红字提示
- 空输入 → 只抖不换题，提示「先输入答案哦」

抖动用的是关键帧位移，配合 `prefers-reduced-motion` 在系统开启"减少动态效果"时整体关掉，无障碍不影响可用性。

## 四、没有滚动条，以及 2 分钟自动锁

### 锁屏期间不许滚动

锁屏层自己是 `overflow: hidden`，但背后那层页面还在。不处理的话，遮罩盖着、滚轮一动背景照样滚，还能从遮罩边缘看见滚动条在动。修法一句话——挂载时锁住 body：

```tsx
useEffect(() => {
  const prev = document.body.style.overflow
  document.body.style.overflow = 'hidden'
  return () => { document.body.style.overflow = prev }
}, [])
```

卸载时还原成原值而不是硬写 `''`，这样它和退出确认弹窗等其它浮层共存时不会互相踩。

### 2 分钟不动就锁

自动锁屏是典型的空闲检测：监听鼠标、键盘、滚动、触摸，任何一个动作就把 2 分钟倒计时重置。

```tsx
useEffect(() => {
  if (pathname !== '/') return           // 只在首页
  const IDLE_MS = 2 * 60 * 1000
  let timer: number
  const arm = () => {
    clearTimeout(timer)
    if (!locked) timer = window.setTimeout(() => setLocked(true), IDLE_MS)
  }
  const events = ['mousemove', 'mousedown', 'keydown', 'scroll', 'touchstart', 'wheel']
  events.forEach((e) => window.addEventListener(e, arm, { passive: true }))
  arm()
  return () => {
    clearTimeout(timer)
    events.forEach((e) => window.removeEventListener(e, arm))
  }
}, [pathname, locked])
```

有两个容易写错的地方：

1. **`locked` 要进依赖数组**。解锁后需要重新挂一轮计时器，否则只有刷新页面才会再自动锁。
2. **已锁屏时不再挂定时器**（`if (!locked)`）。否则锁着的时候鼠标一动就重置、过 2 分钟再触发一次，纯属空转。

另外"进首页自动弹一次"用 `sessionStorage` 记了个标记（`lock-screen-seen`），**同一个会话只打扰一次**，刷新页面不会再被拦；想再看就点顶部那个 🔒 按钮，按钮在非首页点会先跳回首页再锁。

## 五、背景做减法：把 3D 星河换成一块静态渐变

真正的大动作在这儿。原来首页背景是一套 Three.js 粒子星河：2200 个球面分布的发光点、缓慢自转、鼠标视差、加法混合。技术上挺有意思，但实际体验是——**太显眼了**。人还没看正文，视线先被满屏流动的光点拽走。

于是把它整个拿掉，换成锁屏同款的静态深色渐变：

```css
.site-bg {
  position: fixed;
  inset: 0;
  z-index: -1;
  pointer-events: none;
  background:
    radial-gradient(1200px 800px at 20% 20%, rgba(37, 99, 235, 0.42), transparent 60%),
    radial-gradient(1000px 700px at 85% 75%, rgba(236, 72, 153, 0.38), transparent 60%),
    linear-gradient(135deg, #0f172a 0%, #1e293b 45%, #0b1020 100%);
}
```

做法上是三件事：

| 动作 | 说明 |
| --- | --- |
| 删组件 | `Background3D.tsx` 与配套的 `lib/themes.ts` 一并移除，首页不再加载粒子场景 |
| 换背景 | 新增固定定位的 `.site-bg` 层，渐变与锁屏保持一致（蓝 / 粉两团光晕 + 深 navy 底） |
| 拆依赖 | 顶部「背景主题」下拉移除；`CursorFX` 的点击特效改成固定蓝色相，不再依赖主题色 |

两个取舍值得说：

- **光晕 alpha 比锁屏略低**（0.42 / 0.38 对 0.55 / 0.5）。锁屏是短暂的全屏画面，可以浓一点；页面背景要长期待着，淡一点才不压正文。
- **`three` 没有从依赖里删**。展厅页的 `Gallery3D` 还在用 Three.js，首页不加载粒子序列即可；构建仍会把 three 打进包里，但首页的执行路径已经绕开它了。

中间白卡（`.container`）的玻璃拟态没动，深色渐变透过毛玻璃边缘，反而比粒子星空更耐看——这是"少即是多"难得的正面案例。

## 六、小结

| 改动 | 一句话 |
| --- | --- |
| 锁屏遮罩 | `createPortal` 挂 body 的全屏层，绕开 `backdrop-filter` 的 fixed 包含块坑 |
| 遮罩内容 | 时段问候 + 随机标语 + 秒级时钟 + 漂浮 emoji，慢速动画不抢戏 |
| 算术题密码 | 随机 +/−/×，结果非负、难度适中；答对解锁，答错换题 + 抖动 |
| 无滚动条 | 锁屏挂载时锁 `body overflow`，卸载还原原值 |
| 空闲自动锁 | 六类事件重置 2 分钟倒计时，`locked` 进依赖，已锁不空转 |
| 背景减法 | 移除 3D 粒子星河，换锁屏同款静态渐变；主题下拉与 CursorFX 主题依赖一并拆掉 |

这几刀下来最大的感受是：**加功能是本事，敢减才是判断**。锁屏的"有意思"靠内容不靠动效，背景的"高级感"靠克制不靠粒子数量。下一步打算给锁屏加个"今日一言"接口，以及把空闲时间做成可配置——有坑了继续来写实录。
