// GitHub Pages 部署辅助脚本（在 vite build 之后运行）
// 1) 复制 dist/index.html -> dist/404.html，解决 SPA 在 GitHub Pages 上刷新 404 的问题
// 2) 从 Supabase 拉取已发布文章，生成静态 dist/rss.xml 与 dist/sitemap.xml
//    均为 best-effort：缺少环境变量或拉取失败时不阻断部署，仅告警。
import { copyFileSync, writeFileSync, existsSync } from 'node:fs'
import { createClient } from '@supabase/supabase-js'

const SITE_URL = process.env.VITE_SITE_URL || 'https://lpw94.github.io'
const SUPABASE_URL = process.env.VITE_SUPABASE_URL
const SUPABASE_ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY

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

async function genFeeds() {
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    console.warn('[gh-pages] 缺少 VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY，跳过 RSS/Sitemap 生成')
    return
  }
  const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY)
  const { data, error } = await supabase
    .from('posts')
    .select('slug, title, published_at')
    .eq('status', 'published')
    .order('published_at', { ascending: false })

  if (error) {
    console.warn('[gh-pages] 拉取文章失败，跳过 RSS/Sitemap：', error.message)
    return
  }
  if (!data || data.length === 0) {
    console.warn('[gh-pages] 暂无已发布文章，跳过 RSS/Sitemap 生成')
    return
  }

  const items = data
    .map(
      (p) => `    <item>
      <title>${escapeXml(p.title)}</title>
      <link>${SITE_URL}/post/${p.slug}</link>
      <guid>${SITE_URL}/post/${p.slug}</guid>
      <pubDate>${new Date(p.published_at).toUTCString()}</pubDate>
    </item>`
    )
    .join('\n')

  const rss = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
  <channel>
    <title>我的博客</title>
    <link>${SITE_URL}</link>
    <description>基于 React + Supabase 的个人博客</description>
${items}
  </channel>
</rss>
`
  writeFileSync('dist/rss.xml', rss)

  const urls = data
    .map((p) => `  <url><loc>${SITE_URL}/post/${p.slug}</loc></url>`)
    .join('\n')
  const sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url><loc>${SITE_URL}</loc></url>
${urls}
</urlset>
`
  writeFileSync('dist/sitemap.xml', sitemap)

  console.log(`[gh-pages] 已生成 rss.xml / sitemap.xml（${data.length} 篇文章）`)
}

genFeeds().catch((e) =>
  console.warn('[gh-pages] 生成 RSS/Sitemap 失败（不影响部署）：', e.message)
)
