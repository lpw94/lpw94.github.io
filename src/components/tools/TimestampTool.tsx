import { useEffect, useState } from 'react'
import { toast } from '../../lib/toast'

const pad = (n: number) => String(n).padStart(2, '0')
const fmtLocal = (d: Date) =>
  `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`

/** 时间戳转换：当前时间 + 时间戳↔日期 互转 */
export default function TimestampTool() {
  const [now, setNow] = useState(() => new Date())
  const [tsInput, setTsInput] = useState('')
  const [dateInput, setDateInput] = useState('')

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000)
    return () => clearInterval(id)
  }, [])

  // 按位数自动识别秒(≤10位)/毫秒
  const tsToDate = (): string | null => {
    const v = tsInput.trim()
    if (!v) return null
    const n = Number(v)
    if (!Number.isFinite(n)) return '无效时间戳'
    const ms = v.length <= 10 ? n * 1000 : n
    const d = new Date(ms)
    if (Number.isNaN(d.getTime())) return '无效时间戳'
    return fmtLocal(d)
  }
  const dateToTs = (): string | null => {
    if (!dateInput) return null
    const t = new Date(dateInput).getTime()
    if (Number.isNaN(t)) return '无效日期'
    return `${Math.floor(t / 1000)} 秒  /  ${t} 毫秒`
  }
  const copy = async (text: string) => {
    if (!text) return
    try { await navigator.clipboard.writeText(text); toast('已复制', 'success') }
    catch { toast('复制失败', 'error') }
  }

  const nowSec = Math.floor(now.getTime() / 1000)

  return (
    <div className="tl-grid">
      <div className="tl-stats">
        <div className="tl-stat">
          <span className="tl-stat-label">当前时间</span>
          <span className="tl-stat-value tl-stat-sm">{fmtLocal(now)}</span>
        </div>
        <div className="tl-stat">
          <span className="tl-stat-label">秒级时间戳</span>
          <span className="tl-stat-value">{nowSec}</span>
        </div>
        <div className="tl-stat">
          <span className="tl-stat-label">毫秒时间戳</span>
          <span className="tl-stat-value">{now.getTime()}</span>
        </div>
      </div>
      <div className="tl-actions">
        <button type="button" className="tl-btn" onClick={() => copy(String(nowSec))}>复制秒戳</button>
        <button type="button" className="tl-btn" onClick={() => copy(String(now.getTime()))}>复制毫秒戳</button>
      </div>

      <label className="tl-field">
        <span>时间戳 → 日期（10 位秒 / 13 位毫秒自动识别）</span>
        <input
          className="tl-input"
          value={tsInput}
          onChange={(e) => setTsInput(e.target.value)}
          placeholder="例如 1700000000"
          inputMode="numeric"
        />
      </label>
      {tsToDate() && <div className="tl-out">{tsToDate()}</div>}

      <label className="tl-field">
        <span>日期 → 时间戳</span>
        <input className="tl-input" type="datetime-local" value={dateInput} onChange={(e) => setDateInput(e.target.value)} />
      </label>
      {dateToTs() && <div className="tl-out">{dateToTs()}</div>}
    </div>
  )
}
