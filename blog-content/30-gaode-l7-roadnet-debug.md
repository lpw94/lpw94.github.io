# 在高德 3D 大屏里用 @antv/l7 画线：一个被「着色器报错」坑了一整天的故事

> 项目背景：广西科技大学智慧水务大屏（React + Umi 3 + @antv/l7 2.28 + @antv/l7-three + 高德 3D）。需求是在地图上叠加路网线——文昌 `guangxikeji.geojson`、柳东 `demo.geojson`。结果从「线不显示」一路排查到 `WebGL: INVALID_OPERATION: drawElements: no valid shader program in use`，中间踩了路径 404、竞态、着色器配置三个假目标，最后发现元凶是 L7 的 `LineLayer` 和 `l7-three` 的 `ThreeLayer` 在抢同一个 WebGL context。本文把完整时间线和避坑清单记下来，给同样在 L7 + 高德 3D 大屏里和线/点/面搏斗的朋友一个参考。

## 一、需求与现场

大屏地图用高德 3D（`GaodeMap`，`viewMode: '3D'`），`scene.on('loaded')` 时会挂一个 `l7-three` 的 `ThreeLayer` 负责 3D 楼栋/设备模型：

```ts
scene.registerRenderService(ThreeRender);
const threeJSLayer = new ThreeLayer({ enableMultiPassRenderer: false, onAddMeshes });
scene.addLayer(threeJSLayer);
onSceneLoaded(scene, threeScene, threeJSLayer); // ← 路网层在这里被触发
```

路网层 `addHighwayLayer` 接收这个 scene，用 L7 `LineLayer` 把两条 geojson 画上去（文昌青色、柳东红色）。最初的代码长这样：

```ts
const layer = new LineLayer({})
  .source(lineFeatures, { parser: { type: 'geojson', coordinateSystem: 'GCJ02' } })
  .shape('line')
  .size(3)
  .color('#13c2c2')
  .style({ opacity: 0.9 });
scene.addLayer(layer);
```

逻辑没问题，但地图上**一根线都没有**。下面是完整的排查时间线。

## 二、排查时间线（三个假目标）

### 2.1 第一眼：fetch 返回 200，地图没线 —— 以为是相对路径 404

控制台里 `[路网] 柳东 请求状态 200` 明明成功了，但 `JSON.parse` 报错、线要素为 0。

**根因**：`fetch('./demo.geojson')` 在 `/gx_kejidaxue` 路由下，被浏览器解析成 `/gx_kejidaxue/demo.geojson`。SPA 的 history fallback 会把未知路径返回 `index.html`，于是 `fetch` 拿到的是 HTML 而不是 JSON，`JSON.parse` 静默失败。

**修复**：用 `process.env.PUBLIC_URL` 拼绝对路径，避开路由深链：

```ts
const publicAsset = (name: string): string => {
  const base = process.env.PUBLIC_URL || '';
  if (!base) return `/${name}`;
  return `${base.replace(/\/$/, '')}/${name}`;
};
const liudongUrl = publicAsset('demo.geojson'); // 开发环境 -> /demo.geojson
```

这一步是**真问题之一**，解决了「数据读不到」。修完后线要素能正常解析，但地图还是没线。

### 2.2 第二眼：线「一闪就没了」—— 以为是 addLayer 与 fitBounds 竞态

数据读到了，线**闪了一下消失**。直觉是 `addLayer` 之后立刻同步 `scene.fitBounds` 触发场景重渲染，把刚加进去、模型还没 build 完的线图层冲掉了。

于是加了 `zIndex`、把 `fitBounds` 延迟到「确认图层已在 scene 内」再做，并挂了每 700ms 的诊断探针打印 `柳东层仍在 scene=? | 相机中心=?`。

**结果**：探针显示 `柳东层仍在 scene=true`、`相机中心=109.5237,24.3855`（正是柳东线范围），线却依然不显示。说明**不是竞态、不是挂载问题、也不是相机问题**——图层确实在，相机也对准了，但 draw 阶段没画出来。这一步留下的 `延迟 fitBounds` 保留到了最终方案，但竞态假设本身不成立。

### 2.3 第三眼：控制台报 `no valid shader program` —— 以为是 LineLayer 配置

真机控制台出现关键报错：

```
WebGL: INVALID_OPERATION: drawElements: no valid shader program in use
```

直觉是 L7 `LineLayer` 的着色器编译失败。当时代码用了字段回调色 + `zIndex: 10`：

```ts
.color('highway', (h) => ({ secondary: '#13c2c2', ... }[h] || '#13c2c2'))
```

假设是「字段回调色 + zIndex 触发 shader 报错」，于是去 `zIndex`、把颜色改成常量色 `#13c2c2` / `#ff4d4f`，对齐项目里能正常渲染的**水表管线层**（同样 `LineLayer`、常量色、size 3、opacity 0.9）。

**结果**：还是不显示。但这一步无意中留下一条极关键的线索——**水表管线层（同样写法）能显示，路网层（同样写法）不显示**。同一个 `LineLayer` API，差异只在「什么时候 add」，这直接指向了上下文/时机问题，而不是配置。

## 三、转折：为什么同样 LineLayer，水表能画、路网画不出？

把两个 `LineLayer` 的调用时机摆在一起：

| 图层 | add 时机 | 结果 |
| --- | --- | --- |
| 水表管线层 | 水表数据**异步加载后**才 `addLayer` | ✅ 显示 |
| 路网层 | `scene.on('loaded')` 里**紧跟 `addLayer(threeJSLayer)` 之后**就 `addLayer` | ❌ 不显示 |

差异一目了然：**不是 `LineLayer` 怎么写的问题，而是它和谁共用 WebGL context、在什么时候进入渲染管线的问题。**

## 四、真正的根因：LineLayer 与 ThreeLayer 抢同一个 WebGL context

`@antv/l7` 的 `PointLayer` / `LineLayer` / `PolygonLayer`，和 `@antv/l7-three` 的 `ThreeLayer`，**共用同一个 WebGL 渲染上下文**（高德 3D 场景下 L7 把地图和 Three.js 渲染混在同一个 canvas/context 里）。

渲染时，L7 的 `LineLayer.draw` 和 Three.js 的渲染都会调用 `gl.useProgram`。当两者交错、某一帧 `LineLayer` 发起 `drawElements` 时当前绑定的 program 是无效的（典型如 Three.js 刚渲染完没正确 rebind 回 L7 的 program），WebGL 直接抛：

```
WebGL: INVALID_OPERATION: drawElements: no valid shader program in use
```

这一帧的线就**整条画不出来**。

为什么「图层在 scene 里、相机也对准了」却看不到？因为失败发生在 **draw 阶段**，不是数据/坐标/挂载阶段。诊断探针显示 `layer still in scene=true`、`相机中心正确`，恰恰把问题从「数据/坐标/挂载」收敛到了「draw 阶段」——而 draw 阶段只和着色器/context 有关。

水表管线层能显示，纯粹是因为它在数据异步加载后才 `addLayer`，此时 `ThreeLayer` 已经 settle，避开了冲突窗口；路网层在 `loaded` 回调里紧贴 `threeJSLayer` 之后 `addLayer`，正好撞在冲突窗口上。

## 五、最终方案：绕开 L7 着色器管线，改用原生 AMap.Polyline

L7 2.28 + 高德 3D + l7-three 的 context 冲突是结构性问题，与其跟版本/渲染顺序搏斗，不如**彻底绕开 L7 的 WebGL 着色器管线**：用高德原生 `AMap.Polyline` 画路网，走 AMap 自己的渲染，和 L7 / ThreeLayer 的 WebGL 完全独立。

大屏里 L7 canvas 是透明的（卫星影像是 AMap 底图、在 L7 下层可见），原生 `Polyline` 画在 AMap 底图上，一定能透出来。

```ts
// 用 scene 拿到底层 AMap 实例
const buildHighwayPolylines = (amap: any, features: any[], color: string): any[] => {
  const AMap = (window as any).AMap;
  if (!AMap || !amap) return [];
  return features.map((f) =>
    new AMap.Polyline({
      path: (f.geometry?.coordinates || []).map((c: number[]) => [c[0], c[1]]), // GCJ02 [lng,lat]
      strokeColor: color,
      strokeWeight: 4,
      strokeOpacity: 0.9,
      zIndex: 60,
      map: amap,
    }),
  );
};

const addHighwayLayer = (scene: any) => {
  const amap = scene.getMapService?.()?.map || (scene as any).map;
  if (!amap) { console.warn('[路网] AMap 实例未就绪，无法绘制路网'); return; }
  // fetch(publicAsset('guangxikeji.geojson')) → buildHighwayPolylines(amap, features, '#13c2c2')
  // fetch(publicAsset('demo.geojson'))        → buildHighwayPolylines(amap, features, '#ff4d4f')
};
```

显隐也从 L7 的 `layer.style({opacity})` 换成原生覆盖物的 `show()/hide()`（后者不触发 shader 重建，更安全）：

```ts
const setHighwayLayerVisible = (visible: boolean) => {
  const show = visible !== false;
  [...wenchangPolylines, ...liudongPolylines].forEach((p) => {
    if (show) p.show(); else p.hide();
  });
};
```

保留的前置修复：`process.env.PUBLIC_URL` 绝对路径（§2.1）、`scene.fitBounds` 相机对齐（§2.2）。`tsc --noEmit` 对该文件零报错，浏览器刷新后文昌青线 + 柳东红线稳定显示。

## 六、复盘：避坑清单

1. **先判断会不会抢 context**：在 `l7` + 高德 3D + `l7-three` 大屏里要画线/点/面，先想清楚它会不会和 `ThreeLayer` 共用 WebGL context。会抢，就优先用原生 AMap 覆盖物（`Polyline` / `Marker` / `Polygon`），绕开 L7 着色器管线。
2. **`no valid shader program` / `drawElements` 类 WebGL 报错，优先怀疑多图层共享 context**，而不是单个图层的颜色/shape/size/zIndex 配置——后者顶多影响外观，不会让整条线消失。
3. **公共静态资源（geojson 等）用 `process.env.PUBLIC_URL` 拼绝对路径**，别用 `fetch('./xxx')` 相对路径。路由深链/SPA 下相对路径会被解析成子路径，SPA fallback 返回 `index.html`，`JSON.parse` 静默失败，现象是「fetch 200 但没数据」。
4. **诊断「图层在 scene 里却画不出」**：用 `scene.getLayers()` 确认图层已挂载、`scene.getCenter()` 确认相机已对准。两者都正常，就能把问题收敛到 `draw` 阶段，而不是在数据/坐标上反复打转。
5. **对照组能救命**：同项目里还有没有「同样写法但能跑」的东西？它能跑说明写法本身 OK，差异在时机/上下文。这次是水表管线层点醒了 root cause。
6. **验证手段要务实**：无头浏览器在 `L7 + Three.js + swiftshader` 下连地图都渲染不出，别硬上 puppeteer。改为在浏览器里读 console 日志 + `scene.getLayers()` 探针，把判断收敛到「挂载成功但 draw 失败」。
7. **改动一次一个**：路径修复、竞态延迟、着色器配置、原生 Polyline 四步分开做、每步独立验证。即便前几步是假目标，它们各自也消除了一个真实或潜在的问题，排查时不会互相掩盖信号。

一句话总结：**L7 的 `LineLayer` 在带 `l7-three` 的高德 3D 大屏里是个脆弱点，遇到 `no valid shader program` 别调图层配置，直接换原生 AMap 覆盖物最稳。**
