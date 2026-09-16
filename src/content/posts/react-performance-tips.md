---
title: React 大屏性能优化的 5 个实战技巧
date: 2026-09-10
tags: [React, 性能, 大屏]
summary: 在能源监控大屏中沉淀的 React 性能优化经验，覆盖渲染、列表、动画与打包。
---

# React 大屏性能优化的 5 个实战技巧

数据可视化大屏往往要同时渲染几十个图表与实时数据，性能很容易成为瓶颈。

## 1. 用 React.memo 阻断无效重渲染

对纯展示组件包裹 `React.memo`，避免父组件状态更新时整棵树重渲染。

```tsx
const ChartCard = React.memo(function ChartCard({ data }: Props) {
  return <EChart option={buildOption(data)} />;
});
```

## 2. 高频数据做节流/批量

WebSocket 推送的数据用 `requestAnimationFrame` 或节流合并，避免每秒几十次 setState。

## 3. 长列表虚拟化

列表超过几百条时引入虚拟滚动，只渲染可视区域。

## 4. Three.js 与 ECharts 按需加载

通过动态 `import()` 拆分重依赖，首屏只加载必要资源。

## 5. 生产构建关闭 sourcemap

大屏产物体积敏感，`vite build` 时关闭 sourcemap 能显著减小体积。

总结：先量再优，用 Performance 面板定位真正的瓶颈，不要盲目 memo。
