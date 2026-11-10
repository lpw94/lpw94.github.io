# 一次老项目的大版本升级实战：React 18 + Umi 4 + antd 5 三连跳

> 项目背景：一套 2020 年起步的工厂能源大屏项目（Umi 3 + antd 4 + React 17 + webpack 4 + dva + Electron），参照一个远端参考分支升级 React，结果发现参考分支实际是「React 18 + Umi 4 + antd 5」的一揽子升级，于是干脆做了三连跳。全项目约 600 个模块、几十个页面，全程单人两天完成。本文按「每一跳」记录技术要点、真实的报错现场和代码级解法，给同样背着老项目的朋友一个参考。

## 一、升级总览与策略

| 依赖 | 升级前 | 升级后 |
| --- | --- | --- |
| react / react-dom | 17.0.0 | 18.2.0 |
| @types/react(-dom) | 17.0.0 | 18.2.0 |
| umi | ^3.2.14（webpack 4 内置） | @umijs/max 4.7.27 |
| antd | 4.20.6 | 5.29 |
| @ant-design/icons | ^4.0.0 | ^5.x |
| pro-layout / pro-form / pro-table | v1/v2 | 全部移除，改 antd 原生 |
| 构建产物大小 | — | externals: react 10.5KB + react-dom 129.1KB |

两个前提判断决定了整个策略：

**判断 1：参考分支不能直接合并。** 它除了框架升级还删改了大量别的园区的页面，直接 merge 会把业务改动一起带进来。所以所有改动都靠 `git show <ref>:<file>` 单文件取材，逐个判断是否属于「升级必需」。

**判断 2：三连跳必须拆成两次提交。** React 18 一次（依赖 + 渲染 API + 类型），Umi 4 + antd 5 一次。每一步独立可构建、可回退（`git reset --hard` 回到升级前的 commit），排查问题时 diff 面小一个数量级。事后证明这个决定救了我好几次——Umi 4 的坑需要反复对照「升级前能不能跑」。

## 二、React 17 → 18：最小改动集

### 2.1 依赖与 peer 冲突

```ini
# .npmrc（新增）
legacy-peer-deps=true
```

antd 4 / Umi 3 的生态包 peerDependencies 还停在 `react ^16 || ^17`，不绕过的话 npm 直接报 ERESOLVE 拒绝安装。React 18 和 antd 4 实际兼容（类组件生命周期没动），peer 声明滞后而已。

### 2.2 渲染 API：createRoot 必须缓存复用

全项目搜 `ReactDOM.render` 有 3 处，都在拓扑编辑器模块里。这里有个容易踩的细节：**root 不是随便创建的**。

```js
// ❌ 错误示范：每次渲染都 new 一个 root
const root = ReactDOM.createRoot(container);
root.render(node);

// ✅ 正确做法：按容器节点 WeakMap 缓存 root
const rootMap = new WeakMap();
function renderNode(container, node) {
  let root = rootMap.get(container);
  if (!root) {
    root = ReactDOM.createRoot(container);
    rootMap.set(container, root);
  }
  root.render(node);
}
```

拓扑编辑器会反复挂载/卸载子图节点，同一个容器每次都 `createRoot` 的话，React 18 会在第二次创建时报 `You are calling ReactDOMClient.createRoot() on a container that has already been passed to createRoot()`，且旧 root 泄漏。用 `WeakMap` 以容器为 key 缓存，容器被 DOM 回收后 root 也自动可回收。

### 2.3 类型层：React 18 移除 FC 隐式 children

升级后跑 tsc，对比 React 17 基线**新增了 9 个错误**，全是两类：

```tsx
// 类型 1：FC 不再隐式带 children（4 处）
// React 17: const Layout: React.FC = (props) => <div>{props.children}</div>  ✓
// React 18: props.children → Property 'children' does not exist on type ...
const Layout: React.FC<React.PropsWithChildren> = (props) => { ... }

// 类型 2：useCallback/泛型回调参数失去推断（3 处）
const handleSearch = useCallback((value) => { ... })   // ❌ 隐式 any
const handleSearch = useCallback((value: string) => { ... })  // ✓
```

### 2.4 验证方法：类型基线 diff

这是这步最值得复用的方法。`npm run tsc` 本身有仓库既有的报错（TS 4.0.3 解析不了新版 `@types/d3-dispatch`，还有个历史遗留的 `1.tsx` 语法错误），直接看总数没法判断「是不是我引入的」。做法：

1. 临时写一个排除既有错误文件的 tsconfig（`tsconfig.tmpcheck.json`），跑 tsc 存为 React 18 错误清单；
2. `npm i --no-save react@17 @types/react@17` 临时回退，同一配置再跑一遍存为基线；
3. `diff <(sort 基线) <(sort 新清单)`，新增为 0 才算过关。

结果：基线 1062 条，升级后 1062 条 + 9 条新错误，修复后集合与基线完全一致。

### 2.5 构建通过后再动 Umi

这里有一个非代码问题要记录：webpack 4 的 babel-loader 缓存文件（`src/.umi/.cache/babel-loader/*.json.gz`）偶发 `EPERM` 写入失败导致构建中断，删掉该缓存文件重跑即可，与代码无关。

## 三、Umi 3 → Umi 4：行为变化比 API 变化更坑

### 3.1 配置迁移本身（相对轻松）

`package.json` 换成 `@umijs/max`，npm 脚本里 webpack 4 时代的 `set NODE_OPTIONS=--openssl-legacy-provider` 全部删掉（那是为了让 Node 17+ 支持 webpack 4 用的 md4 hash，Umi 4 不需要）。

`config/config.ts` 的重写要点：

```ts
// plugins 全部变成 config 项，不再是 @umijs/plugin-* 包
plugins: undefined,  // 不需要了
dva: {},
model: {},
initialState: {},
request: {},
antd: { configProvider: {} },
layout: false,          // 自绘布局，关掉内置 layout
locale: { default: 'zh-CN', antd: true },

// 迁移前 chainWebpack 里手工配的 chunks 分包，Umi 4 的 codeSplitting 配置接管
codeSplitting: { jsStrategy: 'granularChunks' },
```

两处小坑：

- `@umijs/utils` 没有被正确提升到顶层 `node_modules`（npm + legacy-peer-deps 的依赖提升差异），首次跑 `max setup` 报 `Cannot find module '@umijs/utils'`，手动 `npm i -D @umijs/utils@4.7.27` 对齐版本解决。
- Umi 3 遗留的 `src/.umi` 里有 **10111 个 babel 缓存文件**，`max setup` 清理时会被逐个 rimraf 卡住。`src/.umi` 是纯生成物，直接整个删掉再跑。

### 3.2 坑 1：rootContainer 在 Provider 之外（报错：dispatcher is null）

Umi 3 时代大家习惯在 `src/app.tsx` 里这么写：

```tsx
// Umi 3 下能跑，Umi 4 下炸
export function rootContainer(container: any) {
  const ScopeSync = () => {
    const { initialState } = useModel('@@initialState');  // ← 这里拿到 null context
    const dispatch = useDispatch();
    useEffect(() => { /* 根据部门匹配 areaType 设置视图 */ }, []);
    return null;
  };
  return <><ScopeSync />{container}</>;
}
```

真机报错：

```
TypeError: Cannot read properties of null (reading 'dispatcher')
  at useModel  .umi/plugin-model/index.tsx:135
    135 |   const { dispatcher } = useContext<{ dispatcher: Dispatcher }>(Context);
```

**定位**：读 `src/.umi/umi.ts` 的组装代码，Provider 的嵌套顺序是：

```tsx
// src/.umi/umi.ts（生成物）
rootContainer(          // ← 最外层
  <Provider>            // plugin-model / dva 的 Context Provider
    <AntdProvider>      // antd 的 ConfigProvider
      {routes}
    </AntdProvider>
  </Provider>
)
```

`rootContainer` 包在 Provider **外面**，它的组件树里调 `useContext(Context)` 必然是 null。Umi 3 的组装顺序不同，所以老代码才依赖这个写法。

**解法**：初始化逻辑原样搬进一个独立组件，挂到 Provider 内部的挂载点（`basicLayout`）：

```tsx
// src/components/ScopeSync/index.tsx（逻辑与原来完全一致）
export default function ScopeSync() {
  const { initialState } = useModel('@@initialState');
  const dispatch = useDispatch();
  useEffect(() => { /* ...部门匹配逻辑... */ }, []);
  return null;
}

// src/layout/basicLayout.tsx
<div className={styles.wraperContainer} id="J_inner_root">
  <ScopeSync />
  <Header ... />
  <Outlet />
</div>
```

`app.tsx` 里的 `rootContainer`、`areaType` 相关 import 全部删除。

### 3.3 坑 2：布局组件 `props.children` 是空的（症状：白屏且零报错）

Umi 3 的嵌套路由 Layout：

```tsx
// Umi 3 ✓ / Umi 4 ✗ —— 不报错，内容区就是空白
const UserLayout = (props) => (
  <div className={styles.container}>
    <div className={styles.content}>{props.children}</div>
  </div>
);
```

Umi 4 基于 react-router v6，`props.children` 不再是路由内容。必须改：

```tsx
// Umi 4 ✓
import { Outlet } from 'umi';
const UserLayout = () => (
  <div className={styles.container}>
    <div className={styles.content}><Outlet /></div>
  </div>
);
```

这个坑的迷惑性在于：**Layout 外壳渲染正常、控制台零错误**，只是内容区空白。我是因为发现 `#root` 有内容、`J_userlayout` 有内容、但里面没有路由组件才反应过来的。

连带改动：`basicLayout` 里有个「每天凌晨刷新整页」的定时器，依赖数组原来写 `[props.children]`（Umi 3 下 children 变化代表路由变化），改成依赖 `location.pathname`。

### 3.4 坑 3：模块重复打包（本次最深的一个坑）

dev 环境页面报：

```
TypeError: Cannot read properties of null (reading 'applyPlugins')
  at getAntdConfig  .umi/plugin-antd/runtime.tsx:17
    17 |   cacheAntdConfig = getPluginManager().applyPlugins({
```

**第一直觉**是坑 1 的同类问题（又是 pluginManager 又是 null），但这次 `getPluginManager()` 来自 `src/.umi/core/plugin.ts`——一个纯生成文件，不存在「写在 Provider 外面」的可能。它为什么是 null？

**定位过程**：打开浏览器控制台，发现一条之前被忽略的 webpack 警告：

```
There are multiple modules with names that only differ in casing.
This can lead to unexpected behavior when compiling on a filesystem with other case-semantic.
```

**这就是根因**：同一个文件被 webpack 识别成了两个模块，整个模块图分裂成两套。`core/plugin.ts` 的两份拷贝各自持有自己的 `pluginManager` 实例，`umi.ts` 在实例 A 里 `setPluginManager(...)`，`plugin-antd/runtime.tsx` 却 import 到了实例 B 的 `getPluginManager()`——B 从未被赋值，返回 null。

**谁制造了两个身份？** 盘符大小写。`config/config.ts` 里有一行：

```ts
alias: {
  '@ahooksjs/use-url-state': path.resolve(process.cwd(), 'src/hooks/useUrlState.ts'),
}
```

`process.cwd()` 在我的环境返回 `D:\workspace\...`（大写 D），而 Umi 内部所有模块 id 统一是 `d:\`。webpack 对模块路径**大小写敏感**，于是：

```
d:\workspace\...\src\hooks\useUrlState.ts     ← 被 umi 内部解析引用
D:\workspace\...\src\hooks\useUrlState.ts     ← 被 alias 解析引用
```

同一物理文件，两个模块 id，两份执行。为什么偏偏 `core/plugin.ts` 出事？因为模块图分裂后，哪个文件被复制取决于引用关系，`plugin.ts` 恰好同时被两套图的入口引用到。

**解法**（釜底抽薪，不让任何路径以「运行时计算的绝对路径」进入 webpack）：

1. 删掉这个 alias；
2. 75 个调用点批量改为直接 `import useUrlState from '@/hooks/useUrlState'`——`@/` 由 Umi 自己解析，和内部大小写**永远一致**；
3. `mfsu: false` 保留（MFSU 的持久化缓存会把分裂固化，就算修了源也会从缓存里复活）；
4. 清掉 `node_modules/.cache/mfsu*`（实测残留 122MB 旧产物）。

```ts
// config/config.dev.ts
export default { mfsu: false };
```

**运维提醒（这次真踩了）**：清缓存后必须杀掉旧 dev 进程。旧进程占着 8848 端口，新进程漂到 8849，而你访问的 8848 还是旧进程——它引用的 `src/.umi` 生成物已被删除，报的是完全不相干的 `Cannot find module './dva'`。症状和原因再次错位，排查成本极高。

### 3.5 坑 4：umi4 的 request 没有 `prefix`（Electron 下接口全 404）

Umi 3 的 `app.tsx`：

```ts
export const request: RequestConfig = {
  prefix: APIUrl,   // 所有相对路径请求自动拼上 https://api.xxx.com
  errorHandler,
  requestInterceptors: [...],
  responseInterceptors: [...],
};
```

Umi 4 的 request 插件换成了 **axios 实现**，`RequestConfig` 就是 axios 的配置类型——`prefix` 不是 axios 的配置项，**写上去静默无效，不报任何错**。后果：

- 浏览器 dev：请求打到 `http://localhost:8848/common-service/...`（相对路径），接口全 401/404；
- Electron（`file://` 协议加载 `dist/index.html`）：相对请求变成 `file:///D:/.../common-service/...`，直接 `ERR_FILE_NOT_FOUND`。

**发现方式**：puppeteer 监听页面发出的所有请求，发现验证码图片请求 URL 是相对路径，没有 API 域名。

**解法**：

```ts
export const request: RequestConfig = {
  baseURL: APIUrl,  // axios 的 baseURL，只对相对 URL 生效
  errorHandler,
  ...
};
```

语义等价性说明：axios 的 `baseURL` 仅当请求 URL 不是绝对地址时才拼接，所以代码里写死完整地址的少数请求不受影响；这点和 umi3 `prefix` 行为一致。拦截器结构不用动，`errorHandler` 的 `error.response` 在 axios 下同样成立。

### 3.6 坑 5：`base: './'` 的语义变了（Electron 白屏）

Electron 产物通过 `file://` 加载 `dist/index.html`，资源必须相对路径。Umi 3 配置：

```ts
if (BUILDTYPE === 'electron') {
  pathConfig = { base: './', publicPath: './' };
}
```

Umi 4 里 **`base` 直接当 history 的 basename**。产物跑起来后地址栏是：

```
file:///D:/.../dist/index.html#./user/login
                ^^^^^^^^^^^^^ basename 混进了 hash
```

`./` 不是合法路由前缀，匹配不到任何路由 → 白屏。资源路径倒是正常的，说明 `publicPath` 的语义没变。

**解法**：两者分开——

```ts
if (BUILDTYPE === 'electron') {
  pathConfig = { base: '/', publicPath: './' };
}
```

构建后用 `grep -oE 'src="[^"]+"' dist/index.html` 确认产物是 `./umi.js`，再用 file:// 无头浏览器确认路由是干净的 `#/user/login`。

### 3.7 杂项适配清单

- `@@/plugin-model/useModel`、`@@/plugin-request/request`、`@@/core/history` 这类 Umi 3 临时目录导入（9 个文件），统一改成 `from 'umi'`——Umi 4 的 `src/.umi/umi.ts` 会重新导出这些符号，`from 'umi'` 依然有效；
- `@ahooksjs/use-url-state` 依赖 react-router v5 的 `useHistory`（v6 已删除，运行时 `useHistory is not a function`），自写 10 行垫片基于 `useSearchParams` 实现，签名保持 `[state, setState]`；
- `max setup` 生成临时文件、`npx max` 在 CI/脚本环境会等交互确认，用 `./node_modules/.bin/max` 直接调本地 bin。

## 四、antd 4 → 5：codemod 覆盖 70%，剩下 30% 手工

### 4.1 先跑官方 codemod

```bash
npx @ant-design/codemod-v5 src
```

处理了 `visible → open`（Modal/Drawer/Tag/Tooltip/Popover/Popconfirm）、`Modal.method` 静态调用等机械替换。两个使用注意：

- **要求工作区干净**（它内部会跑 git），先打一个 wip 提交再跑；
- 它**不做** TabPane 迁移、不做 `dropdownRender` 改名（解包看了 transforms 清单确认的），这些要手工。

### 4.2 Tabs.TabPane：20 行垫片方案（13 个文件零改写）

antd 5 移除了 `<Tabs><TabPane/></Tabs>` 子组件写法，只接受 `items` 数组。13 个文件里有三种形态：

1. 纯静态 `<TabPane tab="xxx" key="xxx">children</TabPane>`；
2. `{list.map(x => <TabPane key={x.id} tab={x.name}>...</TabPane>)}` 动态生成；
3. 静态 + map 混合。

逐个改写要把「children 提取成对象数组」手工翻译 13 遍。我选择了垫片——运行时把 TabPane 的 props 转成 items：

```tsx
// src/components/antd4compat/TabsCompat.tsx
import React, { Children, isValidElement } from 'react';
import { Tabs as AntdTabs } from 'antd';

// TabPane 本体只当「props 载体」，不渲染任何东西
const TabPane = () => null;

const Tabs = (props: any) => {
  const { children, ...rest } = props;
  const items = Children.toArray(children)
    .filter(isValidElement)
    .map((el: any) => ({ ...el.props, key: String(el.key) }));
  return <AntdTabs {...rest} items={items} />;
};

// @ts-expect-error 挂静态属性，兼容 <Tabs.TabPane> 与 import { Tabs } 两种用法
Tabs.TabPane = TabPane;
export default Tabs;
```

13 个文件只改一行导入：

```diff
- import { Tabs, Modal, ... } from 'antd';
+ import { Modal, ... } from 'antd';
+ import Tabs from '@/components/antd4compat/TabsCompat';
```

业务 JSX（包括 map 动态生成的三种形态）一行不改。`Children.toArray` 天然拍平数组和 Fragment，所以形态 2、3 也覆盖。垫片边界要想清楚：**它只兼容 children 写法，如果未来要传 `destroyInactiveTabPane` 之类新 props 也没问题（rest 透传），但不能再依赖 TabPane 的 instance 方法**——项目里没有，所以安全。

### 4.3 DatePicker 与 moment：整体换 dayjs（7 个文件）

antd 5 内部基于 dayjs，**moment 值传进 DatePicker 会在运行时报错**（`date.isSame is not a function` 之类），构建期不报。涉及文件：能耗/碳排/电表/水表/指标/绩效 6 个弹窗 + 一个离线设备虚拟表格。

迁移前先审计 moment API 使用面，确认 dayjs 兼容性：

```bash
grep -oE "moment\(\)\.[a-zA-Z]+|\.(add|subtract|diff|utc|locale|isoWeek|week|quarter|isBefore|isAfter|isSame|isValid)\(" "$f" | sort | uniq -c
```

结论：全部兼容，唯独 `isBetween` 在 dayjs 是**插件**（moment 内置），需要：

```ts
import dayjs, { Dayjs } from 'dayjs';
import isBetweenPlugin from 'dayjs/plugin/isBetween';
dayjs.extend(isBetweenPlugin);
```

然后每个文件三步机械替换：删 `import moment`、`moment(` → `dayjs(`、`Moment` 类型 → `Dayjs`。

### 4.4 pro-components 移除

pro-layout / pro-form / pro-table v1/v2 与 antd 5 不兼容且没有平滑升级路径。实际使用面很小，直接回原生：

- **登录页**：`ProForm + ProFormText` → antd 原生 `Form + Form.Item + Input`，`formRef.submit()` → `form.submit()`，submitter 渲染逻辑改成普通 Button 的 loading 态；
- **拓扑预览页**：`PageHeader`（已从 antd 移除）→ 自绘一个 flex 头部（返回按钮 + 标题 + 操作区），视觉上与原 PageHeader 等价；
- **app.tsx**：`import type { Settings } from '@ant-design/pro-layout'` → 本地声明类型。

顺便把 `package.json` 里 4 个 pro 包全删了，vendor 体积减一截。

### 4.5 less 主题变量失效

三个 less 文件里有 `@import '~antd/es/style/themes/default.less';`——antd 5 已删除该文件，构建直接报 `Can't resolve`。处理：

1. 统计这三个文件实际用到的 antd 变量（`@primary-color`、`@text-color-secondary`、`@font-size-base`、屏幕断点等，共十几个）；
2. 在构建配置 `theme`（即 less modifyVars）里声明，值从项目暗色主题对象合并而来：

```ts
theme: {
  '@primary-color': defaultSettings.primaryColor,
  '@white': '#fff', '@black': '#000',
  '@popover-background': '#1f1f1f',
  '@font-size-base': '14px',
  ...darkTheme,
},
```

3. 删掉三处失效的 `@import`。

暗色模式从「less 变量编译期注入」升级为 antd 5 的运行时方案：

```tsx
// src/app.tsx
import { theme } from 'antd';
export const antd = {
  configProvider: { theme: { algorithm: theme.darkAlgorithm } },
};
```

### 4.6 其余批量替换

```bash
# antd5 改名 API，codemod 不做，正则全局替换
dropdownMatchSelectWidth → popupMatchSelectWidth
dropdownRender           → popupRender
```

antd 4 的 `<Icon type="like" />`（2 处残留）→ `@ant-design/icons` 的 `LikeOutlined`；1 处未使用的 `Icon` 导入直接删除。

### 4.7 已知的非阻断 warning（记录不修）

- antd 5 对 `notification` 静态方法有主题上下文 warning（功能正常）；
- `Input` 的 `addonAfter` 搭配 `ProFormText` 的场景已随 pro 移除；
- vendor 里个别 less 默认导入（`@import 'xxx.less'` 少分号）警告。

## 五、验证体系：别只跑构建

这次最大的体会：**构建通过 ≠ 能用**。Umi 4 的五个坑里四个是纯运行时的。验证分四层，全部自动化成脚本（puppeteer-core 接系统 Chrome，免装 Chromium）：

### 5.1 三条链路

| 链路 | 启动方式 | 覆盖的问题 |
| --- | --- | --- |
| dev | `npm run start:yantai`（:8848） | 模块分裂、Provider 顺序、Outlet |
| web 产物 | 临时静态服务起 `dist`（带 SPA fallback 到 index.html） | 产物资源路径、路由 fallback |
| Electron 产物 | `npm run buildEle` 后直接 `file:///.../dist/index.html` | `base` 语义、request prefix、相对资源路径 |

每条链路的无头脚本统一收集三类信号：

```js
page.on('pageerror', e => logs.push(`[pageerror] ${e.message}`));
page.on('console', m => { if (['error','warning'].includes(m.type())) logs.push(m.text()); });
page.on('requestfailed', r => logs.push(`[reqfail] ${r.url()} ${r.failure()?.errorText}`));
```

外加读 `document.getElementById('root').innerHTML.length` 和 `document.body.innerText`，判断是「渲染了」还是「白屏」。

### 5.2 接口指向检查

```js
page.on('request', r => { if (r.url().includes('service')) reqs.push(r.url()); });
```

登录页打开后应看到验证码图片请求打到 API 域名。这一步直接抓出了 `prefix` 失效。

### 5.3 需要登录态的页面

首页需要 token，注入假 token 走通 UI 渲染（数据 401 为空属预期，看的是布局结构）：先 `localStorage.setItem('Authorization', 'fake')` 再跳 `/home`，然后截图人工确认面板/3D 区块齐全。

### 5.4 file:// 特殊处理

Electron 产物测试要给 Chrome 加 `--allow-file-access-from-files`；抓 404 不能只看 `requestfailed`，还要监听 `response` 的 `status >= 400`（file:// 下很多错误不走 failed 事件）。

## 六、复盘：经验清单

1. **大升级分步提交**，每步独立可构建可回退；升级前先 `git log --all --oneline -- package.json` 摸清历史，仓库里已有的升级尝试（哪怕是半途而废的）都是现成的参考资料。
2. **类型基线 diff 法**：新旧版本各跑一遍 tsc，sort + diff 错误清单，新增为 0 才算过关。比「看总数」可靠得多。
3. **Windows + webpack 的模块分裂**：警惕任何 `path.resolve(process.cwd(), ...)` 进 webpack 配置（alias / include）。盘符大小写让同一文件有两个模块 id，报错位置（plugin-antd）和真实原因（config.ts 的 alias）隔了十万八千里。优先用 `/` 开头、由构建器自己解析的项目内别名。控制台出现 *"multiple modules with names that only differ in casing"* 时不要忽略它。
4. **框架大版本升级先读运行时组装代码**：Umi 4 的 `src/.umi/umi.ts` 生成的 Provider 嵌套顺序、`request.js` 插件模板的 axios 实现，都是 10 分钟能读完的生成物，读一眼就能避免几小时的猜。
5. **兼容垫片是好东西，但要明确边界**：TabsCompat 20 行省掉 13 个文件改写；useUrlState 垫片 10 行替代不兼容依赖。前提是垫片覆盖面完全摸清（本例：children 形态全覆盖、instance 方法未使用）。
6. **验证脚本化**：三链路 + 请求监听 + 假 token + 截图，写一次重复用。尤其是 Electron 的 `file://` 链路——四个坑里两个只有它暴露得出来。
7. **清缓存必杀旧进程**：端口被旧 dev 占用后，你看到的一切报错都属于「过去」。

构建性能顺带收益：生产构建从 webpack 4 + Umi 3 的约 83 秒降到 Umi 4 的约 25 秒。
