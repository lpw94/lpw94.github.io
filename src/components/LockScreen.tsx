import { useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'

// 锁屏遮罩：仅首页展示。解锁方式 = 一道随机算术题，输入正确答案才解锁。
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
  '代码写累了？答对题再进来 ☕',
  '今天的 bug 修完了吗 🐛',
  '一杯咖啡，一段代码，一个更好的自己',
  '保持热爱，奔赴山海 🚀',
  '好记性不如烂笔头，好代码不如常重构',
  '键盘敲烂，月薪过万 💻',
  '每一个不眠的夜晚，都在为梦想充电 🌙',
  'Stay hungry, stay foolish',
  '别卷了，先答对这道题 📚',
  '这站点是用 React + Supabase 搭的，欢迎翻源码',
]

/** 背景漂浮的趣味 emoji */
const FLOATERS = ['💻', '🚀', '☕', '🌟', '✨', '🔒', '📚', '🐛', '🌙', '🍵']

function rand(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min
}

type Problem = { a: number; b: number; op: string; answer: number }

/** 随机生成一道简单算术题（+ / - / ×），保证结果是非负整数、难度适中 */
function makeProblem(): Problem {
  const op = ['+', '-', '×'][rand(0, 2)]
  if (op === '+') {
    const a = rand(2, 19)
    const b = rand(2, 19)
    return { a, b, op, answer: a + b }
  }
  if (op === '-') {
    const a = rand(6, 20)
    const b = rand(1, a - 1)
    return { a, b, op, answer: a - b }
  }
  const a = rand(2, 9)
  const b = rand(2, 9)
  return { a, b, op, answer: a * b }
}

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
  // 标语 / 漂浮物只在挂载时随机定一次，避免每秒重抽
  const tagline = useMemo(
    () => TAGLINES[Math.floor(Math.random() * TAGLINES.length)],
    [],
  )
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

  // 算术题「密码」相关状态
  const [problem, setProblem] = useState<Problem>(makeProblem)
  const [value, setValue] = useState('')
  const [error, setError] = useState('')
  const [shake, setShake] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  // 一进入就聚焦输入框，方便直接作答
  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  // 锁屏期间锁住背景滚动，避免遮罩后面还能滚出滚动条
  useEffect(() => {
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = prev
    }
  }, [])

  const triggerShake = () => {
    setShake(true)
    window.setTimeout(() => setShake(false), 450)
  }

  const submit = (e: React.FormEvent) => {
    e.preventDefault()
    const raw = value.trim()
    if (raw === '') {
      setError('先输入答案哦 ✍️')
      triggerShake()
      return
    }
    if (Number(raw) === problem.answer) {
      onUnlock()
      return
    }
    // 答错：换一道新题，给点挫败感又不会卡死
    setError('答错啦，已换一道新的 👀')
    setValue('')
    setProblem(makeProblem())
    triggerShake()
    inputRef.current?.focus()
  }

  const hh = String(now.getHours()).padStart(2, '0')
  const mm = String(now.getMinutes()).padStart(2, '0')
  const ss = String(now.getSeconds()).padStart(2, '0')
  const dateStr = `${now.getFullYear()} 年 ${now.getMonth() + 1} 月 ${now.getDate()} 日 星期${
    WEEK[now.getDay()]
  }`

  return createPortal(
    <div className="lock-screen" role="dialog" aria-modal="true" aria-label="锁屏">
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
        <div className="lock-emoji">🔒</div>
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

        <form className={`lock-form${shake ? ' shake' : ''}`} onSubmit={submit}>
          <p className="lock-prompt">
            🔐 解锁：<b>
              {problem.a} {problem.op} {problem.b} = ?
            </b>
          </p>
          <div className="lock-input-row">
            <input
              ref={inputRef}
              type="text"
              inputMode="numeric"
              autoComplete="off"
              maxLength={4}
              placeholder="输入答案"
              value={value}
              onChange={(e) => {
                setValue(e.target.value.replace(/\D/g, ''))
                setError('')
              }}
              aria-label="算术题答案"
            />
            <button type="submit">解锁</button>
          </div>
          <p className="lock-error" role="alert">
            {error || '\u00A0'}
          </p>
        </form>
      </div>
    </div>,
    document.body,
  )
}
