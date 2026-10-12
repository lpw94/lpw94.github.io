import { useCallback, useEffect, useRef, useState } from 'react'

/** 俄罗斯方块：10×20 标准棋盘，七种方块，消行计分，等级越高下落越快 */
const COLS = 10
const ROWS = 20
const CELL = 22
const W = COLS * CELL
const H = ROWS * CELL

type PieceType = 'I' | 'O' | 'T' | 'S' | 'Z' | 'J' | 'L'
type Matrix = number[][]
type Piece = { type: PieceType; m: Matrix; x: number; y: number }
type Status = 'idle' | 'playing' | 'paused' | 'over'

const SHAPES: Record<PieceType, Matrix> = {
  I: [[0, 0, 0, 0], [1, 1, 1, 1], [0, 0, 0, 0], [0, 0, 0, 0]],
  O: [[1, 1], [1, 1]],
  T: [[0, 1, 0], [1, 1, 1], [0, 0, 0]],
  S: [[0, 1, 1], [1, 1, 0], [0, 0, 0]],
  Z: [[1, 1, 0], [0, 1, 1], [0, 0, 0]],
  J: [[1, 0, 0], [1, 1, 1], [0, 0, 0]],
  L: [[0, 0, 1], [1, 1, 1], [0, 0, 0]],
}
const COLORS: Record<PieceType, string> = {
  I: '#22d3ee',
  O: '#facc15',
  T: '#a78bfa',
  S: '#4ade80',
  Z: '#f87171',
  J: '#60a5fa',
  L: '#fb923c',
}
const TYPES = Object.keys(SHAPES) as PieceType[]
// 消 1/2/3/4 行的基础分（再乘等级）
const LINE_SCORE = [0, 100, 300, 500, 800]

const rotate = (m: Matrix): Matrix => m[0].map((_, i) => m.map((row) => row[i]).reverse())

export default function Tetris({ onGameOver }: { onGameOver: (score: number) => void }) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const nextRef = useRef<HTMLCanvasElement>(null)
  const [status, setStatus] = useState<Status>('idle')
  const [score, setScore] = useState(0)
  const [lines, setLines] = useState(0)
  const [level, setLevel] = useState(1)

  // 棋盘存方块类型（用于取色），null = 空
  const board = useRef<(PieceType | null)[][]>(
    Array.from({ length: ROWS }, () => Array<PieceType | null>(COLS).fill(null)),
  )
  const piece = useRef<Piece | null>(null)
  const next = useRef<PieceType>('T')
  const alive = useRef(false)
  const scoreRef = useRef(0)
  const linesRef = useRef(0)
  const overNotified = useRef(false)

  const collide = useCallback((m: Matrix, px: number, py: number) => {
    for (let r = 0; r < m.length; r++) {
      for (let c = 0; c < m[r].length; c++) {
        if (!m[r][c]) continue
        const x = px + c
        const y = py + r
        if (x < 0 || x >= COLS || y >= ROWS) return true
        if (y >= 0 && board.current[y][x]) return true
      }
    }
    return false
  }, [])

  const spawn = useCallback(
    (type?: PieceType) => {
      const t = type ?? next.current
      next.current = TYPES[Math.floor(Math.random() * TYPES.length)]
      const m = SHAPES[t].map((row) => [...row])
      const p: Piece = { type: t, m, x: Math.floor((COLS - m[0].length) / 2), y: t === 'I' ? -1 : 0 }
      piece.current = p
      // 出生点就被占 → 游戏结束
      if (collide(p.m, p.x, p.y)) {
        alive.current = false
        setStatus('over')
        if (!overNotified.current) {
          overNotified.current = true
          onGameOver(scoreRef.current)
        }
      }
    },
    [collide, onGameOver],
  )

  const lockPiece = useCallback(() => {
    const p = piece.current
    if (!p) return
    for (let r = 0; r < p.m.length; r++) {
      for (let c = 0; c < p.m[r].length; c++) {
        if (!p.m[r][c]) continue
        const y = p.y + r
        if (y >= 0) board.current[y][p.x + c] = p.type
      }
    }
    // 消行
    let cleared = 0
    for (let r = ROWS - 1; r >= 0; r--) {
      if (board.current[r].every((cell) => cell)) {
        board.current.splice(r, 1)
        board.current.unshift(Array<PieceType | null>(COLS).fill(null))
        cleared++
        r++ // 重新检查同一行（下移后补上的新行）
      }
    }
    if (cleared > 0) {
      const lv = Math.floor(linesRef.current / 10) + 1
      scoreRef.current += LINE_SCORE[cleared] * lv
      linesRef.current += cleared
      setScore(scoreRef.current)
      setLines(linesRef.current)
      setLevel(Math.floor(linesRef.current / 10) + 1)
    }
    spawn()
  }, [spawn])

  const move = useCallback(
    (dx: number) => {
      const p = piece.current
      if (!p || !alive.current) return
      if (!collide(p.m, p.x + dx, p.y)) p.x += dx
    },
    [collide],
  )

  const rotatePiece = useCallback(() => {
    const p = piece.current
    if (!p || !alive.current || p.type === 'O') return
    const m = rotate(p.m)
    // 简单墙踢：原地→左1→右1→左2→右2
    for (const k of [0, -1, 1, -2, 2]) {
      if (!collide(m, p.x + k, p.y)) {
        p.m = m
        p.x += k
        return
      }
    }
  }, [collide])

  const stepDown = useCallback(
    (soft: boolean) => {
      const p = piece.current
      if (!p || !alive.current) return
      if (!collide(p.m, p.x, p.y + 1)) {
        p.y++
        if (soft) {
          scoreRef.current += 1
          setScore(scoreRef.current)
        }
      } else {
        lockPiece()
      }
    },
    [collide, lockPiece],
  )

  const hardDrop = useCallback(() => {
    const p = piece.current
    if (!p || !alive.current) return
    let cells = 0
    while (!collide(p.m, p.x, p.y + 1)) {
      p.y++
      cells++
    }
    scoreRef.current += cells * 2
    setScore(scoreRef.current)
    lockPiece()
  }, [collide, lockPiece])

  const drawCell = useCallback((ctx: CanvasRenderingContext2D, x: number, y: number, color: string, alpha = 1) => {
    ctx.globalAlpha = alpha
    ctx.fillStyle = color
    ctx.fillRect(x * CELL + 1, y * CELL + 1, CELL - 2, CELL - 2)
    // 顶部高光，略有立体感
    ctx.fillStyle = 'rgba(255,255,255,0.25)'
    ctx.fillRect(x * CELL + 1, y * CELL + 1, CELL - 2, 4)
    ctx.globalAlpha = 1
  }, [])

  const draw = useCallback(() => {
    const ctx = canvasRef.current?.getContext('2d')
    if (!ctx) return
    ctx.fillStyle = '#0f172a'
    ctx.fillRect(0, 0, W, H)
    // 网格线
    ctx.strokeStyle = 'rgba(148,163,184,0.08)'
    for (let x = 1; x < COLS; x++) {
      ctx.beginPath()
      ctx.moveTo(x * CELL, 0)
      ctx.lineTo(x * CELL, H)
      ctx.stroke()
    }
    for (let y = 1; y < ROWS; y++) {
      ctx.beginPath()
      ctx.moveTo(0, y * CELL)
      ctx.lineTo(W, y * CELL)
      ctx.stroke()
    }
    // 已锁定的方块
    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        const t = board.current[r][c]
        if (t) drawCell(ctx, c, r, COLORS[t])
      }
    }
    // 当前方块 + 落点幽灵
    const p = piece.current
    if (p) {
      let ghostY = p.y
      while (!collide(p.m, p.x, ghostY + 1)) ghostY++
      if (ghostY !== p.y) {
        for (let r = 0; r < p.m.length; r++) {
          for (let c = 0; c < p.m[r].length; c++) {
            if (p.m[r][c] && ghostY + r >= 0) drawCell(ctx, p.x + c, ghostY + r, COLORS[p.type], 0.18)
          }
        }
      }
      for (let r = 0; r < p.m.length; r++) {
        for (let c = 0; c < p.m[r].length; c++) {
          if (p.m[r][c] && p.y + r >= 0) drawCell(ctx, p.x + c, p.y + r, COLORS[p.type])
        }
      }
    }
  }, [collide, drawCell])

  const drawNext = useCallback(() => {
    const cv = nextRef.current
    if (!cv) return
    const ctx = cv.getContext('2d')
    if (!ctx) return
    const nw = cv.width
    const nh = cv.height
    ctx.fillStyle = '#0f172a'
    ctx.fillRect(0, 0, nw, nh)
    const m = SHAPES[next.current]
    // 裁剪到方块实际占位，居中画
    let minR = 9, maxR = -1, minC = 9, maxC = -1
    for (let r = 0; r < m.length; r++) {
      for (let c = 0; c < m[r].length; c++) {
        if (m[r][c]) {
          minR = Math.min(minR, r); maxR = Math.max(maxR, r)
          minC = Math.min(minC, c); maxC = Math.max(maxC, c)
        }
      }
    }
    const bw = (maxC - minC + 1) * 16
    const bh = (maxR - minR + 1) * 16
    const ox = (nw - bw) / 2
    const oy = (nh - bh) / 2
    for (let r = minR; r <= maxR; r++) {
      for (let c = minC; c <= maxC; c++) {
        if (!m[r][c]) continue
        ctx.fillStyle = COLORS[next.current]
        ctx.fillRect(ox + (c - minC) * 16 + 1, oy + (r - minR) * 16 + 1, 14, 14)
      }
    }
  }, [])

  const start = useCallback(() => {
    board.current = Array.from({ length: ROWS }, () => Array<PieceType | null>(COLS).fill(null))
    scoreRef.current = 0
    linesRef.current = 0
    overNotified.current = false
    setScore(0)
    setLines(0)
    setLevel(1)
    next.current = TYPES[Math.floor(Math.random() * TYPES.length)]
    alive.current = true
    setStatus('playing')
    spawn()
    draw()
    drawNext()
  }, [spawn, draw, drawNext])

  // 键盘控制（输入框聚焦时不抢按键）
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement) return
      if (status === 'idle' || status === 'over') {
        if (e.key === 'Enter') start()
        return
      }
      if (e.key === 'p' || e.key === 'P') {
        setStatus((s) => (s === 'playing' ? 'paused' : 'playing'))
        return
      }
      if (status !== 'playing') return
      switch (e.key) {
        case 'ArrowLeft': e.preventDefault(); move(-1); break
        case 'ArrowRight': e.preventDefault(); move(1); break
        case 'ArrowDown': e.preventDefault(); stepDown(true); break
        case 'ArrowUp': e.preventDefault(); rotatePiece(); break
        case ' ': e.preventDefault(); hardDrop(); break
      }
      draw()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [status, start, move, stepDown, rotatePiece, hardDrop, draw])

  // 重力循环：等级越高间隔越短
  useEffect(() => {
    if (status !== 'playing') return
    const interval = Math.max(90, 620 - (level - 1) * 55)
    const t = setInterval(() => {
      stepDown(false)
      draw()
      drawNext()
    }, interval)
    return () => clearInterval(t)
  }, [status, level, stepDown, draw, drawNext])

  // 初始画面
  useEffect(() => {
    draw()
    drawNext()
  }, [draw, drawNext])

  return (
    <div className="game-tetris">
      <div className="game-score">
        🧱 {score} 分 · 消行 {lines} · 等级 {level}
      </div>
      <div className="game-tetris-main">
        <canvas ref={canvasRef} width={W} height={H} className="game-canvas" />
        <div className="game-tetris-side">
          <div className="game-tetris-next-label">下一个</div>
          <canvas ref={nextRef} width={72} height={56} className="game-canvas game-tetris-next" />
          <p className="game-help">← → 移动<br />↑ 旋转<br />↓ 加速下落<br />空格 直接落底<br />P 暂停</p>
        </div>
      </div>
      {status !== 'playing' && (
        <div className="game-overlay">
          <p>
            {status === 'idle'
              ? '方向键开始，或点击下方按钮'
              : status === 'paused'
                ? '已暂停，按 P 继续'
                : `游戏结束，得分 ${score}`}
          </p>
          <button type="button" className="btn-primary game-btn" onClick={status === 'paused' ? () => setStatus('playing') : start}>
            {status === 'idle' ? '开始游戏' : status === 'paused' ? '继续' : '再来一局'}
          </button>
        </div>
      )}
    </div>
  )
}
