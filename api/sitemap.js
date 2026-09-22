import { createClient } from '@supabase/supabase-js'

export default async function handler(req, res) {
  const supabase = createClient(
    process.env.VITE_SUPABASE_URL,
    process.env.VITE_SUPABASE_ANON_KEY
  )
  const base = process.env.VITE_SITE_URL || 'https://your-domain.com'

  const { data } = await supabase
    .from('posts')
    .select('slug, updated_at, published_at')
    .eq('status', 'published')

  const home = `  <url><loc>${base}/</loc></url>`
  const urls = (data || [])
    .map((p) => {
      const lastmod = (p.updated_at || p.published_at || '').slice(0, 10)
      return `  <url><loc>${base}/post/${p.slug}</loc><lastmod>${lastmod}</lastmod></url>`
    })
    .join('\n')

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${home}
${urls}
</urlset>`

  res.setHeader('Content-Type', 'application/xml; charset=utf-8')
  res.status(200).send(xml)
}
