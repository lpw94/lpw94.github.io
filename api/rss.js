import { createClient } from '@supabase/supabase-js'

const escapeXml = (s = '') =>
  s.replace(/[<>&'"]/g, (c) =>
    ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', "'": '&apos;', '"': '&quot;' }[c])
  )

export default async function handler(req, res) {
  const supabase = createClient(
    process.env.VITE_SUPABASE_URL,
    process.env.VITE_SUPABASE_ANON_KEY
  )
  const base = process.env.VITE_SITE_URL || 'https://your-domain.com'

  const { data } = await supabase
    .from('posts')
    .select('*')
    .eq('status', 'published')
    .order('published_at', { ascending: false })
    .limit(50)

  const items = (data || [])
    .map((p) => {
      const url = `${base}/post/${p.slug}`
      const desc = (p.content || '').replace(/[#>*`_~]/g, '').slice(0, 200)
      return `    <item>
      <title>${escapeXml(p.title)}</title>
      <link>${url}</link>
      <guid>${url}</guid>
      <pubDate>${new Date(p.published_at).toUTCString()}</pubDate>
      <description>${escapeXml(desc)}</description>
    </item>`
    })
    .join('\n')

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
  <channel>
    <title>我的博客</title>
    <link>${base}</link>
    <description>基于 React + Supabase 的个人博客</description>
    <language>zh-CN</language>
${items}
  </channel>
</rss>`

  res.setHeader('Content-Type', 'application/rss+xml; charset=utf-8')
  res.status(200).send(xml)
}
