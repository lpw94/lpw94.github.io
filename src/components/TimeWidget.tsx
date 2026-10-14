import { useEffect, useRef, useState } from 'react'

const WEEK = ['日', '一', '二', '三', '四', '五', '六']

function greeting(h: number) {
  if (h < 5) return '夜深了'
  if (h < 11) return '早上好'
  if (h < 13) return '中午好'
  if (h < 18) return '下午好'
  if (h < 23) return '晚上好'
  return '夜深了'
}

const pad = (n: number) => n.toString().padStart(2, '0')

/** 日期 -> 'YYYY-MM-DD'，用于今天 / 选中态比对 */
const keyOf = (y: number, m: number, d: number) => `${y}-${pad(m)}-${pad(d)}`

export default function TimeWidget() {
  const [now, setNow] = useState(() => new Date())
  /** 日历面板展开状态：点击时间组件弹出 / 收起 */
  const [calOpen, setCalOpen] = useState(false)
  /** 日历当前浏览的年月 */
  const [view, setView] = useState(() => ({ y: new Date().getFullYear(), m: new Date().getMonth() }))
  /** 已标记日期 'YYYY-MM-DD' */
  const [selected, setSelected] = useState<string | null>(null)
  const rootRef = useRef<HTMLElement>(null)

  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000)
    return () => clearInterval(t)
  }, [])

  // 展开期间：点组件外部 / 按 Esc 收起
  useEffect(() => {
    if (!calOpen) return
    const onDown = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setCalOpen(false)
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setCalOpen(false)
    }
    document.addEventListener('mousedown', onDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [calOpen])

  const toggleCal = () => {
    setCalOpen((v) => {
      // 每次展开都重置到当前月，避免上次翻到半年前一脸懵
      if (!v) setView({ y: now.getFullYear(), m: now.getMonth() })
      return !v
    })
  }

  const shiftMonth = (delta: number) => {
    // 借 Date 的溢出规则处理跨年（12 月 +1 -> 次年 1 月）
    const d = new Date(view.y, view.m + delta, 1)
    setView({ y: d.getFullYear(), m: d.getMonth() })
  }

  // 月历格子：前置空白（每月 1 号前补占位）+ 当月天数
  const firstWeekday = new Date(view.y, view.m, 1).getDay()
  const daysInMonth = new Date(view.y, view.m + 1, 0).getDate()
  const cells: (number | null)[] = [
    ...Array.from({ length: firstWeekday }, () => null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ]
  const isCurrentMonth = view.y === now.getFullYear() && view.m === now.getMonth()
  const selectedText = selected
    ? (() => {
        const [y, m, d] = selected.split('-').map(Number)
        return `已选 ${m} 月 ${d} 日 · 星期${WEEK[new Date(y, m - 1, d).getDay()]}`
      })()
    : ''

  const h = now.getHours()
  return (
    <section className="widget-card time-widget" ref={rootRef} aria-label="当前时间">
      {/* 时间展示区整体即开关：点击弹出 / 收起日历 */}
      <div
        className="tw-main"
        role="button"
        tabIndex={0}
        aria-expanded={calOpen}
        title="点击查看日历"
        onClick={toggleCal}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault()
            toggleCal()
          }
        }}
      >
        <div className="tw-greet">{greeting(h)}</div>
        <div className="tw-clock">{pad(h)}:{pad(now.getMinutes())}:{pad(now.getSeconds())}</div>
        <div className="tw-date">
          {now.getFullYear()} 年 {now.getMonth() + 1} 月 {now.getDate()} 日 · 星期{WEEK[now.getDay()]}
        </div>
        <div className="tw-hint">{calOpen ? '点击收起日历' : '点击展开日历'}</div>
      </div>

      {calOpen && (
        <div className="cal">
          <div className="cal-head">
            <button
              type="button"
              className="cal-nav"
              aria-label="上个月"
              onClick={() => shiftMonth(-1)}
            >
              ‹
            </button>
            <span className="cal-title">
              {view.y} 年 {view.m + 1} 月
            </span>
            <button
              type="button"
              className="cal-nav"
              aria-label="下个月"
              onClick={() => shiftMonth(1)}
            >
              ›
            </button>
          </div>

          <div className="cal-grid cal-weekdays">
            {WEEK.map((w) => (
              <span key={w} className="cal-wd">
                {w}
              </span>
            ))}
          </div>

          <div className="cal-grid">
            {cells.map((c, i) =>
              c === null ? (
                <span key={`blank-${i}`} className="cal-cell is-blank" />
              ) : (
                <button
                  key={c}
                  type="button"
                  className={`cal-cell${
                    isCurrentMonth && c === now.getDate() ? ' is-today' : ''
                  }${selected === keyOf(view.y, view.m + 1, c) ? ' is-selected' : ''}`}
                  onClick={() => setSelected(keyOf(view.y, view.m + 1, c))}
                >
                  {c}
                </button>
              ),
            )}
          </div>

          <div className="cal-foot">
            <span className="cal-selected">{selectedText || '点日期可标记'}</span>
            <button type="button" className="cal-today" onClick={() => setView({ y: now.getFullYear(), m: now.getMonth() })}>
              回到今天
            </button>
          </div>
        </div>
      )}
    </section>
  )
}
