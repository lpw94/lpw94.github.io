## 一、这次改了点啥

上一波（`6488b69` 之前的若干提交）把博客从"能看"推向"能玩"，这波反过来往**专业度**上收——一个站点要让别人"找得到、转得开、看得顺"。一口气做了五件：

- **RSS + Sitemap + robots.txt 真正跑通**：原来脚手架在，`dist/` 却始终不出这两个文件，根因是个隐蔽的环境坑；
- **每篇文章的 Open Graph / Twitter Card / JSON-LD**：分享到社交平台能带标题、封面和作者；
- **右下角分享按钮**：原生分享 / 复制链接 / 微博 / X / Facebook 一键转；
- **2048 滑动特效 + 贪吃蛇区域放大**：游戏手感与可视面积双提升；
- **桌面宠物下线**：按需求移除。

老规矩：加了什么 / 怎么做的 / 踩了什么坑。

## 二、RSS + Sitemap：一个被环境变量坑了的生成器

### 1. 现象：脚手架在，产物没

仓库里 `scripts/gh-pages.mjs` 早就写好生成 `rss.xml` / `sitemap.xml`，`index.html` 也挂了 RSS `<link>`，`public/robots.txt` 甚至已经占位。但 `dist/` 里**从来没有**这两个文件——`vite build` 一路绿，就是不出货。

### 2. 根因：Node 脚本不读 .env

生成器开头长这样：

```js
const SUPABASE_URL = process.env.VITE_SUPABASE_URL
const SUPABASE_ANON = process.env.VITE_SUPABASE_ANON_KEY
```

它靠 `process.env` 拿 Supabase 凭据去拉文章列表。问题来了：**`node scripts/gh-pages.mjs` 是一条裸 Node 命令，不会自动加载 `.env`**（`.env` 被 gitignore，只有 Vite 在构建时才认）。本地跑构建时，环境变量全是 `undefined`，脚本里只要拿不到就 `return` 跳过——于是**静默失败**，连个报错都没有，只是不生成文件。

CI 里能跑是因为 `deploy.yml` 把 Secrets 显式 `export` 进了构建环境，但本地 `vite preview` 永远看不到 feed。

### 3. 修法：给脚本补一个极简 .env 解析

不引第三方包，十几行读 `.env`：

```js
import { readFileSync } from 'node:fs'
if (!process.env.VITE_SUPABASE_URL && existsSync('.env')) {
  for (const line of readFileSync('.env', 'utf8').split('\n')) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/i)
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '')
  }
}
```

本地构建也能拿到变量，feed 正常生成。

### 4. 顺手把格式补全

原来的 RSS 只有骨架，按 RSS 2.0 补了：每篇 `description`（正文纯文本前 200 字，含 `&`→`&amp;` 转义）、`language`、`atom:self` 自链接、`lastBuildDate`，日期缺失自动回退。Sitemap 从"只有文章"扩成 **静态页 + 文章页**：`/`、`/about`、`/gallery`、`/tools` 加上 `/post/:slug`（`/admin`、`/reset-password` 不收录）。`robots.txt` 占位域名改成 `https://lpw94.github.io/sitemap.xml`，RSS 链接标题改成"沃哥博客 RSS"。

> 验证：写了 `FEEDS_OFFLINE_MOCK=1` 离线自测开关，XML 格式（含转义）先跑通；真实拉取在本地沙箱被屏蔽外联，脚本按 best-effort 告警跳过不崩，CI 有网络 + secrets 会生成真实文件。本地 mock 产物生成后会删掉，避免污染 `vite preview`。

## 三、社交分享卡片：OG / Twitter Card / JSON-LD

目标很朴素：把文章链接贴到微信 / 推特 / 飞书，能带出**标题 + 封面 + 简介**，而不是一段光秃秃的 URL。

### 1. 现状：有了基础 OG，但缺一半

`PostDetail` 本来就通过 `react-helmet-async` 注入了 `og:type` / `og:title` / `og:description` / `og:url` / `article:published_time` 和 `canonical`。缺的是：`og:image`、`og:site_name`、`og:locale`，**整个 Twitter Card 集**，以及结构化数据 **JSON-LD**。

### 2. 补全的标签

```tsx
// Open Graph 补齐
<meta property="og:image" content={shareImage} />        {/* 优先文章封面，无则回退 /avatar.png */}
<meta property="og:image:alt" content={post.title} />
<meta property="og:site_name" content="沃哥博客" />
<meta property="og:locale" content="zh_CN" />
<meta property="article:modified_time" content={post.updated_at || post.published_at || ''} />
<meta property="article:section" content={CATEGORY_LABEL[post.category] || '技术'} />

// Twitter Card 全套
<meta name="twitter:card" content="summary_large_image" />
<meta name="twitter:site" content="@lpw94" />
<meta name="twitter:title" content={post.title} />
<meta name="twitter:description" content={description} />
<meta name="twitter:image" content={shareImage} />
```

`shareImage` 的兜底逻辑：文章有封面用封面，没有就回退站点头像 `/avatar.png`，保证任何文章分享都有图。

### 3. JSON-LD：给搜索引擎的结构化名片

在 `<Helmet>` 里塞一段 `application/ld+json`：

```tsx
<script type="application/ld+json">
{JSON.stringify({
  "@context": "https://schema.org",
  "@type": "BlogPosting",
  headline: post.title,
  description,
  image: shareImage,
  datePublished: post.published_at,
  dateModified: post.updated_at || post.published_at,
  author: { "@type": "Person", name: profile.name },
  publisher: { "@type": "Organization", name: "沃哥博客",
    logo: { "@type": "ImageObject", url: `${SITE_URL}/avatar.png` } },
  mainEntityOfPage: `${SITE_URL}/post/${post.slug}`
})}
</script>
```

### 4. 必须说清的限制（别被"加了就有"骗了）

这是**纯客户端 SPA**，meta 是 Helmet 在运行时注入的。后果是：

- **Google**：会执行 JS，能看到这些标签，SEO 和富媒体摘要没问题；
- **Twitter / Facebook / 微信**：爬虫只抓**静态 `index.html` 外壳**，拿不到按文章动态注入的 OG/Twitter 标签——直接贴链接，大概率是纯 URL，不带标题封面。

要真正让社交卡片按文章生效，得在**构建期预渲染每篇文章的静态页**（在 `gh-pages.mjs` 已经拉到全部文章的基础上，写 `dist/post/<slug>/index.html`，内含正确 meta 并引导同一套 JS bundle）。这一步改动更大，作为**可选升级**留着，需要再说。

## 四、分享按钮：在返回顶部上方，别挡音乐播放器

右下角本来就挤：音乐播放器（`bottom:22px`，高 54）在最底，返回顶部按钮叠在它上方（`bottom:84px`）。

第一版我把分享按钮放 `bottom:22px`——正好压在音乐播放器上，用户一反馈"遮挡到音乐播放器"，立刻上移：

```
音乐播放器   bottom:22   (最底，高 54)
返回顶部     bottom:84   (居中)
分享按钮     bottom:138  (最高，菜单向上展开)
```

三者竖向错开、互不遮挡。分享按钮（`ShareButton`）是固定 FAB，滚动超过 400px 同显，点击弹层菜单：

- **系统原生分享**：移动端能直接调起微信 / QQ 的系统分享面板（`navigator.share`，不支持的浏览器隐藏该项）；
- **复制链接**：`navigator.clipboard.writeText`，带"已复制"反馈；
- **微博 / X(Twitter) / Facebook**：分别拼好 intent URL 新开窗口。

全站挂在 `Layout`，与返回顶部、音乐播放器共用右下角这一列。

## 五、游戏打磨：2048 会滑了，贪吃蛇大了一圈

### 1. 2048：从"原地换数字"到"滑块顺滑滑动"

原来的 2048 是 grid 里按值渲染方块，移动时数字直接变，没有"滑动"的体感。重写内核：

- 每块用**稳定 `id`** 标识，渲染时按行列用 `transform: translate()` 定位；
- 移动时 CSS `transition: transform` 让滑块**顺滑滑过去**，而不是闪现；
- 新生成的块**缩放出现**（`g2-appear`），合并时**放大回弹**（`g2-bump`）；
- 合并的"被吃块"先滑入目标位置，**130ms 后移除**——视觉上是两块滑到一起合成一块，不会叠块或凭空消失；
- 背景改成"底色网格 + 绝对定位 tile 层"的分层结构，棋盘仍是 4×4 经典外观。

### 2. 贪吃蛇：单元格 16 → 22px

纯视觉放大，逻辑不动：

```ts
const CELL = 16   // 改前
const CELL = 22   // 改后
// 棋盘 15×15：240px → 330px（约大 37%）
```

canvas 加了 `max-width: 100%; height: auto`，小屏弹窗里自动缩放不溢出。游玩空间宽裕不少。

## 六、桌面宠物下线

按需求把桌面宠物移除：删掉 `Layout` 里的 `import FloatingPet` 与 `<FloatingPet />` 挂载（`46ccff8`），组件文件本身保留，万一哪天想加回来一行挂载即可，不必重写。

## 七、小结

这一波全是**"让站点更像一个正经站点"**的增量：SEO 入口（RSS / Sitemap / robots）、社交分发（OG / Twitter / JSON-LD / 分享按钮）、游戏手感（2048 滑动、蛇区放大），以及一次减法（去宠物）。共同沉淀的原则：

1. **生成类脚本别假设环境有变量**——裸 `node` 不读 `.env`，要么显式 `export`，要么脚本自己解析；
2. **SPA 的 meta 注入有上限**：Google 认 JS，社交爬虫只认静态外壳，要真社交卡片得上预渲染；
3. **右下角空间是稀缺资源**：固定 FAB 竖向排队、留足间距，谁也别压谁；
4. **CSS transition 是做"滑动特效"最省事的武器**：给元素稳定 id + transform，比重绘整个 grid 顺滑得多。

下一批想做的是：2048 的构建期预渲染静态页（解决社交卡片限制）、给分享加个"生成分享海报"。先收工。
