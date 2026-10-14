import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'

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
  /** 日历弹窗开关：点击时间组件弹出 / 收起 */
  const [calOpen, setCalOpen] = useState(false)
  /** 日历当前浏览的年月 */
  const [view, setView] = useState(() => ({ y: new Date().getFullYear(), m: new Date().getMonth() }))
  /** 已标记日期 'YYYY-MM-DD' */
  const [selected, setSelected] = useState<string | null>(null)

  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000)
    return () => clearInterval(t)
  }, [])

  // 弹窗打开期间：锁背景滚动 + Esc 关闭（与站内其它弹窗一致）
  useEffect(() => {
    if (!calOpen) return
    const prevOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setCalOpen(false)
    }
    document.addEventListener('keydown', onKey)
    return () => {
      document.body.style.overflow = prevOverflow
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
    <section className="widget-card time-widget" aria-label="当前时间">
      {/* 时间展示区整体即开关：点击弹出日历弹窗 */}
      <div
        className="tw-main"
        role="button"
        tabIndex={0}
        aria-expanded={calOpen}
        aria-haspopup="dialog"
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

      {calOpen &&
        createPortal(
          <div
            className="modal-backdrop"
            onMouseDown={(e) => {
              // 只有点到遮罩本身才关闭，点弹窗内部不关
              if (e.target === e.currentTarget) setCalOpen(false)
            }}
          >
            <div
              className="modal cal-modal"
              role="dialog"
              aria-modal="true"
              aria-label="日历"
            >
              <div className="modal-head">
                <h2>日历</h2>
                <button
                  type="button"
                  className="modal-close"
                  onClick={() => setCalOpen(false)}
                  aria-label="关闭"
                >
                  ×
                </button>
              </div>

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
                  <button
                    type="button"
                    className="cal-today"
                    onClick={() => setView({ y: now.getFullYear(), m: now.getMonth() })}
                  >
                    回到今天
                  </button>
                </div>
              </div>
            </div>
          </div>,
          document.body,
        )}
    </section>
  )
}
