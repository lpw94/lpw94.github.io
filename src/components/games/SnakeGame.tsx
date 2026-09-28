import { useCallback, useEffect, useRef, useState } from 'react'

/** 极简贪吃蛇：15×15 格子，方向键 / 屏幕按钮控制，吃到食物 +1 分 */
const GRID = 15
const CELL = 16
const SIZE = GRID * CELL
const TICK = 130

type Pt = { x: number; y: number }
type Status = 'idle' | 'playing' | 'over'

const eq = (a: Pt, b: Pt) => a.x === b.x && a.y === b.y

export default function SnakeGame({ onGameOver }: { onGameOver: (score: number) => void }) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [status, setStatus] = useState<Status>('idle')
  const [score, setScore] = useState(0)

  // 游戏状态放 ref：loop 里直接读写，不触发重渲染
  const snake = useRef<Pt[]>([{ x: 7, y: 7 }])
  const dir = useRef<Pt>({ x: 1, y: 0 })
  const pendingDir = useRef<Pt>({ x: 1, y: 0 })
  const food = useRef<Pt>({ x: 11, y: 7 })
  const alive = useRef(false)
  const scoreRef = useRef(0)
  const overNotified = useRef(false)

  const placeFood = () => {
    // 随机空格放食物（避开蛇身）
    for (;;) {
      const p = { x: Math.floor(Math.random() * GRID), y: Math.floor(Math.random() * GRID) }
      if (!snake.current.some((s) => eq(s, p))) {
        food.current = p
        return
      }
    }
  }

  const draw = useCallback(() => {
    const ctx = canvasRef.current?.getContext('2d')
    if (!ctx) return
    ctx.fillStyle = '#0f172a'
    ctx.fillRect(0, 0, SIZE, SIZE)
    // 食物
    ctx.fillStyle = '#ef4444'
    ctx.beginPath()
    ctx.arc(food.current.x * CELL + CELL / 2, food.current.y * CELL + CELL / 2, CELL / 2 - 2, 0, Math.PI * 2)
    ctx.fill()
    // 蛇（头亮尾暗）
    snake.current.forEach((s, i) => {
      ctx.fillStyle = i === 0 ? '#4ade80' : '#22c55e'
      ctx.fillRect(s.x * CELL + 1, s.y * CELL + 1, CELL - 2, CELL - 2)
    })
  }, [])

  const gameOver = useCallback(() => {
    alive.current = false
    setStatus('over')
    if (!overNotified.current) {
      overNotified.current = true
      onGameOver(scoreRef.current)
    }
  }, [onGameOver])

  const tick = useCallback(() => {
    if (!alive.current) return
    // 禁止 180° 掉头
    const d = pendingDir.current
    if (!(d.x === -dir.current.x && d.y === -dir.current.y)) dir.current = d

    const head = { x: snake.current[0].x + dir.current.x, y: snake.current[0].y + dir.current.y }
    // 撞墙 / 撞自己
    if (
      head.x < 0 || head.x >= GRID || head.y < 0 || head.y >= GRID ||
      snake.current.some((s) => eq(s, head))
    ) {
      gameOver()
      return
    }
    snake.current.unshift(head)
    if (eq(head, food.current)) {
      scoreRef.current += 1
      setScore(scoreRef.current)
      placeFood()
    } else {
      snake.current.pop()
    }
    draw()
  }, [draw, gameOver])

  const start = useCallback(() => {
    snake.current = [{ x: 7, y: 7 }]
    dir.current = { x: 1, y: 0 }
    pendingDir.current = { x: 1, y: 0 }
    scoreRef.current = 0
    overNotified.current = false
    setScore(0)
    placeFood()
    alive.current = true
    setStatus('playing')
    draw()
  }, [draw])

  const setDirection = useCallback((x: number, y: number) => {
    pendingDir.current = { x, y }
  }, [])

  // 方向键控制（输入框聚焦时不抢按键）
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement) return
      const map: Record<string, Pt> = {
        ArrowUp: { x: 0, y: -1 },
        ArrowDown: { x: 0, y: 1 },
        ArrowLeft: { x: -1, y: 0 },
        ArrowRight: { x: 1, y: 0 },
      }
      const d = map[e.key]
      if (!d) return
      e.preventDefault()
      if (status === 'idle') start()
      setDirection(d.x, d.y)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [status, start, setDirection])

  // 游戏主循环
  useEffect(() => {
    if (status !== 'playing') return
    const t = setInterval(tick, TICK)
    return () => clearInterval(t)
  }, [status, tick])

  // 初始画面
  useEffect(() => {
    draw()
  }, [draw])

  return (
    <div className="game-snake">
      <div className="game-score">🍎 {score}</div>
      <canvas ref={canvasRef} width={SIZE} height={SIZE} className="game-canvas" />
      {status !== 'playing' && (
        <div className="game-overlay">
          <p>{status === 'idle' ? '方向键开始，或点击下方按钮' : `游戏结束，得分 ${score}`}</p>
          <button type="button" className="btn-primary game-btn" onClick={start}>
            {status === 'idle' ? '开始游戏' : '再来一局'}
          </button>
        </div>
      )}
      {/* 触屏方向盘 */}
      <div className="game-pad" aria-label="方向控制">
        <button type="button" onClick={() => setDirection(0, -1)} aria-label="上">▲</button>
        <div>
          <button type="button" onClick={() => setDirection(-1, 0)} aria-label="左">◀</button>
          <button type="button" onClick={() => setDirection(0, 1)} aria-label="下">▼</button>
          <button type="button" onClick={() => setDirection(1, 0)} aria-label="右">▶</button>
        </div>
      </div>
    </div>
  )
}
