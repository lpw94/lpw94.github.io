import { useCallback, useEffect, useRef, useState } from 'react'

/** 打砖块：挡板接球打砖，3 条命，清空进入下一关（球速渐快） */
const W = 320
const H = 440
const PADDLE_W = 64
const PADDLE_H = 10
const PADDLE_Y = H - 24
const BALL_R = 5
const BRICK_ROWS = 5
const BRICK_COLS = 8
const GAP = 6
const TOP = 52
const SIDE = 14
const BRICK_W = (W - SIDE * 2 - GAP * (BRICK_COLS - 1)) / BRICK_COLS
const BRICK_H = 16
const ROW_COLORS = ['#ef4444', '#f97316', '#facc15', '#4ade80', '#22d3ee']

type Brick = { x: number; y: number; alive: boolean; color: string }
type Status = 'idle' | 'playing' | 'over'

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v))

export default function Breakout({ onGameOver }: { onGameOver: (score: number) => void }) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [status, setStatus] = useState<Status>('idle')
  const [score, setScore] = useState(0)
  const [lives, setLives] = useState(3)
  const [level, setLevel] = useState(1)
  /** 球是否还停在挡板上等待发球 */
  const [stuck, setStuck] = useState(true)

  const paddleX = useRef((W - PADDLE_W) / 2)
  const ball = useRef({ x: W / 2, y: PADDLE_Y - BALL_R - 1, vx: 0, vy: 0 })
  const ballStuck = useRef(true)
  const bricks = useRef<Brick[]>([])
  const livesRef = useRef(3)
  const scoreRef = useRef(0)
  const levelRef = useRef(1)
  const alive = useRef(false)
  const overNotified = useRef(false)

  const buildBricks = useCallback(() => {
    bricks.current = []
    for (let r = 0; r < BRICK_ROWS; r++) {
      for (let c = 0; c < BRICK_COLS; c++) {
        bricks.current.push({
          x: SIDE + c * (BRICK_W + GAP),
          y: TOP + r * (BRICK_H + GAP),
          alive: true,
          color: ROW_COLORS[r % ROW_COLORS.length],
        })
      }
    }
  }, [])

  const ballSpeed = useCallback(() => 240 + (levelRef.current - 1) * 24, [])

  const resetBall = useCallback(() => {
    ballStuck.current = true
    setStuck(true)
    ball.current = { x: paddleX.current + PADDLE_W / 2, y: PADDLE_Y - BALL_R - 1, vx: 0, vy: 0 }
  }, [])

  const launch = useCallback(() => {
    if (!ballStuck.current || !alive.current) return
    const spd = ballSpeed()
    // 随机一个小角度出场，避免每局都一样
    const a = (Math.random() * 0.5 - 0.25) * Math.PI * 0.5
    ball.current.vx = spd * Math.sin(a)
    ball.current.vy = -spd * Math.cos(a)
    ballStuck.current = false
    setStuck(false)
  }, [ballSpeed])

  const gameOver = useCallback(() => {
    alive.current = false
    setStatus('over')
    if (!overNotified.current) {
      overNotified.current = true
      onGameOver(scoreRef.current)
    }
  }, [onGameOver])

  const start = useCallback(() => {
    paddleX.current = (W - PADDLE_W) / 2
    scoreRef.current = 0
    livesRef.current = 3
    levelRef.current = 1
    overNotified.current = false
    setScore(0)
    setLives(3)
    setLevel(1)
    buildBricks()
    alive.current = true
    setStatus('playing')
    resetBall()
  }, [buildBricks, resetBall])

  const draw = useCallback(() => {
    const ctx = canvasRef.current?.getContext('2d')
    if (!ctx) return
    ctx.fillStyle = '#0f172a'
    ctx.fillRect(0, 0, W, H)
    // 砖
    for (const b of bricks.current) {
      if (!b.alive) continue
      ctx.fillStyle = b.color
      ctx.fillRect(b.x, b.y, BRICK_W, BRICK_H)
      ctx.fillStyle = 'rgba(255,255,255,0.28)'
      ctx.fillRect(b.x, b.y, BRICK_W, 3)
    }
    // 挡板
    ctx.fillStyle = '#e2e8f0'
    ctx.beginPath()
    ctx.roundRect(paddleX.current, PADDLE_Y, PADDLE_W, PADDLE_H, 5)
    ctx.fill()
    // 球
    ctx.fillStyle = '#fbbf24'
    ctx.beginPath()
    ctx.arc(ball.current.x, ball.current.y, BALL_R, 0, Math.PI * 2)
    ctx.fill()
  }, [])

  // 主循环：rAF + dt，状态全在 ref 里
  useEffect(() => {
    if (status !== 'playing') return
    let raf = 0
    let last = 0
    const loop = (ts: number) => {
      const dt = last ? Math.min(50, ts - last) / 1000 : 0.016
      last = ts
      const b = ball.current

      if (ballStuck.current) {
        b.x = paddleX.current + PADDLE_W / 2
        b.y = PADDLE_Y - BALL_R - 1
      } else {
        b.x += b.vx * dt
        b.y += b.vy * dt
        // 墙壁
        if (b.x < BALL_R) { b.x = BALL_R; b.vx = Math.abs(b.vx) }
        if (b.x > W - BALL_R) { b.x = W - BALL_R; b.vx = -Math.abs(b.vx) }
        if (b.y < BALL_R) { b.y = BALL_R; b.vy = Math.abs(b.vy) }
        // 挡板：按击中位置改变反射角（边缘角度大）
        if (
          b.vy > 0 &&
          b.y + BALL_R >= PADDLE_Y &&
          b.y - BALL_R <= PADDLE_Y + PADDLE_H &&
          b.x >= paddleX.current - BALL_R &&
          b.x <= paddleX.current + PADDLE_W + BALL_R
        ) {
          const hit = clamp((b.x - (paddleX.current + PADDLE_W / 2)) / (PADDLE_W / 2), -1, 1)
          const a = hit * (Math.PI / 3) // 最大 60°
          const spd = ballSpeed()
          b.vx = spd * Math.sin(a)
          b.vy = -spd * Math.cos(a)
          b.y = PADDLE_Y - BALL_R - 1
        }
        // 砖块（圆 vs 矩形：取最近点判断，按穿透轴反射）
        for (const br of bricks.current) {
          if (!br.alive) continue
          const cx = clamp(b.x, br.x, br.x + BRICK_W)
          const cy = clamp(b.y, br.y, br.y + BRICK_H)
          const dx = b.x - cx
          const dy = b.y - cy
          if (dx * dx + dy * dy > BALL_R * BALL_R) continue
          br.alive = false
          scoreRef.current += 10
          setScore(scoreRef.current)
          if (Math.abs(dx) > Math.abs(dy)) b.vx = -b.vx
          else b.vy = -b.vy
          break // 每帧最多消一块，避免穿透连消
        }
        // 掉球
        if (b.y - BALL_R > H) {
          livesRef.current -= 1
          setLives(livesRef.current)
          if (livesRef.current <= 0) {
            gameOver()
          } else {
            resetBall()
          }
        }
        // 清关
        if (bricks.current.every((br) => !br.alive)) {
          levelRef.current += 1
          setLevel(levelRef.current)
          buildBricks()
          resetBall()
        }
      }
      draw()
      raf = requestAnimationFrame(loop)
    }
    raf = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(raf)
  }, [status, ballSpeed, buildBricks, draw, gameOver, resetBall])

  // 鼠标 / 触摸控制挡板
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const moveTo = (clientX: number) => {
      const rect = canvas.getBoundingClientRect()
      const x = ((clientX - rect.left) / rect.width) * W
      paddleX.current = clamp(x - PADDLE_W / 2, 0, W - PADDLE_W)
    }
    const onMove = (e: MouseEvent) => moveTo(e.clientX)
    const onTouch = (e: TouchEvent) => {
      e.preventDefault()
      moveTo(e.touches[0].clientX)
    }
    canvas.addEventListener('mousemove', onMove)
    canvas.addEventListener('touchmove', onTouch, { passive: false })
    canvas.addEventListener('touchstart', onTouch, { passive: false })
    return () => {
      canvas.removeEventListener('mousemove', onMove)
      canvas.removeEventListener('touchmove', onTouch)
      canvas.removeEventListener('touchstart', onTouch)
    }
  }, [])

  // 键盘：← → 移动挡板、空格发球 / 开始
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement) return
      if (status === 'idle' || status === 'over') {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          start()
        }
        return
      }
      if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
        e.preventDefault()
        const d = e.key === 'ArrowLeft' ? -28 : 28
        paddleX.current = clamp(paddleX.current + d, 0, W - PADDLE_W)
      }
      if (e.key === ' ') {
        e.preventDefault()
        launch()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [status, start, launch])

  // 初始画面
  useEffect(() => {
    buildBricks()
    draw()
  }, [buildBricks, draw])

  return (
    <div className="game-breakout">
      <div className="game-score">
        🧱 {score} 分 · ❤ {lives} · 第 {level} 关
      </div>
      <canvas
        ref={canvasRef}
        width={W}
        height={H}
        className="game-canvas"
        onClick={launch}
      />
      {status !== 'playing' ? (
        <div className="game-overlay">
          <p>
            {status === 'idle' ? '移动鼠标/方向键控制挡板，点击发球' : `游戏结束，得分 ${score}`}
          </p>
          <button type="button" className="btn-primary game-btn" onClick={start}>
            {status === 'idle' ? '开始游戏' : '再来一局'}
          </button>
        </div>
      ) : (
        stuck && <p className="game-help">点击画面或按空格发球</p>
      )}
    </div>
  )
}
