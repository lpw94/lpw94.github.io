// 通用 CDP 求值器（注入 + 轮询，避开 awaitPromise 在 about:blank 被节流）
// 用法: node cdp-eval.mjs <expressionFile> [pageUrl] [timeoutMs]
// 占位符替换（避免密钥/正文落盘）：{{KEY}} / {{URL}} / {{CONTENT}}
import { readFileSync } from 'node:fs'

const exprFile = process.argv[2]
const pageUrl = process.argv[3] || 'https://lpw94.github.io/'
const timeoutMs = Number(process.argv[4] || 30000)

const vars = {
  KEY: process.env.CDP_KEY || '',
  APIKEY: process.env.CDP_APIKEY || process.env.CDP_KEY || '',
  URL: process.env.CDP_URL || '',
  CONTENT: process.env.CDP_CONTENT_FILE
    ? JSON.stringify(readFileSync(process.env.CDP_CONTENT_FILE, 'utf8'))
    : '""',
}
const body = readFileSync(exprFile, 'utf8').replace(/\{\{(\w+)\}\}/g, (_m, k) => vars[k] ?? '')

const cdpPort = process.env.CDP_PORT || '9222'
// 有的 Chrome 只监听 IPv4 的 127.0.0.1，有的只监听 IPv6 的 [::1]，两个都试
let targets = null
for (const host of ['127.0.0.1', '[::1]']) {
  try {
    const res = await fetch(`http://${host}:${cdpPort}/json/list`)
    if (res.ok) {
      targets = await res.json()
      console.error(`[cdp] connected via ${host}:${cdpPort}`)
      break
    }
  } catch (e) {
    console.error(`[cdp] ${host}:${cdpPort} failed: ${e.message}`)
  }
}
if (!targets) throw new Error('CDP 端点连不上')
const target = targets.find((t) => t.type === 'page')
if (!target) throw new Error('没有可用的 page target')

const ws = new WebSocket(target.webSocketDebuggerUrl)
let id = 0
const pending = new Map()
ws.onmessage = (ev) => {
  const msg = JSON.parse(ev.data)
  if (msg.id && pending.has(msg.id)) {
    pending.get(msg.id)(msg)
    pending.delete(msg.id)
  }
}
await new Promise((res, rej) => {
  ws.onopen = res
  ws.onerror = rej
})

const send = (method, params = {}, ms = 15000) =>
  new Promise((resolve) => {
    const mid = ++id
    const timer = setTimeout(() => {
      pending.delete(mid)
      resolve({ __timeout: true })
    }, ms)
    pending.set(mid, (m) => {
      clearTimeout(timer)
      resolve(m)
    })
    ws.send(JSON.stringify({ id: mid, method, params }))
  })

await send('Page.enable')
await send('Runtime.enable')
await send('Page.navigate', { url: pageUrl })
await new Promise((r) => setTimeout(r, 3000))

const inject = `
window.__r = null;
window.__e = null;
(function(){
  Promise.resolve()
    .then(function(){ return (${body}); })
    .then(function(v){ window.__r = v; })
    .catch(function(err){ window.__e = String((err && err.stack) || err); });
})();
'started'
`
const start = await send('Runtime.evaluate', { expression: inject })
if (start.__timeout) throw new Error('注入 evaluate 超时')
if (start.result?.exceptionDetails || start.result?.result?.exceptionDetails) {
  console.error(
    'INJECT SYNTAX/RUNTIME ERROR:',
    JSON.stringify(start.result?.exceptionDetails || start.result?.result?.exceptionDetails).slice(0, 800),
  )
  process.exit(1)
}

const deadline = Date.now() + timeoutMs
let out = null
let parsed = null
while (Date.now() < deadline) {
  await new Promise((r) => setTimeout(r, 400))
  const poll = await send('Runtime.evaluate', {
    expression: 'JSON.stringify({ r: window.__r, e: window.__e })',
    returnByValue: true,
  })
  if (poll.__timeout) continue
  const raw = poll.result?.result?.value
  if (!raw) continue
  parsed = JSON.parse(raw)
  if (parsed.e) {
    console.error('ERROR:', parsed.e.slice(0, 1000))
    process.exitCode = 1
    break
  }
  if (parsed.r !== null && parsed.r !== undefined) {
    out = parsed.r
    break
  }
}

if (out !== null) console.log(JSON.stringify(out, null, 2))
else if (!process.exitCode) {
  console.error('TIMEOUT: 未在限定时间内拿到结果')
  process.exitCode = 1
}
ws.close()
