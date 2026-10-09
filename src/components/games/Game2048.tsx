import { useCallback, useEffect, useRef, useState } from 'react'

/** 2048：4×4，方向键 / 屏幕按钮滑动合并，带滑动 + 合并/出现动画，无法移动时结算分数上榜 */
const SIZE = 4
const CELL = 56
const GAP = 6
const STEP = CELL + GAP // 单元格 + 间距，用于平移定位

type Tile = {
  id: number
  value: number
  r: number
  c: number
  isNew?: boolean
  merged?: boolean
  consumed?: boolean // 合并时被吃掉的块：滑入目标后移除
}

let NEXT_ID = 1

const initTiles = (): Tile[] => {
  const tiles: Tile[] = []
  const spawn = () => {
    const empty: [number, number][] = []
    for (let r = 0; r < SIZE; r++)
      for (let c = 0; c < SIZE; c++)
        if (!tiles.some((t) => t.r === r && t.c === c)) empty.push([r, c])
    const [r, c] = empty[Math.floor(Math.random() * empty.length)]
    tiles.push({ id: NEXT_ID++, value: Math.random() < 0.9 ? 2 : 4, r, c, isNew: true })
  }
  spawn()
  spawn()
  return tiles
}

type Dir = 'left' | 'right' | 'up' | 'down'

// 每条线的格子坐标，按“移动方向朝 index 0”的顺序排列
const lineCells = (dir: Dir): { r: number; c: number }[][] => {
  const lines: { r: number; c: number }[][] = []
  if (dir === 'left' || dir === 'right') {
    for (let r = 0; r < SIZE; r++) {
      const cells = []
      for (let c = 0; c < SIZE; c++) cells.push({ r, c })
      if (dir === 'right') cells.reverse()
      lines.push(cells)
    }
  } else {
    for (let c = 0; c < SIZE; c++) {
      const cells = []
      for (let r = 0; r < SIZE; r++) cells.push({ r, c })
      if (dir === 'down') cells.reverse()
      lines.push(cells)
    }
  }
  return lines
}

const moveTiles = (
  tiles: Tile[],
  dir: Dir,
): { tiles: Tile[]; gained: number; moved: boolean } => {
  const grid: (Tile | null)[][] = Array.from({ length: SIZE }, () => Array(SIZE).fill(null))
  tiles.forEach((t) => (grid[t.r][t.c] = t))

  let gained = 0
  let moved = false
  const result: Tile[] = []

  for (const cells of lineCells(dir)) {
    const src = cells.map(({ r, c }) => grid[r][c]).filter(Boolean) as Tile[]
    let k = 0
    for (let i = 0; i < src.length; i++) {
      const target = cells[k]
      if (i + 1 < src.length && src[i].value === src[i + 1].value) {
        // 合并：左/上者为存活块（翻倍并 bump），右/下者为被吃块（滑入目标后移除）
        const survivor = src[i]
        const consumed = src[i + 1]
        const nv = survivor.value * 2
        if (survivor.r !== target.r || survivor.c !== target.c || nv !== survivor.value) moved = true
        result.push({ ...survivor, value: nv, r: target.r, c: target.c, merged: true, isNew: false })
        result.push({ ...consumed, r: target.r, c: target.c, consumed: true })
        gained += nv
        i++
      } else {
        const s = src[i]
        if (s.r !== target.r || s.c !== target.c) moved = true
        result.push({ ...s, r: target.r, c: target.c, merged: false, isNew: false })
      }
      k++
    }
  }
  return { tiles: result, gained, moved }
}

const hasMoves = (tiles: Tile[]): boolean => {
  const grid: (number | null)[][] = Array.from({ length: SIZE }, () => Array(SIZE).fill(null))
  tiles.forEach((t) => (grid[t.r][t.c] = t.value))
  for (let r = 0; r < SIZE; r++)
    for (let c = 0; c < SIZE; c++) {
      if (grid[r][c] === null) return true
      if (c < SIZE - 1 && grid[r][c] === grid[r][c + 1]) return true
      if (r < SIZE - 1 && grid[r][c] === grid[r + 1][c]) return true
    }
  return false
}

const KEY_DIR: Record<string, Dir> = {
  ArrowLeft: 'left',
  ArrowRight: 'right',
  ArrowUp: 'up',
  ArrowDown: 'down',
}

export default function Game2048({ onGameOver }: { onGameOver: (score: number) => void }) {
  const [tiles, setTiles] = useState<Tile[]>(initTiles)
  const [score, setScore] = useState(0)
  const [over, setOver] = useState(false)
  const overNotified = useRef(false)

  const doMove = useCallback(
    (dir: Dir) => {
      if (over) return
      const active = tiles.filter((t) => !t.consumed)
      const { tiles: next, gained, moved } = moveTiles(active, dir)
      if (!moved) return
      // 生成新块
      const empty: [number, number][] = []
      for (let r = 0; r < SIZE; r++)
        for (let c = 0; c < SIZE; c++)
          if (!next.some((t) => t.r === r && t.c === c)) empty.push([r, c])
      if (empty.length) {
        const [r, c] = empty[Math.floor(Math.random() * empty.length)]
        next.push({ id: NEXT_ID++, value: Math.random() < 0.9 ? 2 : 4, r, c, isNew: true })
      }
      const newScore = score + gained
      setTiles(next)
      setScore(newScore)
      if (!hasMoves(next)) {
        setOver(true)
        if (!overNotified.current) {
          overNotified.current = true
          onGameOver(newScore)
        }
      }
    },
    [tiles, score, over, onGameOver],
  )

  // 合并后清除“被吃”块（滑动到位后移除），避免它一直叠在存活块上
  useEffect(() => {
    if (tiles.some((t) => t.consumed)) {
      const id = setTimeout(() => setTiles((b) => b.filter((t) => !t.consumed)), 130)
      return () => clearTimeout(id)
    }
  }, [tiles])

  const reset = () => {
    setTiles(initTiles())
    setScore(0)
    setOver(false)
    overNotified.current = false
  }

  // 方向键控制（输入框聚焦时不抢按键）
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement) return
      const dir = KEY_DIR[e.key]
      if (!dir) return
      e.preventDefault()
      doMove(dir)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [doMove])

  return (
    <div className="game-2048">
      <div className="game-score">🏆 {score}</div>
      <div className="g2-board" aria-label="2048 棋盘">
        <div className="g2-bg-grid">
          {Array.from({ length: 16 }).map((_, i) => (
            <div key={i} className="g2-bg" />
          ))}
        </div>
        <div className="g2-tiles">
          {tiles.map((t) => (
            <div
              key={t.id}
              className="g2-tile"
              style={{ transform: `translate(${t.c * STEP}px, ${t.r * STEP}px)` }}
            >
              <div
                className={`g2-inner g2-v${t.value}${t.isNew ? ' g2-new' : ''}${t.merged ? ' g2-merged' : ''}`}
              >
                {t.value}
              </div>
            </div>
          ))}
        </div>
      </div>
      {over && (
        <div className="game-overlay">
          <p>游戏结束，得分 {score}</p>
          <button type="button" className="btn-primary game-btn" onClick={reset}>
            再来一局
          </button>
        </div>
      )}
      {/* 触屏方向盘 */}
      <div className="game-pad" aria-label="方向控制">
        <button type="button" onClick={() => doMove('up')} aria-label="上">
          ▲
        </button>
        <div>
          <button type="button" onClick={() => doMove('left')} aria-label="左">
            ◀
          </button>
          <button type="button" onClick={() => doMove('down')} aria-label="下">
            ▼
          </button>
          <button type="button" onClick={() => doMove('right')} aria-label="右">
            ▶
          </button>
        </div>
      </div>
    </div>
  )
}
