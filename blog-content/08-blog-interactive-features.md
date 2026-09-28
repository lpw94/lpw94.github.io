## 一、这次又给博客加了点啥

上一批提交（`54f0ed3`）一口气堆了不少"花活"：深空 3D 背景、点击特效、桌面宠物、侧边栏小游戏……目标只有一个——让这个静态博客**看起来不像静态博客**，逛起来有呼吸感、有互动。

下面按"加了什么 / 怎么做的 / 踩了什么坑"拆解。所有代码都已上线，硬刷 `lpw94.github.io` 就能看到。

## 二、炫酷 3D 背景（还能换皮肤）

### 1. 效果

全屏固定层是一整片**发光粒子星河**：深空蓝紫的粒子缓缓自转，鼠标移动时整片星河跟着做轻微视差。页面正文则包在半透明玻璃卡片里，既露出两侧的 3D 氛围，又保证文字清晰。

顶部栏右侧多了个下拉，可以一键切换 4 套主题：

| 主题 | 风格 |
| --- | --- |
| `nebula`（默认） | 深空星河，蓝紫 |
| `aurora` | 极光流光，青 → 紫粉 |
| `cyber` | 赛博网格，高饱和青 |
| `sunset` | 黄昏暖色，红橙粉 |

**选中的主题会存进 `localStorage`**，刷新不丢。

### 2. 做法

用 `Three.js` 的 `Points` 画粒子，关键是把"方块点"变成"圆点"——给材质贴一张 canvas 生成的径向渐变柔光图：

```ts
function createCircleTexture(): CanvasTexture {
  const size = 64
  const c = document.createElement('canvas')
  c.width = c.height = size
  const ctx = c.getContext('2d')!
  const g = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2)
  g.addColorStop(0, 'rgba(255,255,255,1)')
  g.addColorStop(0.4, 'rgba(255,255,255,0.85)')
  g.addColorStop(1, 'rgba(255,255,255,0)')
  ctx.fillStyle = g
  ctx.fillRect(0, 0, size, size)
  return new CanvasTexture(c)
}
```

主题配置抽成一张表 `src/lib/themes.ts`，每项带 `hue / sat / light / size / bodyBg`，背景组件和页面底色都从里面取值：

```ts
export const THEMES: BgTheme[] = [
  { id: 'nebula', label: '深空星河', hue: 222, sat: 90, light: 70, size: 2.4,
    bodyBg: 'radial-gradient(1200px 800px at 20% 10%, #16224a, transparent), ...' },
  // aurora / cyber / sunset ...
]
```

切换主题时 `useEffect([theme])` 重建整个场景，卸载时 `dispose` 全部 GPU 资源，避免内存泄漏。

### 3. 两个取舍

- **可读性优先**：玻璃卡片始终是浅色底 + 深色字，切换主题只改背景氛围，正文永远清晰；
- **尊重 `prefers-reduced-motion`**：系统开了"减少动态"，只渲染一帧静态画面、不跑动画循环，照顾晕动症和续航；
- 移动端自动把粒子数降到约 900，`resize` 自适应。

## 三、点击特效（只要点击，不要跟随）

原本想做"发光光标跟随"，但试下来太抢戏、还干扰阅读。改为**只对点击有反应**：点一下页面，落点处泛开一圈涟漪、再迸出十几颗彩色粒子（配色跟随当前主题色相），随后淡出。

实现上顺手做了个优化：动画循环**按需启动**——只有 `pointerdown` 时才 `requestAnimationFrame`，涟漪和粒子全部淡出后自动 `cancelAnimationFrame` 停掉。空闲时 CPU 占用是 0，不像常驻循环那样一直空转。

```ts
const onDown = (e: PointerEvent) => {
  ripples.push({ x: e.clientX, y: e.clientY, t: now })      // 涟漪
  for (let i = 0; i < 16; i++) particles.push(spawn(e, i))  // 粒子迸发
  if (!raf) raf = requestAnimationFrame(loop)
}
```

## 四、文章弹窗：先修"不能滚"，再美化

### 1. 一个让我栽跟头的回归

给内容容器加 `backdrop-filter`（玻璃拟态）后，弹窗突然**不能滚动、定位也飘了**。排查发现：`backdrop-filter` 会让元素变成内部 `position: fixed` 的**包含块**，而三个弹窗的遮罩层都是 fixed——结果它们被锁死在 1000px 宽的玻璃列里，而不是整个视口。

修法是把文章弹窗、登录弹窗、退出确认弹窗统统用 `createPortal` 挂到 `document.body`，彻底脱离玻璃容器，fixed 重新相对视口生效。

### 2. 顺手做的美化

- 弹窗固定成 `900 × 82vh` 窗口，正文再长也只在窗口内滚动；
- 字段重排：标题 / 路径 / 类型 / 状态成一组（类型状态横向并排），正文编辑器挪到下方；
- 每个输入框加了 `<label>`，点进去有蓝色聚焦光环；
- 保存 / 取消按钮靠右对齐。

## 五、侧边栏：四个无聊但解压的小组件

ProfileCard 下面原本空着，塞了四个卡片：

| 组件 | 干啥的 |
| --- | --- |
| `TimeWidget` | 实时走字时钟 + 早/中/下/晚好 + 年月日星期 |
| `FortuneWidget` | 今日运势抽签：签等级、签文、宜/忌、幸运色。**当天结果用日期哈希固定**，刷新不变；"再抽一签"可随机重抽 |
| `ReactionGame` | 反应力测试：等绿 → 点屏幕计时，绿前抢跑算犯规；最佳成绩存 `localStorage` |
| `AdSlot` | 合规广告位占位，带"广告"角标，留了 `src/href` 接口接真实广告（外链 `rel="sponsored"`） |

这几个组件都是零依赖、纯 `setInterval` / `Math.random` 的小玩意儿，主打一个"逛博客顺便摸鱼"。

## 六、桌面宠物：从屏幕两边溜出来

最后加了个 emoji 桌面宠物（🐱🐶🐲🐰🦊🐼 随机轮换）。它会每隔十几秒从**内容区左或右外缘**走进来，在底部蹦跶一会儿，再走回消失；点一下它会蹦两下、冒个气泡说句俏皮话。

几个细节：

- 整层 `pointer-events: none`，**只有宠物按钮本身可点**，绝不会挡住下面的链接和按钮；
- 放大到 76px、`z-index` 提到 9998（仍低于弹窗的 10000，不会盖住弹窗），深空背景下加了呼吸蓝光更显眼；
- 同样尊重 `prefers-reduced-motion`：开启时宠物常驻右侧、静态可点、不自动游走。

> 调试时踩过两个坑：系统开"减少动态"会让它直接 `return null` 不渲染；首现等待太久（12~32s）不易察觉。都已修掉——现在加载后约 1.5 秒就会冒出来。

## 七、顺手填的 Supabase 合规坑

10/30 起 Supabase 要求 `public` 新建表显式 `GRANT`，否则 Data API 读不到。现有表不受影响，但 `supabase db reset` / 新建分支重跑 schema 时会中招。于是在 `schema.sql` 给 `posts` / `comments` 补了授权，权限范围对齐现有 RLS：

```sql
grant select on public.posts to anon;
grant select, insert, update, delete on public.posts to authenticated;
grant all on public.posts to service_role;
-- comments 同理（anon 还多一个 insert，对应"读者免登录留言"）
```

重跑 schema 是幂等的，对线上库只是重授权，无副作用。

## 八、小结

这一波把博客从一个"能看文章的地方"变成了一个**有点性格的小站**：

- 背景会呼吸、能换皮肤；
- 点击有反馈、有仪式感；
- 侧边栏能摸鱼、能算命；
- 偶尔还有只小动物从边上溜过来跟你打招呼。

技术上没引入重架构，大部分是"一个组件 + 一段 CSS + 几个 hook"的轻量加法，胜在每块都来自"逛自己博客时觉得缺了点啥"的真实念头。下一个想加的，大概是宠物能跟鼠标逗着玩，或者背景随音乐律动——先这样，去看文章吧。
