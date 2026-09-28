import { useCallback, useEffect, useRef, useState } from 'react'

/** 极简扫雷：9×9、10 雷。左键/点按翻开，右键/长按插旗；首次点击必安全。胜利按用时上榜 */
const N = 9
const MINES = 10

type Cell = {
  mine: boolean
  open: boolean
  flag: boolean
  adj: number
}
type Status = 'idle' | 'playing' | 'won' | 'lost'

const emptyBoard = (): Cell[] =>
  Array.from({ length: N * N }, () => ({ mine: false, open: false, flag: false, adj: 0 }))

const neighbors = (i: number): number[] => {
  const r = Math.floor(i / N)
  const c = i % N
  const out: number[] = []
  for (let dr = -1; dr <= 1; dr++)
    for (let dc = -1; dc <= 1; dc++) {
      if (!dr && !dc) continue
      const nr = r + dr
      const nc = c + dc
      if (nr >= 0 && nr < N && nc >= 0 && nc < N) out.push(nr * N + nc)
    }
  return out
}

export default function MinesweeperGame({ onGameOver }: { onGameOver: (seconds: number) => void }) {
  const [board, setBoard] = useState<Cell[]>(emptyBoard)
  const [status, setStatus] = useState<Status>('idle')
  const [seconds, setSeconds] = useState(0)
  const minesPlaced = useRef(false)
  const overNotified = useRef(false)
  const pressTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  // 计时
  useEffect(() => {
    if (status !== 'playing') return
    const t = setInterval(() => setSeconds((s) => s + 1), 1000)
    return () => clearInterval(t)
  }, [status])

  const placeMines = (b: Cell[], safeIdx: number) => {
    // 第一次点击后再布雷，且首点及其周围不布雷（保证开局必展开一片）
    const banned = new Set([safeIdx, ...neighbors(safeIdx)])
    let placed = 0
    while (placed < MINES) {
      const i = Math.floor(Math.random() * N * N)
      if (b[i].mine || banned.has(i)) continue
      b[i].mine = true
      placed++
    }
    for (let i = 0; i < N * N; i++) {
      b[i].adj = neighbors(i).filter((j) => b[j].mine).length
    }
  }

  const floodOpen = (b: Cell[], start: number) => {
    const queue = [start]
    while (queue.length) {
      const i = queue.pop()!
      const cell = b[i]
      if (cell.open || cell.flag) continue
      cell.open = true
      if (cell.adj === 0 && !cell.mine) queue.push(...neighbors(i))
    }
  }

  const finish = useCallback(
    (won: boolean, sec: number) => {
      setStatus(won ? 'won' : 'lost')
      if (won && !overNotified.current) {
        overNotified.current = true
        onGameOver(sec)
      }
    },
    [onGameOver],
  )

  const openCell = (idx: number) => {
    if (status === 'won' || status === 'lost') return
    const b = board.map((c) => ({ ...c }))
    const cell = b[idx]
    if (cell.open || cell.flag) return

    if (!minesPlaced.current) {
      placeMines(b, idx)
      minesPlaced.current = true
      setStatus('playing')
    }
    if (b[idx].mine) {
      // 踩雷：全部翻开
      b.forEach((c) => (c.open = true))
      setBoard(b)
      finish(false, seconds)
      return
    }
    floodOpen(b, idx)
    setBoard(b)
    // 胜利判定：非雷格全部翻开
    if (b.every((c) => c.open || c.mine)) finish(true, seconds)
  }

  const toggleFlag = (idx: number) => {
    if (status === 'won' || status === 'lost') return
    const b = board.map((c) => ({ ...c }))
    if (b[idx].open) return
    b[idx].flag = !b[idx].flag
    setBoard(b)
  }

  const reset = () => {
    setBoard(emptyBoard())
    setStatus('idle')
    setSeconds(0)
    minesPlaced.current = false
    overNotified.current = false
  }

  // 触屏：长按插旗（>400ms），短按翻开
  const onTouchStart = (idx: number) => {
    pressTimer.current = setTimeout(() => {
      toggleFlag(idx)
      pressTimer.current = null
    }, 400)
  }
  const onTouchEnd = (idx: number) => {
    if (pressTimer.current) {
      clearTimeout(pressTimer.current)
      pressTimer.current = null
      openCell(idx)
    }
  }

  const flags = board.filter((c) => c.flag).length

  return (
    <div className="game-minesweeper">
      <div className="game-score">
        💣 {MINES - flags}　⏱️ {seconds}s
      </div>
      <div className="ms-board" role="grid" aria-label="扫雷棋盘">
        {board.map((c, i) => (
          <button
            key={i}
            type="button"
            role="gridcell"
            className={`ms-cell${c.open ? ' open' : ''}${c.open && c.mine ? ' mine' : ''}`}
            onClick={() => openCell(i)}
            onContextMenu={(e) => {
              e.preventDefault()
              toggleFlag(i)
            }}
            onTouchStart={() => onTouchStart(i)}
            onTouchEnd={(e) => {
              e.preventDefault()
              onTouchEnd(i)
            }}
            aria-label={c.open ? undefined : `格子 ${i + 1}`}
          >
            {c.open ? (c.mine ? '💥' : c.adj > 0 ? <span className={`ms-n${c.adj}`}>{c.adj}</span> : '') : c.flag ? '🚩' : ''}
          </button>
        ))}
      </div>
      {(status === 'won' || status === 'lost') && (
        <div className="game-overlay">
          <p>{status === 'won' ? `🎉 通关！用时 ${seconds} 秒` : '💥 踩雷了'}</p>
          <button type="button" className="btn-primary game-btn" onClick={reset}>
            再来一局
          </button>
        </div>
      )}
      <p className="game-help">点按翻开 · 右键/长按插旗</p>
    </div>
  )
}
