import { useCallback, useEffect, useRef, useState } from 'react'
import type { PointerEvent as ReactPointerEvent } from 'react'

/** 飞机大战：移动鼠标 / 触摸或方向键控制飞机，自动射击；击落敌机得分，3 条命 */
const W = 360
const H = 480
const PLAYER_W = 34
const PLAYER_H = 30
const BULLET_W = 4
const BULLET_H = 12
const ENEMY_W = 28
const ENEMY_H = 24

type Status = 'idle' | 'playing' | 'over'
type Enemy = { x: number; y: number; speed: number; big: boolean }

export default function PlaneWar({ onGameOver }: { onGameOver: (s: number) => void }) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [status, setStatus] = useState<Status>('idle')
  const [score, setScore] = useState(0)
  const [lives, setLives] = useState(3)

  // 游戏状态放 ref，主循环直接读写，不触发重渲染
  const playerX = useRef(W / 2)
  const bullets = useRef<{ x: number; y: number }[]>([])
  const enemies = useRef<Enemy[]>([])
  const scoreRef = useRef(0)
  const livesRef = useRef(3)
  const alive = useRef(false)
  const overNotified = useRef(false)
  const raf = useRef(0)
  const lastTs = useRef(0)
  const lastShot = useRef(0)
  const lastSpawn = useRef(0)
  const spawnGap = useRef(900)
  const keys = useRef({ left: false, right: false })

  const clampX = (x: number) => Math.max(PLAYER_W / 2, Math.min(W - PLAYER_W / 2, x))

  const reset = useCallback(() => {
    playerX.current = W / 2
    bullets.current = []
    enemies.current = []
    scoreRef.current = 0
    livesRef.current = 3
    spawnGap.current = 900
    lastShot.current = 0
    lastSpawn.current = 0
    setScore(0)
    setLives(3)
  }, [])

  const gameOver = useCallback(() => {
    alive.current = false
    cancelAnimationFrame(raf.current)
    setStatus('over')
    if (!overNotified.current) {
      overNotified.current = true
      onGameOver(scoreRef.current)
    }
  }, [onGameOver])

  const spawnEnemy = useCallback(() => {
    const big = Math.random() < 0.22
    enemies.current.push({
      x: Math.random() * (W - ENEMY_W),
      y: -ENEMY_H,
      speed: (big ? 70 : 120) + Math.random() * 50,
      big,
    })
  }, [])

  const loop = useCallback(
    (t: number) => {
      if (!alive.current) return
      const ctx = canvasRef.current?.getContext('2d')
      if (!ctx) return
      const dt = lastTs.current ? Math.min(50, t - lastTs.current) : 16
      lastTs.current = t

      // 键盘移动
      const mv = 0.34 * dt
      if (keys.current.left) playerX.current -= mv
      if (keys.current.right) playerX.current += mv
      playerX.current = clampX(playerX.current)

      // 自动射击
      if (t - lastShot.current > 320) {
        lastShot.current = t
        bullets.current.push({ x: playerX.current, y: H - PLAYER_H - 4 })
      }

      // 敌机生成（随时间加快）
      if (t - lastSpawn.current > spawnGap.current) {
        lastSpawn.current = t
        spawnEnemy()
        spawnGap.current = Math.max(300, spawnGap.current - 8)
      }

      // 子弹上飞
      const bStep = 0.5 * dt
      bullets.current = bullets.current
        .map((b) => ({ x: b.x, y: b.y - bStep }))
        .filter((b) => b.y > -BULLET_H)

      // 敌机下落 + 撞玩家
      const eStep = dt / 1000
      const survivors: Enemy[] = []
      const py = H - PLAYER_H / 2
      const px = playerX.current
      for (const e of enemies.current) {
        e.y += e.speed * eStep
        const ex = e.x + ENEMY_W / 2
        const ey = e.y + ENEMY_H / 2
        if (
          Math.abs(ex - px) < ENEMY_W / 2 + PLAYER_W / 2 &&
          Math.abs(ey - py) < ENEMY_H / 2 + PLAYER_H / 2
        ) {
          livesRef.current -= 1
          setLives(livesRef.current)
          if (livesRef.current <= 0) {
            gameOver()
            return
          }
          continue // 敌机消失
        }
        if (e.y > H) continue // 漏过底部，不计分
        survivors.push(e)
      }
      enemies.current = survivors

      // 子弹 vs 敌机
      const hit = new Set<number>()
      bullets.current = bullets.current.filter((b) => {
        for (let i = 0; i < enemies.current.length; i++) {
          const e = enemies.current[i]
          if (
            Math.abs(b.x - (e.x + ENEMY_W / 2)) < ENEMY_W / 2 + BULLET_W / 2 &&
            Math.abs(b.y - (e.y + ENEMY_H / 2)) < ENEMY_H / 2 + BULLET_H / 2
          ) {
            hit.add(i)
            return false
          }
        }
        return true
      })
      if (hit.size) {
        let gained = 0
        enemies.current = enemies.current.filter((e, i) => {
          if (hit.has(i)) {
            gained += e.big ? 30 : 10
            return false
          }
          return true
        })
        scoreRef.current += gained
        setScore(scoreRef.current)
      }

      // 绘制
      ctx.clearRect(0, 0, W, H)
      ctx.fillStyle = '#0b1220'
      ctx.fillRect(0, 0, W, H)
      // 敌机
      for (const e of enemies.current) {
        ctx.fillStyle = e.big ? '#f59e0b' : '#ef4444'
        ctx.fillRect(e.x, e.y, ENEMY_W, ENEMY_H)
        ctx.fillStyle = '#1f2937'
        ctx.fillRect(e.x + ENEMY_W / 2 - 2, e.y + 4, 4, 6) // 座舱
      }
      // 子弹
      ctx.fillStyle = '#a5f3fc'
      for (const b of bullets.current) ctx.fillRect(b.x - BULLET_W / 2, b.y, BULLET_W, BULLET_H)
      // 玩家飞机（机身 + 机头）
      ctx.fillStyle = '#38bdf8'
      ctx.fillRect(px - PLAYER_W / 2, H - PLAYER_H, PLAYER_W, PLAYER_H)
      ctx.fillStyle = '#0ea5e9'
      ctx.fillRect(px - 3, H - PLAYER_H - 6, 6, 8)

      raf.current = requestAnimationFrame(loop)
    },
    [gameOver, spawnEnemy],
  )

  const start = useCallback(() => {
    reset()
    overNotified.current = false
    alive.current = true
    lastTs.current = 0
    setStatus('playing')
    raf.current = requestAnimationFrame(loop)
  }, [reset, loop])

  // 键盘控制（输入框聚焦时不抢按键）
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement) return
      if (e.key === 'ArrowLeft') {
        keys.current.left = true
        e.preventDefault()
      } else if (e.key === 'ArrowRight') {
        keys.current.right = true
        e.preventDefault()
      } else if (e.key === 'Enter' && status !== 'playing') {
        start()
      }
    }
    const onUp = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft') keys.current.left = false
      else if (e.key === 'ArrowRight') keys.current.right = false
    }
    window.addEventListener('keydown', onKey)
    window.addEventListener('keyup', onUp)
    return () => {
      window.removeEventListener('keydown', onKey)
      window.removeEventListener('keyup', onUp)
    }
  }, [status, start])

  // 组件卸载时停止循环，避免弹窗关闭后仍在跑
  useEffect(() => () => cancelAnimationFrame(raf.current), [])

  // 指针控制：鼠标 / 触摸映射到 canvas 内坐标
  const aim = (clientX: number) => {
    const c = canvasRef.current
    if (!c) return
    const rect = c.getBoundingClientRect()
    const scale = W / rect.width
    playerX.current = clampX((clientX - rect.left) * scale)
  }
  const onPointerMove = (e: ReactPointerEvent<HTMLCanvasElement>) => {
    if (status === 'playing') aim(e.clientX)
  }

  return (
    <div className="game-plane">
      <div className="game-score">
        ✈️ {score} · ❤ {lives}
      </div>
      <canvas
        ref={canvasRef}
        width={W}
        height={H}
        className="game-canvas"
        onPointerMove={onPointerMove}
        onTouchMove={(e) => {
          e.preventDefault()
          if (status === 'playing' && e.touches[0]) aim(e.touches[0].clientX)
        }}
      />
      {status !== 'playing' && (
        <div className="game-overlay">
          <p>{status === 'idle' ? '移动鼠标 / 触摸控制飞机，自动射击' : `游戏结束，得分 ${score}`}</p>
          <button type="button" className="btn-primary game-btn" onClick={start}>
            {status === 'idle' ? '开始游戏' : '再来一局'}
          </button>
        </div>
      )}
      <p className="game-help">🖱 移动鼠标 / 触摸控制 · 自动射击 · 方向键也可移动</p>
    </div>
  )
}
