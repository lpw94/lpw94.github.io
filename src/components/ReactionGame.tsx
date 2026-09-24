import { useEffect, useRef, useState } from 'react'

type Phase = 'idle' | 'waiting' | 'go' | 'done'

const BEST_KEY = 'rg-best'

export default function ReactionGame() {
  const [phase, setPhase] = useState<Phase>('idle')
  const [ms, setMs] = useState<number | null>(null)
  const [best, setBest] = useState<number | null>(() => {
    const v = Number(localStorage.getItem(BEST_KEY))
    return Number.isFinite(v) && v > 0 ? v : null
  })
  const startTs = useRef(0)
  const timer = useRef<number | null>(null)

  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current)
    },
    [],
  )

  const start = () => {
    setPhase('waiting')
    const delay = 1200 + Math.random() * 2600
    timer.current = window.setTimeout(() => {
      startTs.current = performance.now()
      setPhase('go')
    }, delay)
  }

  const handleClick = () => {
    if (phase === 'idle' || phase === 'done') {
      start()
      return
    }
    if (phase === 'waiting') {
      // 绿之前就点 = 抢跑
      if (timer.current) clearTimeout(timer.current)
      setMs(null)
      setPhase('done')
      return
    }
    // go
    const elapsed = Math.round(performance.now() - startTs.current)
    setMs(elapsed)
    if (!best || elapsed < best) {
      setBest(elapsed)
      localStorage.setItem(BEST_KEY, String(elapsed))
    }
    setPhase('done')
  }

  const label =
    phase === 'idle'
      ? '开始测试'
      : phase === 'waiting'
        ? '等待变绿…'
        : phase === 'go'
          ? '点！'
          : ms === null
            ? '抢跑了 🙈 再来'
            : `反应 ${ms}ms`

  return (
    <section className="widget-card game-widget" aria-label="反应力小游戏">
      <div className="ww-title">⚡ 反应力测试</div>
      <button type="button" className={`rg-pad rg-${phase}`} onClick={handleClick}>
        {label}
      </button>
      <div className="rg-foot">
        {phase === 'done' && ms !== null && <span>本次 {ms}ms</span>}
        {best !== null && <span>最佳 {best}ms</span>}
      </div>
    </section>
  )
}
