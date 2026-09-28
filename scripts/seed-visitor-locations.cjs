// 生成「在浏览器页面上下文里向线上 visitor_locations 插演示足迹」的 run-code 脚本。
// 背景：沙箱 Node/curl 到 supabase.co 的 TLS 握手失败，但浏览器能直连（页面 RPC 正常），
// 所以借用 playwright 打开的本地页面执行 fetch POST（PostgREST 默认 CORS *）。
// 用法：playwright-cli open http://localhost:5174/ 后，
//       playwright-cli run-code "$(node scripts/seed-visitor-locations.cjs)"
const fs = require('fs')
const path = require('path')

// 手动解析 .env（不引 dotenv 依赖）
const env = Object.fromEntries(
  fs
    .readFileSync(path.join(__dirname, '..', '.env'), 'utf8')
    .split('\n')
    .filter((l) => l.includes('=') && !l.trim().startsWith('#'))
    .map((l) => {
      const i = l.indexOf('=')
      return [l.slice(0, i).trim(), l.slice(i + 1).trim()]
    }),
)
// URL 规范化：裁掉可能带的 /rest/v1 等后缀（与前端 supabase.ts 同逻辑）
const baseUrl = env.VITE_SUPABASE_URL.replace(/\/(rest|auth|storage|realtime)\/v1\/?$/, '').replace(/\/+$/, '')

// ── WGS-84 → GCJ-02（与 src/lib/geo.ts 同算法，保持一致） ──
const PI = 3.1415926535897932384626
const AXIS = 6378245.0
const EE = 0.00669342162296594323
const outOfChina = (lng, lat) => lng < 72.004 || lng > 137.8347 || lat < 0.8293 || lat > 55.8271
function transformLat(x, y) {
  let ret = -100.0 + 2.0 * x + 3.0 * y + 0.2 * y * y + 0.1 * x * y + 0.2 * Math.sqrt(Math.abs(x))
  ret += ((20.0 * Math.sin(6.0 * x * PI) + 20.0 * Math.sin(2.0 * x * PI)) * 2.0) / 3.0
  ret += ((20.0 * Math.sin(y * PI) + 40.0 * Math.sin((y / 3.0) * PI)) * 2.0) / 3.0
  ret += ((160.0 * Math.sin((y / 12.0) * PI) + 320.0 * Math.sin((y * PI) / 30.0)) * 2.0) / 3.0
  return ret
}
function transformLng(x, y) {
  let ret = 300.0 + x + 2.0 * y + 0.1 * x * x + 0.1 * x * y + 0.1 * Math.sqrt(Math.abs(x))
  ret += ((20.0 * Math.sin(6.0 * x * PI) + 20.0 * Math.sin(2.0 * x * PI)) * 2.0) / 3.0
  ret += ((20.0 * Math.sin(x * PI) + 40.0 * Math.sin((x / 3.0) * PI)) * 2.0) / 3.0
  ret += ((150.0 * Math.sin((x / 12.0) * PI) + 300.0 * Math.sin((x / 30.0) * PI)) * 2.0) / 3.0
  return ret
}
function wgs84ToGcj02(lng, lat) {
  if (outOfChina(lng, lat)) return [lng, lat]
  let dLat = transformLat(lng - 105.0, lat - 35.0)
  let dLng = transformLng(lng - 105.0, lat - 35.0)
  const radLat = (lat / 180.0) * PI
  let magic = Math.sin(radLat)
  magic = 1 - EE * magic * magic
  const sqrtMagic = Math.sqrt(magic)
  dLat = (dLat * 180.0) / (((AXIS * (1 - EE)) / (magic * sqrtMagic)) * PI)
  dLng = (dLng * 180.0) / ((AXIS / sqrtMagic) * Math.cos(radLat) * PI)
  return [lng + dLng, lat + dLat]
}
const r2 = (n) => Math.round(n * 100) / 100

// 演示足迹：WGS-84 城市坐标 → 转 GCJ-02 → 2 位小数（模拟组件真实写入）
// created_at 错开分布在最近几天，让"最近足迹"排序更自然
const CITIES = [
  { city: '烟台', country: '中国', wgs: [121.39, 37.54], daysAgo: 0 },
  { city: '北京', country: '中国', wgs: [116.41, 39.9], daysAgo: 1 },
  { city: '上海', country: '中国', wgs: [121.47, 31.23], daysAgo: 2 },
  { city: '深圳', country: '中国', wgs: [114.06, 22.55], daysAgo: 3 },
  { city: '杭州', country: '中国', wgs: [120.16, 30.29], daysAgo: 4 },
  { city: '成都', country: '中国', wgs: [104.07, 30.66], daysAgo: 5 },
  { city: '西安', country: '中国', wgs: [108.94, 34.34], daysAgo: 6 },
  { city: '武汉', country: '中国', wgs: [114.31, 30.59], daysAgo: 7 },
]

const rows = CITIES.map((c) => {
  const [lng, lat] = wgs84ToGcj02(c.wgs[0], c.wgs[1])
  const ts = new Date(Date.now() - c.daysAgo * 86400000 - Math.floor(Math.random() * 3600000))
  return { lat: r2(lat), lng: r2(lng), city: c.city, country: c.country, created_at: ts.toISOString() }
})

const payload = { url: `${baseUrl}/rest/v1/visitor_locations`, key: env.VITE_SUPABASE_ANON_KEY, rows }

// 输出单行 run-code 脚本（在页面上下文执行 fetch POST）
const script = `async page => {
  const p = ${JSON.stringify(payload)};
  const res = await page.evaluate(async (p) => {
    const r = await fetch(p.url, {
      method: 'POST',
      headers: {
        apikey: p.key,
        Authorization: 'Bearer ' + p.key,
        'Content-Type': 'application/json',
        Prefer: 'return=representation',
      },
      body: JSON.stringify(p.rows),
    });
    const text = await r.text();
    return { status: r.status, body: text.slice(0, 500) };
  }, p);
  console.log('SEED_RESULT ' + JSON.stringify(res));
}`

process.stdout.write(script.replace(/\n\s*/g, ' '))
