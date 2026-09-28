## 一、这次改了点啥

上一波（`14c9cb1`）打磨的是写作后台，这次提交（`18cc10d`）彻底转向**访客侧的玩具体验**，一口气加了四件东西：

- **悬浮音乐播放器**：右下角常驻，19 首免费曲单，折叠/展开两态；
- **3D 个人展厅**：新页面 `/gallery`，Three.js 画廊房间，点击画框弹项目介绍；
- **访客地图**：点侧边栏访客次数的数字，弹出腾讯地图看访客城市散点；
- **游戏中心**：贪吃蛇 / 扫雷 / 2048 三个弹窗小游戏，分数进 Supabase 排行榜（替换了原来的反应力测试）。

老规矩：加了什么 / 怎么做的 / 踩了什么坑。

## 二、悬浮音乐播放器

### 1. 架构：Audio 单例 + React 只是它的"遥控器"

核心决策：**不在 React state 里放音频对象**。`new Audio()` 用 `useRef` 持有，组件只是读取它的状态（currentTime / paused / volume）渲染 UI、调它的方法（play / pause）。这样切歌、调音量都不触发重渲染，只有进度条用 `timeupdate` 事件低频同步：

```ts
const audioRef = useRef<HTMLAudioElement | null>(null)
if (!audioRef.current) audioRef.current = new Audio()   // 单例，跨渲染复用
const audio = audioRef.current

useEffect(() => {
  const onTime = () => setProgress(audio.currentTime)
  const onEnded = () => next()                            // 播完自动下一首
  audio.addEventListener('timeupdate', onTime)
  audio.addEventListener('ended', onEnded)
  return () => { audio.removeEventListener('timeupdate', onTime); audio.removeEventListener('ended', onEnded) }
}, [audio])
```

两个容易翻车的细节：

- **`play()` 返回 Promise**：浏览器自动播放策略会 reject（用户还没交互过页面时），必须 `audio.play().catch(() => {})` 吞掉，否则控制台一片红；
- **状态持久化**：音量 / 当前曲目 / 面板展开态分别存 `localStorage`（`mp_volume` / `mp_track` / `mp_expanded`），刷新后原样恢复。

### 2. UI：折叠 FAB + 玻璃拟态面板

折叠态是一个 54px 圆钮，播放中外圈套一层 `conic-gradient` 旋转光环（纯 CSS `@keyframes`，`prefers-reduced-motion` 时停转）；展开是玻璃面板：旋转封面、可点击的进度条、⏮▶⏭、音量滑条、曲目列表。z-index 定 9997——比桌面宠物（9998）低、比弹窗（10000）低，谁也别挡谁。

### 3. 免费曲源：能用和"写着能用"是两回事

歌单 19 首全部来自可合法免费使用的源：**9 首 Kevin MacLeod（CC-BY 署名）**（incompetech 直链）+ **10 首 SoundHelix**（免费示例音频）。筛选过程是**逐条 `curl -I` 测连通性**——Bensound 官网看着很美，实际 301 跳 CDN 后 403 防盗链，浏览器里就是放不出来。教训：外链音频别信官网介绍，全量 HEAD 一遍再说。

## 三、3D 个人展厅

### 1. 场景：一间房，五幅画

新页面 `/gallery`：Three.js 搭一间深色画廊——地板 / 天花 / 三面墙 + 顶部长条灯带，项目以画框挂在后墙 3 幅、左右墙各 1 幅。交互是 `OrbitControls`（拖拽旋转 + 滚轮缩放 + 0.5 速自动慢转 + 阻尼），`Raycaster` 做拾取：hover 画框平滑放大 1.05 倍、鼠标变 pointer，点击通过 `onSelect` 回调弹出项目详情卡（技术栈标签 + 简介 + 在线链接）。

### 2. 封面零图片依赖：CanvasTexture

画框里的"画"没有一张真实图片——全是 `canvas` 现场画的：渐变底 + 装饰圆 + 标题（过长自动缩字号）+ 技术栈 + 提示文案，然后 `new THREE.CanvasTexture(c)` 贴上去。材质特意用 **`MeshBasicMaterial`**（自发光、不受灯光影响），保证文字在任何角度都清晰可读；画框木框才用 `MeshStandardMaterial` 吃光照。想换真实截图时，把 `makeCoverTexture()` 换成 `TextureLoader` 加载即可。

```ts
const coverMat = new THREE.MeshBasicMaterial({ map: coverTex })   // 文字画面：自发光
const frameMat = new THREE.MeshStandardMaterial({ color: 0x2a2218, roughness: 0.4, metalness: 0.6 })
```

收尾清单里最重要的是**完整 dispose**：geometry / material / texture / controls / renderer 全进 `disposables` 数组，effect cleanup 里逐个 `dispose()`——Three.js 页面进出几次就内存起飞，都是漏了这一步。

### 3. 踩坑：展厅黑屏，凶手是 CSS

第一版打开展厅是纯黑一块。排查渲染器、相机、灯光半天，最后发现：**挂载节点 `<div className="gallery3d">` 忘了写高度**。CSS 只定义了外层 `.gallery3d-wrap` 的高度，内层 div 高度塌成 0 → `renderer.setSize(w, 0)` → 画布 0 高，看到的"黑屏"其实只是外层容器的背景色 `#0b1020`（和场景背景色恰好一样，完美伪装）。一行 `.gallery3d { width: 100%; height: 100% }` 解决。教训：Three.js 黑屏先量容器尺寸，再怀疑代码。

## 四、访客地图：点数字看访客都在哪

### 1. 交互与合规先行

侧边栏访客次数的**大数字本身就是按钮**，点击弹出 760px 弹窗，里面是腾讯地图 + 红点散点。这个功能第一件做的事不是写代码，是定合规边界（个人信息保护法）：

- 坐标来自 `ipapi.co` 的 **IP 解析**（城市级），**不存 IP、不要 GPS 精确定位**；
- 入库前四舍五入到 **2 位小数（约 1.1km）**，页面只展示聚合散点，无法回溯到具体人；
- 每天每浏览器最多上报 1 次（`localStorage` 记日期，先落标记再发请求，StrictMode 双跑也不会重复）。

### 2. 坐标系：WGS-84 → GCJ-02

`ipapi.co` 返回 WGS-84 经纬度，腾讯地图用 GCJ-02（火星坐标系），国内点不转会有几十到几百米偏移。前端入库前先用经典公开算法转换（国外点按约定不偏移），腾讯地图拿来直接画：

```ts
const [lng, lat] = wgs84ToGcj02(data.longitude, data.latitude)
await supabase.from('visitor_locations').insert({
  lat: Math.round(lat * 100) / 100,
  lng: Math.round(lng * 100) / 100,
  city: data.city ?? null,
  country: data.country_name ?? null,
})
```

### 3. Key 的工程化处理

腾讯地图 GL JS 必须带 key。key 不进代码库：本地 `.env` 的 `VITE_TMAP_KEY`、线上 GitHub Secrets 同名，`deploy.yml` 构建时注入。组件做了**三级降级**：没配 key → 显示配置指引（不加载 SDK）；SDK 加载失败 → 提示检查 Referer 白名单；数据表还没建 → 地图照常显示、足迹数显 0。彩蛋功能的原则是**永远不能搞挂主站**。

## 五、游戏中心：三个小游戏 + 排行榜

### 1. 三个游戏的实现取舍

- **贪吃蛇**（canvas，15×15）：游戏状态（蛇身 / 方向 / 食物）全放 `useRef`，`setInterval` 驱动 tick，React state 只管分数显示和"开始/结束"覆盖层——避免每帧重渲染。禁止 180° 掉头这种细节在 tick 里判（比较 `pendingDir` 和当前方向）。
- **扫雷**（9×9，10 雷）：**第一次点击后才布雷**，且首点及其 8 邻域不布雷——保证开局必展开一片，不会第一下就踩雷（经典扫雷的惯例优化）。翻开用 flood fill 队列；胜利判定是"非雷格全部翻开"；触屏长按 400ms 插旗、短按翻开。
- **2048**：核心是纯函数——`slideRow`（压缩 + 合并一行）+ `transpose` / `reverseRows` 把四个方向统一成"向左滑"，移动前后 `JSON.stringify` 对比判断"这步有没有效"，无效不加新块。

键盘监听统一挂 `window`，但**输入框聚焦时直接放行**（`e.target instanceof HTMLInputElement`），不然排行榜填昵称时方向键会被游戏抢走。

### 2. 排行榜：一张表装三种分数语义

```sql
create table if not exists game_scores (
  id bigint generated always as identity primary key,
  game text not null check (game in ('snake', 'minesweeper', 'g2048')),
  player text not null,          -- 前端截断到 12 字符
  score integer not null,
  created_at timestamptz not null default now()
);
-- RLS：所有人可读可写（个人博客彩蛋，风险可控）
```

三种游戏分数语义不同：**贪吃蛇 = 食物数（降序）、扫雷 = 通关秒数（升序，仅胜利可提交）、2048 = 总分（降序）**。排序方向收敛在前端的游戏注册表里，查榜时按 `asc` 传参：

```ts
export const GAMES = [
  { id: 'snake',       name: '贪吃蛇', scoreLabel: '食物',     asc: false },
  { id: 'minesweeper', name: '扫雷',   scoreLabel: '用时(秒)', asc: true  },
  { id: 'g2048',       name: '2048',   scoreLabel: '分数',     asc: false },
]
```

### 3. 踩坑：`clearInterval(tick)` 清了个寂寞

贪吃蛇第一版构建直接挂掉：`return () => clearInterval(tick)`——把**游戏逻辑函数**当定时器 id 传进去了（应该是 `clearInterval(t)`）。`tsc` 一把揪出 `TS2345`。这个笔误再次验证了老教训：**本地验证必须跑完整 `npm run build`（含 `tsc -b`）**，只跑 `vite build`（esbuild 不做类型检查）这类错误会漏到 CI 才炸。

## 六、部署提醒（重要）

代码已上线，但两个新功能依赖手动步骤：

1. **建表**：Supabase SQL Editor 执行 `visitor_locations.sql`（地图足迹）和 `game_scores.sql`（排行榜）；
2. **腾讯地图 Key**：GitHub 仓库 Settings → Secrets → 新建 `VITE_TMAP_KEY`，然后在 Actions 手动重跑一次 Deploy（key 是构建时注入的，不配 secret 就重新构建，线上地图组件只会显示配置指引）。

不做的后果：地图弹窗显示配置指引、游戏能玩但不能上榜——**主站功能都不受影响**，所有降级路径都兜过底。

## 七、小结

这一波把博客从"能看"推向"能玩"：音乐、3D 展厅、地图、游戏，全是**一个组件 + 一段 SQL + 一处环境变量**的轻量加法，架构没动。共同的设计原则也沉淀下来了：

1. 彩蛋功能**永远降级优先**——key 缺失、表未建、接口超时，都必须静默或给指引，绝不白屏；
2. React 只管 UI，**可变游戏状态 / 音频对象放 ref**，别让每帧渲染卷入 state；
3. 第三方资源（曲源 / 地图）**实测验证**再入库，"官网写着支持"不算数。

下一批想做的是：2048 加滑动动画、排行榜加个"本周榜"时间窗。先摸鱼去了。
