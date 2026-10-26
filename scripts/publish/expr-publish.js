// 发布博文到 Supabase posts 表（经 Chrome CDP 在页面上下文里请求，绕开本机 TLS 阻断）
// 占位符由 cdp-eval.mjs 从环境变量注入，密钥不落盘：
//   {{KEY}}     <- CDP_KEY（authenticated JWT 或 service_role）
//   {{URL}}     <- CDP_URL
//   {{CONTENT}} <- CDP_CONTENT_FILE 指向的 markdown 全文
// 注意：整个文件必须是一个「表达式」（async IIFE），不能有顶层语句。
(async function () {
  const TITLE =
    '水表取数与 Excel 导出实战：五个接口契约陷阱，和一份报表该有哪些列'
  const SLUG = 'meter-data-excel-export'
  const CATEGORY = 'backend'

  const baseHeaders = {
    // apikey 必须是项目的 anon/service_role key；
    // Authorization 才是用户的 JWT（Supabase 用这两个头分别做「API 鉴权」和「身份鉴权」）
    apikey: '{{APIKEY}}',
    Authorization: 'Bearer {{KEY}}',
    'Content-Type': 'application/json',
  }
  const content = {{CONTENT}}

  // 幂等：同 slug 已存在则更新，避免重复发布产生两条
  const dupRes = await fetch(
    '{{URL}}/rest/v1/posts?select=id,status&slug=eq.' + encodeURIComponent(SLUG),
    { headers: baseHeaders },
  )
  const dupText = await dupRes.text()
  if (dupRes.status !== 200) {
    return { step: 'check', status: dupRes.status, body: dupText.slice(0, 500) }
  }
  const existing = JSON.parse(dupText)

  const payload = {
    title: TITLE,
    slug: SLUG,
    content: content,
    category: CATEGORY,
    status: 'published',
    published_at: new Date().toISOString(),
  }

  if (existing.length) {
    const res = await fetch('{{URL}}/rest/v1/posts?id=eq.' + existing[0].id, {
      method: 'PATCH',
      headers: Object.assign({}, baseHeaders, { Prefer: 'return=representation' }),
      body: JSON.stringify(payload),
    })
    const text = await res.text()
    return {
      action: 'updated',
      status: res.status,
      rows: res.ok ? JSON.parse(text).length : 0,
      body: res.ok ? '' : text.slice(0, 500),
    }
  }

  const res = await fetch('{{URL}}/rest/v1/posts', {
    method: 'POST',
    headers: Object.assign({}, baseHeaders, { Prefer: 'return=representation' }),
    body: JSON.stringify(payload),
  })
  const text = await res.text()

  return {
    action: 'created',
    status: res.status,
    rows: res.ok ? JSON.parse(text).length : 0,
    slug: SLUG,
    body: res.ok ? '' : text.slice(0, 500),
  }
})()
