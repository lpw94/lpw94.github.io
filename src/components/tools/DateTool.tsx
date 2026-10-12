import { useState } from 'react'
import { toast } from '../../lib/toast'

const pad = (n: number) => String(n).padStart(2, '0')
const toISO = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
const parseDate = (s: string) => {
  const [y, m, d] = s.split('-').map(Number)
  return new Date(y, (m || 1) - 1, d || 1)
}
// 工作日：周一~周五，不含法定节假日
function workdaysBetween(a: Date, b: Date) {
  const start = a <= b ? a : b
  const end = a <= b ? b : a
  let count = 0
  const d = new Date(start)
  while (d <= end) {
    const w = d.getDay()
    if (w !== 0 && w !== 6) count++
    d.setDate(d.getDate() + 1)
  }
  return count
}

/** 日期计算：日期间隔 + 日期推算 */
export default function DateTool() {
  const [d1, setD1] = useState(() => toISO(new Date()))
  const [d2, setD2] = useState('')
  const [base, setBase] = useState(() => toISO(new Date()))
  const [offset, setOffset] = useState('100')
  const [unit, setUnit] = useState<'day' | 'week' | 'month' | 'year'>('day')
  const [dir, setDir] = useState<'add' | 'sub'>('add')

  const diff = (() => {
    if (!d1 || !d2) return null
    const a = parseDate(d1)
    const b = parseDate(d2)
    const days = Math.round((b.getTime() - a.getTime()) / 86400000)
    const abs = Math.abs(days)
    return { days: abs, weeks: Math.floor(abs / 7), remain: abs % 7, workdays: workdaysBetween(a, b) }
  })()

  const result = (() => {
    if (!base) return ''
    const n = parseInt(offset, 10)
    if (!Number.isFinite(n)) return ''
    const d = parseDate(base)
    const sign = dir === 'add' ? 1 : -1
    if (unit === 'day') d.setDate(d.getDate() + sign * n)
    else if (unit === 'week') d.setDate(d.getDate() + sign * n * 7)
    else if (unit === 'month') d.setMonth(d.getMonth() + sign * n)
    else d.setFullYear(d.getFullYear() + sign * n)
    return toISO(d)
  })()
  const weekday = result ? '日一二三四五六'[parseDate(result).getDay()] : ''

  return (
    <div className="tl-grid">
      <div className="date-block">
        <h3 className="date-block-title">日期间隔</h3>
        <div className="date-row">
          <input className="tl-input" type="date" value={d1} onChange={(e) => setD1(e.target.value)} />
          <span className="date-arrow">→</span>
          <input className="tl-input" type="date" value={d2} onChange={(e) => setD2(e.target.value)} />
        </div>
        {diff && (
          <div className="tl-stats">
            <div className="tl-stat"><span className="tl-stat-label">相差天数</span><span className="tl-stat-value">{diff.days} 天</span></div>
            <div className="tl-stat"><span className="tl-stat-label">周数</span><span className="tl-stat-value tl-stat-sm">{diff.weeks} 周 {diff.remain} 天</span></div>
            <div className="tl-stat"><span className="tl-stat-label">工作日</span><span className="tl-stat-value">{diff.workdays} 天</span></div>
          </div>
        )}
        <p className="tl-msg">工作日不含周末与法定节假日，仅供参考。</p>
      </div>

      <div className="date-block">
        <h3 className="date-block-title">日期推算</h3>
        <div className="date-row">
          <input className="tl-input" type="date" value={base} onChange={(e) => setBase(e.target.value)} />
          <select className="tl-input" value={dir} onChange={(e) => setDir(e.target.value as 'add' | 'sub')}>
            <option value="add">之后</option>
            <option value="sub">之前</option>
          </select>
          <input className="tl-input date-num" type="number" value={offset} onChange={(e) => setOffset(e.target.value)} />
          <select className="tl-input" value={unit} onChange={(e) => setUnit(e.target.value as typeof unit)}>
            <option value="day">天</option>
            <option value="week">周</option>
            <option value="month">月</option>
            <option value="year">年</option>
          </select>
        </div>
        {result && (
          <div className="date-result">
            <span className="date-result-value">{result}</span>
            <span className="date-result-week">星期{weekday}</span>
            <button
              type="button"
              className="tl-btn"
              onClick={async () => {
                try { await navigator.clipboard.writeText(result); toast('已复制', 'success') }
                catch { toast('复制失败', 'error') }
              }}
            >
              复制
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
