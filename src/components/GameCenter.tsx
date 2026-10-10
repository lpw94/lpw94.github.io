import { useCallback, useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { GAMES, fetchLeaderboard, playerNameStore, submitScore, type GameDef, type ScoreRow } from '../lib/games'
import SnakeGame from './games/SnakeGame'
import MinesweeperGame from './games/MinesweeperGame'
import Game2048 from './games/Game2048'
import PlaneWar from './games/PlaneWar'

/**
 * 游戏中心（侧边栏入口）：贪吃蛇 / 扫雷 / 2048 三个极简小游戏，
 * 点击图标弹窗开玩；结束后可把分数提交到 Supabase 排行榜（所有人可见）。
 */
export default function GameCenter() {
  const [active, setActive] = useState<GameDef | null>(null)
  /** 待提交的分数（游戏刚结束）；null = 无待提交 */
  const [pendingScore, setPendingScore] = useState<number | null>(null)
  const [name, setName] = useState(playerNameStore.get)
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [board, setBoard] = useState<ScoreRow[] | null>(null)
  /** 用于强制重开一局（重挂载游戏组件） */
  const [session, setSession] = useState(0)

  const openGame = (g: GameDef) => {
    setActive(g)
    setPendingScore(null)
    setSubmitted(false)
    setSession((s) => s + 1)
  }

  const refreshBoard = useCallback(async (g: GameDef) => {
    setBoard(await fetchLeaderboard(g.id, g.asc))
  }, [])

  // 弹窗打开期间：锁背景滚动 + Esc 关闭 + 拉排行榜
  useEffect(() => {
    if (!active) return
    void refreshBoard(active)
    const prevOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setActive(null)
    }
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.body.style.overflow = prevOverflow
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [active, refreshBoard])

  const handleGameOver = useCallback((score: number) => {
    setPendingScore(score)
    setSubmitted(false)
  }, [])

  const handleSubmit = async () => {
    if (!active || pendingScore === null || submitting) return
    setSubmitting(true)
    const ok = await submitScore(active.id, name, pendingScore)
    setSubmitting(false)
    if (ok) {
      playerNameStore.set(name.trim().slice(0, 12))
      setSubmitted(true)
      void refreshBoard(active)
    }
  }

  const close = () => setActive(null)

  return (
    <section className="widget-card game-center" aria-label="小游戏">
      <div className="ww-title">🎮 小游戏</div>
      <div className="gc-entries">
        {GAMES.map((g) => (
          <button
            key={g.id}
            type="button"
            className="gc-entry"
            onClick={() => openGame(g)}
            aria-label={`玩${g.name}`}
          >
            <span className="gc-entry-icon">{g.icon}</span>
            <span className="gc-entry-name">{g.name}</span>
          </button>
        ))}
      </div>
      <p className="gc-tip">摸鱼时刻 · 上榜留名 🏅</p>

      {active &&
        createPortal(
          <div
            className="modal-backdrop"
            onMouseDown={(e) => {
              if (e.target === e.currentTarget) close()
            }}
          >
            <div
              className="modal game-modal"
              role="dialog"
              aria-modal="true"
              aria-labelledby="game-modal-title"
            >
              <div className="modal-head">
                <h2 id="game-modal-title">
                  {active.icon} {active.name}
                </h2>
                <button type="button" className="modal-close" onClick={close} aria-label="关闭">
                  ×
                </button>
              </div>

              <div className="game-stage" key={session}>
                {active.id === 'snake' && <SnakeGame onGameOver={handleGameOver} />}
                {active.id === 'minesweeper' && <MinesweeperGame onGameOver={handleGameOver} />}
                {active.id === 'g2048' && <Game2048 onGameOver={handleGameOver} />}
                {active.id === 'plane' && <PlaneWar onGameOver={handleGameOver} />}
              </div>

              {/* 分数提交 */}
              {pendingScore !== null && !submitted && (
                <div className="game-submit">
                  <span className="game-submit-score">
                    本局{active.scoreLabel}：<strong>{pendingScore}</strong>
                  </span>
                  <input
                    type="text"
                    value={name}
                    maxLength={12}
                    placeholder="留个昵称上榜"
                    onChange={(e) => setName(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') void handleSubmit()
                    }}
                  />
                  <button
                    type="button"
                    className="btn-primary game-btn"
                    disabled={submitting}
                    onClick={() => void handleSubmit()}
                  >
                    {submitting ? '提交中…' : '上榜'}
                  </button>
                </div>
              )}
              {submitted && <p className="game-submitted">✅ 已上榜！</p>}

              {/* 排行榜 */}
              <div className="game-board">
                <div className="game-board-title">🏅 排行榜 TOP 10</div>
                {board === null ? (
                  <p className="game-board-empty muted">排行榜暂未开放（需先在 Supabase 建 game_scores 表）</p>
                ) : board.length === 0 ? (
                  <p className="game-board-empty muted">虚位以待，来当第一个上榜的人！</p>
                ) : (
                  <ol className="game-board-list">
                    {board.map((r, i) => (
                      <li key={r.id}>
                        <span className={`gb-rank gb-rank${i + 1}`}>{i + 1}</span>
                        <span className="gb-player">{r.player}</span>
                        <span className="gb-score">
                          {r.score}
                          {active.id === 'minesweeper' ? 's' : ''}
                        </span>
                      </li>
                    ))}
                  </ol>
                )}
              </div>
            </div>
          </div>,
          document.body,
        )}
    </section>
  )
}
