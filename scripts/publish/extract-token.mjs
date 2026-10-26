// 从 Chrome 的 leveldb 里提取 Supabase 会话 token
// 用法: node extract-token.mjs <leveldbDir>
// 只输出 JWT（不落盘），过期时间一并给出
import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

const dir = process.argv[2]
const files = []
for (const f of readdirSync(dir)) {
  if (/\.(log|ldb)$/.test(f)) files.push(join(dir, f))
}

let best = null
for (const f of files) {
  let buf
  try {
    buf = readFileSync(f)
  } catch {
    continue
  }
  const text = buf.toString('latin1')
  const key = 'sb-grinllviahukzgbxvmhz-auth-token'
  let idx = text.indexOf(key)
  while (idx !== -1) {
    const seg = text.slice(idx, idx + 8000)
    // 找 "access_token":"..."
    const m = seg.match(/"access_token"\s*:\s*"([A-Za-z0-9_\-\.]+)"/)
    if (m) {
      const token = m[1]
      try {
        const payload = JSON.parse(
          Buffer.from(token.split('.')[1], 'base64url').toString('utf8'),
        )
        const exp = payload.exp ? payload.exp * 1000 : 0
        const now = Date.now()
        // 取最新的、尚未过期的
        if (!best || exp > best.exp) {
          best = { token, exp, sub: payload.sub, role: payload.role, file: f }
        }
      } catch {
        /* 不是合法 JWT，跳过 */
      }
    }
    idx = text.indexOf(key, idx + 1)
  }
}

if (!best) {
  console.error('未找到可用 token')
  process.exit(1)
}
console.error(
  `来源: ${best.file}\nrole=${best.role} sub=${best.sub}\n过期时间: ${new Date(best.exp).toISOString()}\n是否过期: ${best.exp < Date.now()}`,
)
// token 走 stdout，调用方从管道取，不落盘
process.stdout.write(best.token)
