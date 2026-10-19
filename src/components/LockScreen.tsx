import { useEffect, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'

// 锁屏遮罩：仅首页展示。点击任意位置 / 按 Esc / Enter 解锁。
// 内容走「有意思」路线：随时间变化的问候、随机吐槽标语、实时时钟、漂浮的趣味 emoji。

const WEEK = ['日', '一', '二', '三', '四', '五', '六']

/** 按小时给一句问候（深夜 / 早 / 中 / 下午 / 晚） */
function greeting(h: number): string {
  if (h < 5) return '夜深了，注意休息'
  if (h < 11) return '早上好'
  if (h < 13) return '中午好'
  if (h < 18) return '下午好'
  if (h < 23) return '晚上好'
  return '夜深了，注意休息'
}

/** 随机吐槽 / 鼓励标语，让锁屏不那么无聊 */
const TAGLINES = [
  '代码写累了？先进来歇会儿 ☕',
  '今天的 bug 修完了吗 🐛',
  '一杯咖啡，一段代码，一个更好的自己',
  '保持热爱，奔赴山海 🚀',
  '好记性不如烂笔头，好代码不如常重构',
  '键盘敲烂，月薪过万 💻',
  '每一个不眠的夜晚，都在为梦想充电 🌙',
  'Stay hungry, stay foolish',
  '别卷了，先看会儿我的博客 📚',
  '这站点是用 React + Supabase 搭的，欢迎翻源码',
]

/** 背景漂浮的趣味 emoji */
const FLOATERS = ['💻', '🚀', '☕', '🌟', '✨', '🔒', '📚', '🐛', '🌙', '🍵']

/** 每秒跳动的实时时钟 */
function useNow() {
  const [now, setNow] = useState(() => new Date())
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000)
    return () => clearInterval(t)
  }, [])
  return now
}

export default function LockScreen({ onUnlock }: { onUnlock: () => void }) {
  const now = useNow()
  // 标语只在挂载时随机定一次，避免每秒重抽
  const tagline = useMemo(
    () => TAGLINES[Math.floor(Math.random() * TAGLINES.length)],
    [],
  )
  // 漂浮物也只定一次
  const floaters = useMemo(
    () =>
      FLOATERS.map((emoji, i) => ({
        emoji,
        left: `${(i * 9.5 + Math.random() * 6) % 100}%`,
        delay: `${(Math.random() * 6).toFixed(2)}s`,
        duration: `${(7 + Math.random() * 6).toFixed(2)}s`,
        size: `${18 + Math.random() * 22}px`,
      })),
    [],
  )

  const hh = String(now.getHours()).padStart(2, '0')
  const mm = String(now.getMinutes()).padStart(2, '0')
  const ss = String(now.getSeconds()).padStart(2, '0')
  const dateStr = `${now.getFullYear()} 年 ${now.getMonth() + 1} 月 ${now.getDate()} 日 星期${
    WEEK[now.getDay()]
  }`

  // 键盘解锁：Esc / Enter 都算
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' || e.key === 'Enter') onUnlock()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onUnlock])

  // 锁屏期间锁住背景滚动，避免遮罩后面还能滚出滚动条
  useEffect(() => {
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = prev
    }
  }, [])

  return createPortal(
    <div
      className="lock-screen"
      role="dialog"
      aria-modal="true"
      aria-label="锁屏遮罩"
      onClick={onUnlock}
    >
      <div className="lock-bg" aria-hidden="true">
        {floaters.map((f, i) => (
          <span
            key={i}
            className="lock-floater"
            style={{
              left: f.left,
              animationDelay: f.delay,
              animationDuration: f.duration,
              fontSize: f.size,
            }}
          >
            {f.emoji}
          </span>
        ))}
      </div>

      <div className="lock-card">
        <div className="lock-emoji" aria-hidden="true">
          <span className="lk lk-closed">🔒</span>
          <span className="lk lk-open">🔓</span>
        </div>
        <h1 className="lock-title">沃哥博客</h1>
        <p className="lock-greet">
          {greeting(now.getHours())}，欢迎来到我的小宇宙
        </p>
        <p className="lock-tagline">{tagline}</p>
        <div className="lock-clock">
          {hh}:{mm}
          <span className="lock-sec">:{ss}</span>
        </div>
        <div className="lock-date">{dateStr}</div>
        <div className="lock-hint">
          <span className="lock-pulse">👆</span> 点击任意位置进入
        </div>
      </div>
    </div>,
    document.body,
  )
}
