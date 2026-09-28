import { useCallback, useEffect, useRef, useState } from 'react'

/** 极简 2048：4×4，方向键 / 屏幕按钮滑动合并，无法移动时结算分数上榜 */
type Board = number[][]

const clone = (b: Board): Board => b.map((r) => [...r])

const addRandom = (b: Board) => {
  const empty: [number, number][] = []
  b.forEach((row, r) => row.forEach((v, c) => v === 0 && empty.push([r, c])))
  if (!empty.length) return
  const [r, c] = empty[Math.floor(Math.random() * empty.length)]
  b[r][c] = Math.random() < 0.9 ? 2 : 4
}

const initBoard = (): Board => {
  const b: Board = Array.from({ length: 4 }, () => [0, 0, 0, 0])
  addRandom(b)
  addRandom(b)
  return b
}

/** 一行向左滑动合并，返回新行与本次得分 */
const slideRow = (row: number[]): { row: number[]; gained: number } => {
  const arr = row.filter((v) => v > 0)
  let gained = 0
  for (let i = 0; i < arr.length - 1; i++) {
    if (arr[i] === arr[i + 1]) {
      arr[i] *= 2
      gained += arr[i]
      arr.splice(i + 1, 1)
    }
  }
  while (arr.length < 4) arr.push(0)
  return { row: arr, gained }
}

const transpose = (b: Board): Board => b[0].map((_, c) => b.map((r) => r[c]))
const reverseRows = (b: Board): Board => b.map((r) => [...r].reverse())

type Dir = 'left' | 'right' | 'up' | 'down'

const move = (b: Board, dir: Dir): { board: Board; gained: number; moved: boolean } => {
  let work = clone(b)
  if (dir === 'up' || dir === 'down') work = transpose(work)
  if (dir === 'right' || dir === 'down') work = reverseRows(work)

  let gained = 0
  const next = work.map((row) => {
    const r = slideRow(row)
    gained += r.gained
    return r.row
  })

  let out = next
  if (dir === 'right' || dir === 'down') out = reverseRows(out)
  if (dir === 'up' || dir === 'down') out = transpose(out)

  const moved = JSON.stringify(out) !== JSON.stringify(b)
  return { board: out, gained, moved }
}

const hasMoves = (b: Board): boolean => {
  for (let r = 0; r < 4; r++)
    for (let c = 0; c < 4; c++) {
      if (b[r][c] === 0) return true
      if (c < 3 && b[r][c] === b[r][c + 1]) return true
      if (r < 3 && b[r][c] === b[r + 1][c]) return true
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
  const [board, setBoard] = useState<Board>(initBoard)
  const [score, setScore] = useState(0)
  const [over, setOver] = useState(false)
  const overNotified = useRef(false)

  const doMove = useCallback(
    (dir: Dir) => {
      if (over) return
      const { board: next, gained, moved } = move(board, dir)
      if (!moved) return
      addRandom(next)
      const newScore = score + gained
      setBoard(next)
      setScore(newScore)
      if (!hasMoves(next)) {
        setOver(true)
        if (!overNotified.current) {
          overNotified.current = true
          onGameOver(newScore)
        }
      }
    },
    [board, score, over, onGameOver],
  )

  const reset = () => {
    setBoard(initBoard())
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
        {board.flat().map((v, i) => (
          <div key={i} className={`g2-cell${v ? ` g2-v${v}` : ''}`}>
            {v || ''}
          </div>
        ))}
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
        <button type="button" onClick={() => doMove('up')} aria-label="上">▲</button>
        <div>
          <button type="button" onClick={() => doMove('left')} aria-label="左">◀</button>
          <button type="button" onClick={() => doMove('down')} aria-label="下">▼</button>
          <button type="button" onClick={() => doMove('right')} aria-label="右">▶</button>
        </div>
      </div>
    </div>
  )
}
