「页面卡」是 React 项目最常见的性能投诉，但绝大多数卡顿并不是 React 慢，而是**不该重渲染的组件被反复重渲染**。这篇文章不谈玄学，按「先测量 → 再定位 → 后优化」的顺序，把 React 18/19 下真正有效的优化手段讲清楚，并附一份可以直接对照的检查清单。

## 第一步：先测量，别猜

优化前必须拿到证据，否则很容易优化了不卡的地方。打开 **React DevTools → Profiler**：

1. 点录制，操作一遍卡顿的流程，停止录制。
2. 看 **Flamegraph**：哪些组件被高亮成黄色/橙色，就是渲染耗时大户。
3. 看 **Ranked**：按耗时排序，找出真正的瓶颈。
4. 勾选 **"Highlight updates when components render"**：频繁闪蓝框的组件就是过度重渲染的元凶。

结论通常只有两类：**某个组件自身计算太重**，或者**它被父组件带着一起重渲染**。

## 第二步：切断不必要的重渲染

### 1. 状态下沉（最容易被忽略，却最有效）

父组件持有状态时，每次更新都会让**整棵子树**重渲染。把只被某个子组件用到的状态**下沉到该子组件内部**，父组件就不再重渲染：

```tsx
// ❌ 输入框状态放在父组件：每敲一个字，<ExpensiveList /> 都跟着重渲染
function Page() {
  const [keyword, setKeyword] = useState('')
  return (
    <>
      <input value={keyword} onChange={(e) => setKeyword(e.target.value)} />
      <ExpensiveList />
    </>
  )
}

// ✅ 状态下沉到 <SearchBox />：输入时只有它自己重渲染
function Page() {
  return (
    <>
      <SearchBox />
      <ExpensiveList />
    </>
  )
}
```

### 2. children 透传

把重组件作为 `children` 传入，父组件重渲染时 React 会复用已创建的 element，子树不会重渲染：

```tsx
function Wrapper({ children }: { children: React.ReactNode }) {
  const [count, setCount] = useState(0)
  return (
    <div onClick={() => setCount((c) => c + 1)}>
      {count}
      {children} {/* children 的 element 引用没变，不重渲染 */}
    </div>
  )
}
```

### 3. 给计算和回调「定型」

`useMemo` 缓存**计算结果**，`useCallback` 稳定**函数引用**，`React.memo` 让子组件在 props 浅比较相等时跳过渲染：

```tsx
const ExpensiveList = React.memo(function ExpensiveList({ items, onPick }) {
  return <ul>{items.map((i) => <li key={i.id} onClick={() => onPick(i)}>{i.name}</li>)}</ul>
})

function Parent({ raw }) {
  const items = useMemo(() => heavyTransform(raw), [raw])
  const onPick = useCallback((i) => console.log(i), [])
  return <ExpensiveList items={items} onPick={onPick} />
}
```

三者要**配套使用**：只加 `React.memo` 而 `onPick` 每次都是新函数，等于没加。

> **React 19 的补充**：React Compiler 可以在编译期自动做这类记忆化，新项目可以优先启用它；但**理解上面的原理仍然必要**，因为编译器也有覆盖不到的边界（比如依赖了外部可变对象）。

### 4. key 用稳定且唯一的 id

`key` 用数组下标，列表增删时会引发**大量错位重渲染**，还会让输入框状态串位。始终用业务主键：

```tsx
{list.map((item) => <Row key={item.id} item={item} />)}
```

## 第三步：针对「重计算」本身

如果 Profiler 显示的是**单次渲染就很慢**（而不是次数多），要治的是计算量：

- **列表虚拟化**：长列表只渲染可视区，用 `react-window` / `@tanstack/react-virtual`。
- **代码分割**：路由级 `React.lazy` + `Suspense`，把首屏不需要的代码推迟加载。
- **Web Worker**：纯计算型任务（大文件解析、加密）挪出主线程，避免阻塞渲染。
- **防抖/节流**：搜索输入、滚动监听这类高频触发，先降频再处理。

```tsx
const Heavy = React.lazy(() => import('./Heavy'))

<Suspense fallback={<p>加载中…</p>}>
  <Heavy />
</Suspense>
```

## 第四步：并发特性 —— 让「非紧急更新」不阻塞输入

React 18 引入的 `useTransition` 能把更新标记为**非紧急**：紧急的输入先响应，非紧急的重渲染让路。

```tsx
const [isPending, startTransition] = useTransition()

function onChange(e) {
  setKeyword(e.target.value)               // 紧急：立刻回显
  startTransition(() => {
    setFiltered(heavyFilter(e.target.value)) // 非紧急：可被打断
  })
}
```

`useDeferredValue` 是同一思路的语法糖 —— 让某段内容「慢半拍」跟随：

```tsx
const deferred = useDeferredValue(keyword)
const list = useMemo(() => heavyFilter(deferred), [deferred])
```

两者都**不减少总计算量**，只是调整优先级，让用户在等待期间仍能流畅输入。别把它们当成万能的性能药。

## 优化检查清单

| 项目 | 检查点 |
| --- | --- |
| 测量 | 是否用 Profiler 定位到具体组件，而非凭感觉 |
| 状态下沉 | 局部状态是否还挂在过高的父组件上 |
| 记忆化 | `memo` / `useMemo` / `useCallback` 是否配套、依赖数组是否正确 |
| key | 是否用了稳定唯一 id，而非下标 |
| 列表 | 长列表是否做了虚拟化 |
| 体积 | 路由是否懒加载、是否做了代码分割 |
| 并发 | 高频输入是否用 `useTransition` / `useDeferredValue` 降优先级 |
| 副作用 | `useEffect` 依赖是否完整、是否在渲染期间做了重计算 |

## 小结

React 性能优化的顺序是固定的：**先测量、再定位、最后才动手**。绝大多数「卡」都来自不必要重渲染，而最省钱的三招是 —— **状态下沉、children 透传、memo 三件套配齐**。只有在「单次渲染就很重」时，才轮到虚拟化、代码分割和 Worker；并发特性则用于改善高频交互的体验，而不是缩短总耗时。按这个顺序做，优化才有的放矢。
