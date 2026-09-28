## 一、为什么做这轮优化

博客跑了一段时间，攒下几个"不影响用、但越用越别扭"的小土块：

- **Storage 配额被废图悄悄堆满**：换封面、删正文图时，旧文件还躺在 `covers` 桶里，既不展示也回收不了；
- **富文本里图片后面的段落会"继承居中"**：回车后新段落跟着图片段落居中、还带上大段边距，排版打架；
- **编辑弹窗太窄**：正文编辑器横向空间不够，写长文时频频折行。

这一轮就把这三处一次性收拾干净，外加顺手把站点品牌名统一了一下。

## 二、后台图片自动清理（最值钱的优化）

### 1. 痛点

编辑器上传即把文件写进 Supabase Storage，但"被替换掉的旧封面""正文里删掉的图"不会自动消失。个人项目的免费配额本就紧巴，废图只增不减。

### 2. 做法

`src/lib/storage.ts` 新增两个函数：

- `bucketPathFromUrl(url)`：从公开 URL 反解出 `covers` 桶内的对象路径。**只认本项目的 Storage 地址**，外链或其它桶的地址返回 `null`——调用方据此安全跳过，绝不会去删外部图；
- `deleteImage(publicUrl)`：删一张图，RLS 未放开或删除失败时返回 `false`。

```ts
export function bucketPathFromUrl(url: string | null | undefined): string | null {
  if (!url) return null
  const marker = `/storage/v1/object/public/${BUCKET}/`
  const i = url.indexOf(marker)
  if (i === -1) return null
  try {
    return decodeURIComponent(url.slice(i + marker.length).split('?')[0]) || null
  } catch {
    return null
  }
}
```

`src/pages/Admin.tsx` 引入两个 `useRef` 记录本次会话的图片引用情况：

- `sessionUploads`：本次表单会话**新上传**的图（上传即落盘，但只有保存成功后才真正被文章引用）；
- `originalImages`：打开编辑弹窗时文章的**原始引用**（`coverUrl` + 正文图列表），用于识别"原来有、现在没了"的旧资源。

```ts
const sessionUploads = useRef<Set<string>>(new Set())
const originalImages = useRef<{ coverUrl: string | null; images: string[] }>({
  coverUrl: null,
  images: [],
})
```

### 3. 清理时机

| 场景 | 删除范围 | 说明 |
|---|---|---|
| 保存成功 | `sessionUploads` 里没进 keep 的 + 原图里被移除的 | keep = 保存后文章实际引用（封面 + 正文图） |
| 关闭未保存 | 整个 `sessionUploads` | 这些图还没被任何已保存文章引用，直接回收 |
| 删除整篇文章 | 该文引用、且无其它文章还在引用的图 | 防共用图被误删 |

```ts
// 从 HTML 正文里提取全部 <img> 的 src
function extractImageUrls(html: string): string[] {
  const urls: string[] = []
  const re = /<img[^>]+src=["']([^"']+)["']/gi
  let m: RegExpExecArray | null
  while ((m = re.exec(html))) urls.push(m[1])
  return urls
}
```

删除整篇文章时，先遍历其余文章凑出 `keep` 集合，只删"没有其它文章还在引用"的图：

```ts
const keep = new Set<string>()
for (const p of posts) {
  if (p.id === post.id) continue
  if (p.cover_url) keep.add(p.cover_url)
  for (const u of extractImageUrls(p.content)) keep.add(u)
}
```

### 4. 两个关键取舍

- **清理是 best-effort**：失败只 `console.warn`，不阻断保存/关闭流程——图片回收是锦上添花，不能因为它把发文搞挂；
- **共用图防误删**：靠 `keep` 集合判重，万一两篇文章用了同一张图，删除时不会误伤；
- `supabase/schema.sql` 同步放开删除策略（已有库需在 SQL Editor 单独跑这一段）：

```sql
drop policy if exists "Auth can delete covers" on storage.objects;
create policy "Auth can delete covers"
  on storage.objects for delete
  to authenticated
  using (bucket_id = 'covers');
```

## 三、富文本编辑器：对齐按钮 + 修图片后居中

### 1. 新增居中与左对齐

工具栏补了「居中」「左对齐」两个按钮，对应 `justifyCenter` / `justifyLeft`：

```ts
{ label: '居中', title: '文本居中', cmd: 'justifyCenter' },
{ label: '左对齐', title: '左对齐（取消居中）', cmd: 'justifyLeft' },
```

### 2. 修复图片后新段落继承居中

**根因**：`contentEditable` 回车时浏览器会克隆当前段落的类名。图片段落是 `p.post-img`（带 `text-align: center` 与上下边距），于是图片后面新起的段落也跟着居中、还带上大段留白，怎么输都对不齐。

三处一起修：

1. **sync 前自愈**：输出前摘除"没有图片却带着 `post-img` 类"的残留段落，避免边距样式串场；

```ts
const sync = () => {
  const el = bodyRef.current
  if (el) {
    el.querySelectorAll('p.post-img').forEach((p) => {
      if (!p.querySelector('img')) p.classList.remove('post-img')
    })
  }
  onChange(el?.innerHTML ?? '')
}
```

2. **插入图片后把光标挪走**：插完图把光标移到图片后一个干净的普通段落，否则接着打字/回车都会落在居中的图片段落里；

```ts
const insertHtml = (html: string) => {
  restoreSelection()
  document.execCommand('insertHTML', false, html)
  moveCaretToPlainBlock() // 关键：光标离开图片段落
  sync()
}
```

3. **回车拦截**：光标落在图片段落里时拦截默认行为，改用普通段落承接；

```ts
const handleKeyDown = (e: React.KeyboardEvent) => {
  if (e.key !== 'Enter') return
  // …从光标向上找最近的 p.post-img，命中则 preventDefault + 新建普通段落
}
```

**CSS 收尾**：直接去掉 `p.post-img` 的 `text-align: center`，居中交给 `img` 自身的 `display: block + margin: auto`——这样段落本身永远左对齐，回车克隆类名也不会再串味：

```css
.rich-content p.post-img,
.rte-body p.post-img {
  margin: 24px 0;
  /* 不再 text-align:center；居中由 img 自身处理 */
}
```

## 四、文章编辑弹窗加宽

原 `.modal` 偏窄，正文编辑横向空间不足。新增 `.modal.post-modal`，约占视口宽度 60%，并卡上下限防止窄屏溢出、超宽屏被拉得过长：

```css
.modal.post-modal {
  max-width: clamp(640px, 60vw, 1400px);
}
```

窄屏时 `.modal` 的 `width: 100%` 生效，这里不会造成横向溢出。

## 五、顺带：站点品牌统一

把站点标题从「关于WO的网络世界」统一更名为「沃哥博客」（`App.tsx` / `About.tsx` 的 Helmet 标题与 OG 站点名），并同步更新简历页的技能栈与"掌握技能"数量（8 → 11 项）。

## 六、小结

这一轮把"写博客"这件小事的运维成本又降了一档：

- **废图自动回收**——Storage 配额不再被看不见的旧图偷吃；
- **排版不再打架**——图片后面的文字老老实实左对齐；
- **编辑更顺手**——弹窗给足横向空间，对齐随手点。

没有复杂架构，但每一处都来自真实使用里的别扭，收拾完写博客确实舒服了不少。
