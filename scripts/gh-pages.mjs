// GitHub Pages 部署辅助脚本（在 vite build 之后运行）
// 1) 复制 dist/index.html -> dist/404.html，解决 SPA 在 GitHub Pages 上刷新 404 的问题
// 2) 从 Supabase 拉取已发布文章，生成静态 dist/rss.xml 与 dist/sitemap.xml
//    均为 best-effort：缺少环境变量或拉取失败时不阻断部署，仅告警。
import { copyFileSync, writeFileSync, existsSync, readFileSync } from 'node:fs'
import { createClient } from '@supabase/supabase-js'

// 本地构建时 .env 是 gitignore 的，plain `node` 不会自动加载，
// 这里手动读一下 .env（不覆盖已存在的 process.env，CI 走 workflow env 优先）。
loadDotEnv()

const SITE_URL = (process.env.VITE_SITE_URL || 'https://lpw94.github.io').replace(/\/+$/, '')
const SITE_TITLE = '沃哥博客'
const SITE_DESC = '基于 React + Supabase 的个人博客'

// 1) SPA fallback
if (existsSync('dist/index.html')) {
  copyFileSync('dist/index.html', 'dist/404.html')
  console.log('[gh-pages] 已生成 dist/404.html (SPA 路由 fallback)')
} else {
  console.warn('[gh-pages] 未找到 dist/index.html，跳过 404.html 生成')
}

// 2) RSS + Sitemap（best-effort）
function escapeXml(s = '') {
  return String(s).replace(/[<>&'"]/g, (c) =>
    ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', "'": '&apos;', '"': '&quot;' }[c])
  )
}

// 剥掉 HTML 标签并压缩空白，用于生成 RSS 摘要
function toPlainText(html = '') {
  return String(html)
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

// 取发布时间；缺失或非法时回退到创建时间 / 当前时间，避免产出无效 <pubDate>
function pubDate(p) {
  const raw = p.published_at || p.created_at
  const d = raw ? new Date(raw) : new Date()
  return isNaN(d.getTime()) ? new Date().toUTCString() : d.toUTCString()
}

function buildRss(posts) {
  const items = posts
    .map((p) => {
      const url = `${SITE_URL}/post/${p.slug}`
      const excerpt = escapeXml(
        (p.content ? toPlainText(p.content).slice(0, 200) : '') || p.title
      )
      return `    <item>
      <title>${escapeXml(p.title)}</title>
      <link>${url}</link>
      <guid isPermaLink="true">${url}</guid>
      <pubDate>${pubDate(p)}</pubDate>
      <description>${excerpt}</description>
    </item>`
    })
    .join('\n')

  return `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>${escapeXml(SITE_TITLE)}</title>
    <link>${SITE_URL}</link>
    <description>${escapeXml(SITE_DESC)}</description>
    <language>zh-CN</language>
    <lastBuildDate>${new Date().toUTCString()}</lastBuildDate>
    <atom:link href="${SITE_URL}/rss.xml" rel="self" type="application/rss+xml" />
${items}
  </channel>
</rss>
`
}

function buildSitemap(posts) {
  const staticPages = ['', '/about', '/gallery', '/tools']
  const staticUrls = staticPages
    .map(
      (path) =>
        `  <url><loc>${SITE_URL}${path}</loc><changefreq>weekly</changefreq><priority>${
          path === '' ? '1.0' : '0.6'
        }</priority></url>`
    )
    .join('\n')
  const postUrls = posts
    .map(
      (p) =>
        `  <url><loc>${SITE_URL}/post/${p.slug}</loc><changefreq>monthly</changefreq><priority>0.8</priority></url>`
    )
    .join('\n')
  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${staticUrls}
${postUrls}
</urlset>
`
}

async function genFeeds() {
  const SUPABASE_URL = process.env.VITE_SUPABASE_URL
  const SUPABASE_ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY

  // 离线自测：FEEDS_OFFLINE_MOCK=1 时用假数据生成，不连网，仅用于本地校验产物格式
  if (process.env.FEEDS_OFFLINE_MOCK === '1') {
    const mock = [
      { slug: 'hello-world', title: '你好，世界', published_at: '2026-01-01T08:00:00Z', content: '<p>这是一篇示例文章</p>' },
      { slug: 'second-post', title: '第二篇', published_at: '2026-02-15T10:30:00Z', content: '纯文本示例 <b>加粗</b> & 符号测试' },
    ]
    writeFileSync('dist/rss.xml', buildRss(mock))
    writeFileSync('dist/sitemap.xml', buildSitemap(mock))
    console.log(`[gh-pages] 离线自测已生成 rss.xml / sitemap.xml（${mock.length} 篇假数据）`)
    return
  }

  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    console.warn('[gh-pages] 缺少 VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY，跳过 RSS/Sitemap 生成')
    return
  }
  const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY)
  const { data, error } = await supabase
    .from('posts')
    .select('slug, title, published_at, content')
    .eq('status', 'published')
    .not('published_at', 'is', null)
    .order('published_at', { ascending: false })

  if (error) {
    console.warn('[gh-pages] 拉取文章失败，跳过 RSS/Sitemap：', error.message)
    return
  }
  // 防御性过滤：只保留有 slug 且能解析出时间的文章，避免产出无效条目
  const posts = (data || []).filter((p) => p.slug && (p.published_at || p.created_at))
  if (posts.length === 0) {
    console.warn('[gh-pages] 暂无已发布文章，跳过 RSS/Sitemap 生成')
    return
  }

  writeFileSync('dist/rss.xml', buildRss(posts))
  writeFileSync('dist/sitemap.xml', buildSitemap(posts))
  console.log(`[gh-pages] 已生成 rss.xml / sitemap.xml（${posts.length} 篇文章）`)
}

// 极简 .env 解析（不依赖 dotenv 包），仅补全缺失的 VITE_* 变量
function loadDotEnv() {
  const path = '.env'
  if (!existsSync(path)) return
  const text = readFileSync(path, 'utf8')
  for (const line of text.split(/\r?\n/)) {
    const m = line.match(/^\s*([\w.-]+)\s*=\s*(.*)\s*$/)
    if (!m) continue
    const key = m[1]
    let val = m[2]
    if (
      (val.startsWith('"') && val.endsWith('"')) ||
      (val.startsWith("'") && val.endsWith("'"))
    ) {
      val = val.slice(1, -1)
    }
    if (process.env[key] === undefined) process.env[key] = val
  }
}

genFeeds().catch((e) =>
  console.warn('[gh-pages] 生成 RSS/Sitemap 失败（不影响部署）：', e.message)
)
