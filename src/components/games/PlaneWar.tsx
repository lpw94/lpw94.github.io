import { useCallback, useEffect, useRef, useState } from 'react'
import type { PointerEvent as ReactPointerEvent } from 'react'

/** 飞机大战：移动鼠标 / 触摸或方向键控制飞机，自动射击；敌机可反击，击落得分，3 条命 */
const W = 360
const H = 480
const PLAYER_W = 36
const PLAYER_H = 32
const BULLET_W = 4
const BULLET_H = 12
const ENEMY_W = 30
const ENEMY_H = 26
const EBULLET_W = 4
const EBULLET_H = 10
const INVULN_MS = 1000 // 受击后无敌时间，避免一帧内被多发子弹连续扣命

type Status = 'idle' | 'playing' | 'over'
type Enemy = { x: number; y: number; speed: number; big: boolean; nextShot: number; hp: number; flash: number }
type EBullet = { x: number; y: number; speed: number; big: boolean }

export default function PlaneWar({ onGameOver }: { onGameOver: (s: number) => void }) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [status, setStatus] = useState<Status>('idle')
  const [score, setScore] = useState(0)
  const [lives, setLives] = useState(3)

  // 游戏状态放 ref，主循环直接读写，不触发重渲染
  const playerX = useRef(W / 2)
  const bullets = useRef<{ x: number; y: number }[]>([])
  const enemies = useRef<Enemy[]>([])
  const eBullets = useRef<EBullet[]>([])
  const scoreRef = useRef(0)
  const livesRef = useRef(3)
  const alive = useRef(false)
  const overNotified = useRef(false)
  const raf = useRef(0)
  const lastTs = useRef(0)
  const lastShot = useRef(0)
  const lastSpawn = useRef(0)
  const spawnGap = useRef(900)
  const invulnUntil = useRef(0)
  const keys = useRef({ left: false, right: false })

  const clampX = (x: number) => Math.max(PLAYER_W / 2, Math.min(W - PLAYER_W / 2, x))

  const reset = useCallback(() => {
    playerX.current = W / 2
    bullets.current = []
    enemies.current = []
    eBullets.current = []
    scoreRef.current = 0
    livesRef.current = 3
    spawnGap.current = 900
    lastShot.current = 0
    lastSpawn.current = 0
    invulnUntil.current = 0
    setScore(0)
    setLives(3)
  }, [])

  const damage = useCallback(
    (t: number) => {
      if (t < invulnUntil.current) return
      livesRef.current -= 1
      setLives(livesRef.current)
      invulnUntil.current = t + INVULN_MS
      if (livesRef.current <= 0) {
        alive.current = false
        cancelAnimationFrame(raf.current)
        setStatus('over')
        if (!overNotified.current) {
          overNotified.current = true
          onGameOver(scoreRef.current)
        }
      }
    },
    [onGameOver],
  )

  const gameOver = useCallback(() => {
    alive.current = false
    cancelAnimationFrame(raf.current)
    setStatus('over')
    if (!overNotified.current) {
      overNotified.current = true
      onGameOver(scoreRef.current)
    }
  }, [onGameOver])

  const spawnEnemy = useCallback((t: number) => {
    const big = Math.random() < 0.22
    enemies.current.push({
      x: Math.random() * (W - ENEMY_W),
      y: -ENEMY_H,
      speed: (big ? 70 : 120) + Math.random() * 50,
      big,
      // 入场后稍作延迟再开火：大敌机快、小敌机慢且不常开火
      nextShot: t + (big ? 700 + Math.random() * 600 : 1400 + Math.random() * 1400),
      hp: big ? 2 : 1,
      flash: 0,
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

      // 玩家自动射击
      if (t - lastShot.current > 320) {
        lastShot.current = t
        bullets.current.push({ x: playerX.current, y: H - PLAYER_H - 4 })
      }

      // 敌机生成（随时间加快）
      if (t - lastSpawn.current > spawnGap.current) {
        lastSpawn.current = t
        spawnEnemy(t)
        spawnGap.current = Math.max(300, spawnGap.current - 8)
      }

      // 玩家子弹上飞
      const bStep = 0.5 * dt
      bullets.current = bullets.current
        .map((b) => ({ x: b.x, y: b.y - bStep }))
        .filter((b) => b.y > -BULLET_H)

      // 敌弹下飞
      const ebStep = 0.22 * dt
      eBullets.current = eBullets.current
        .map((b) => ({ ...b, y: b.y + b.speed * ebStep }))
        .filter((b) => b.y < H + EBULLET_H)

      // 敌机下落 + 开火 + 撞玩家
      const eStep = dt / 1000
      const py = H - PLAYER_H / 2
      const px = playerX.current
      const survivors: Enemy[] = []
      for (const e of enemies.current) {
        e.y += e.speed * eStep
        // 敌机开火（在屏幕内才打）
        if (e.y > 8 && t > e.nextShot) {
          e.nextShot = t + (e.big ? 900 + Math.random() * 500 : 1500 + Math.random() * 1200)
          eBullets.current.push({
            x: e.x + ENEMY_W / 2,
            y: e.y + ENEMY_H,
            speed: e.big ? 0.26 : 0.2,
            big: e.big,
          })
        }
        const ex = e.x + ENEMY_W / 2
        const ey = e.y + ENEMY_H / 2
        if (
          Math.abs(ex - px) < ENEMY_W / 2 + PLAYER_W / 2 &&
          Math.abs(ey - py) < ENEMY_H / 2 + PLAYER_H / 2
        ) {
          damage(t) // 撞机：玩家受伤，敌机消失
          continue
        }
        if (e.y > H) continue // 漏过底部，不计分
        survivors.push(e)
      }
      enemies.current = survivors

      // 玩家子弹 vs 敌机（hp 制：大敌机 2 发，小敌机 1 发）
      const hitSet = new Set<number>()
      bullets.current = bullets.current.filter((b) => {
        for (let i = 0; i < enemies.current.length; i++) {
          if (hitSet.has(i)) continue
          const e = enemies.current[i]
          if (
            Math.abs(b.x - (e.x + ENEMY_W / 2)) < ENEMY_W / 2 + BULLET_W / 2 &&
            Math.abs(b.y - (e.y + ENEMY_H / 2)) < ENEMY_H / 2 + BULLET_H / 2
          ) {
            hitSet.add(i)
            e.hp -= 1
            if (e.hp <= 0) e.flash = t
            return false
          }
        }
        return true
      })
      if (hitSet.size) {
        let gained = 0
        enemies.current = enemies.current.filter((e, i) => {
          if (hitSet.has(i) && e.hp <= 0) {
            gained += e.big ? 30 : 10
            return false
          }
          return true
        })
        if (gained) {
          scoreRef.current += gained
          setScore(scoreRef.current)
        }
      }

      // 敌弹 vs 玩家
      const px2 = px
      const py2 = py
      eBullets.current = eBullets.current.filter((b) => {
        if (
          Math.abs(b.x - px2) < EBULLET_W / 2 + PLAYER_W / 2 &&
          Math.abs(b.y - py2) < EBULLET_H / 2 + PLAYER_H / 2
        ) {
          damage(t)
          return false
        }
        return true
      })

      // ===== 绘制 =====
      ctx.clearRect(0, 0, W, H)
      // 背景星空（轻微闪烁点，增加生动感）
      ctx.fillStyle = '#0b1220'
      ctx.fillRect(0, 0, W, H)

      // 敌弹
      ctx.fillStyle = '#fb7185'
      for (const b of eBullets.current) ctx.fillRect(b.x - EBULLET_W / 2, b.y, EBULLET_W, EBULLET_H)
      // 玩家子弹（带辉光）
      ctx.save()
      ctx.shadowColor = '#22d3ee'
      ctx.shadowBlur = 6
      ctx.fillStyle = '#a5f3fc'
      for (const b of bullets.current) ctx.fillRect(b.x - BULLET_W / 2, b.y, BULLET_W, BULLET_H)
      ctx.restore()

      // 敌机
      for (const e of enemies.current) drawEnemy(ctx, e, t)
      // 玩家飞机（受击闪烁）
      const blink = t < invulnUntil.current && Math.floor(t / 90) % 2 === 0
      ctx.save()
      if (blink) ctx.globalAlpha = 0.35
      drawPlayer(ctx, px, py, t)
      ctx.restore()

      raf.current = requestAnimationFrame(loop)
    },
    [damage, gameOver, spawnEnemy],
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
          <p>{status === 'idle' ? '移动鼠标 / 触摸控制飞机，自动射击；敌机也会反击' : `游戏结束，得分 ${score}`}</p>
          <button type="button" className="btn-primary game-btn" onClick={start}>
            {status === 'idle' ? '开始游戏' : '再来一局'}
          </button>
        </div>
      )}
      <p className="game-help">🖱 移动鼠标 / 触摸控制 · 自动射击 · 敌机会反击，注意躲避</p>
    </div>
  )
}

/** 玩家战机：机身渐变 + 蓝色辉光 + 座舱 + 引擎尾焰闪烁 */
function drawPlayer(ctx: CanvasRenderingContext2D, px: number, py: number, t: number) {
  const halfW = PLAYER_W / 2
  const halfH = PLAYER_H / 2
  const top = py - halfH
  const bot = py + halfH
  ctx.save()
  ctx.shadowColor = '#38bdf8'
  ctx.shadowBlur = 10
  const g = ctx.createLinearGradient(0, top, 0, bot)
  g.addColorStop(0, '#7dd3fc')
  g.addColorStop(1, '#0284c7')
  ctx.fillStyle = g
  ctx.beginPath()
  ctx.moveTo(px, top) // 机头朝上
  ctx.lineTo(px + halfW, bot)
  ctx.lineTo(px + halfW * 0.42, bot - 3)
  ctx.lineTo(px, py + halfH * 0.45) // 尾部内凹
  ctx.lineTo(px - halfW * 0.42, bot - 3)
  ctx.lineTo(px - halfW, bot)
  ctx.closePath()
  ctx.fill()
  ctx.shadowBlur = 0
  // 座舱
  ctx.fillStyle = '#e0f2fe'
  ctx.beginPath()
  ctx.ellipse(px, py - halfH * 0.25, 4, 7, 0, 0, Math.PI * 2)
  ctx.fill()
  // 引擎尾焰（闪烁）
  const fl = Math.min(7 + Math.sin(t / 40) * 3, H - bot)
  ctx.fillStyle = '#fbbf24'
  ctx.beginPath()
  ctx.moveTo(px - 4, bot)
  ctx.lineTo(px + 4, bot)
  ctx.lineTo(px, bot + fl)
  ctx.closePath()
  ctx.fill()
  ctx.fillStyle = '#f97316'
  ctx.beginPath()
  ctx.moveTo(px - 2, bot)
  ctx.lineTo(px + 2, bot)
  ctx.lineTo(px, bot + fl * 0.6)
  ctx.closePath()
  ctx.fill()
  ctx.restore()
}

/** 敌机：机头朝下，红/橙渐变 + 辉光 + 座舱；受击短暂闪白 */
function drawEnemy(ctx: CanvasRenderingContext2D, e: Enemy, t: number) {
  const px = e.x + ENEMY_W / 2
  const py = e.y + ENEMY_H / 2
  const halfW = ENEMY_W / 2
  const halfH = ENEMY_H / 2
  const top = e.y
  const bot = e.y + ENEMY_H
  ctx.save()
  ctx.shadowColor = e.big ? '#f59e0b' : '#ef4444'
  ctx.shadowBlur = 8
  const g = ctx.createLinearGradient(0, top, 0, bot)
  if (e.big) {
    g.addColorStop(0, '#fbbf24')
    g.addColorStop(1, '#b45309')
  } else {
    g.addColorStop(0, '#fca5a5')
    g.addColorStop(1, '#b91c1c')
  }
  ctx.fillStyle = g
  ctx.beginPath()
  ctx.moveTo(px, bot) // 机头朝下
  ctx.lineTo(px + halfW, top)
  ctx.lineTo(px + halfW * 0.42, top + 3)
  ctx.lineTo(px, py - halfH * 0.45)
  ctx.lineTo(px - halfW * 0.42, top + 3)
  ctx.lineTo(px - halfW, top)
  ctx.closePath()
  ctx.fill()
  ctx.shadowBlur = 0
  // 座舱
  ctx.fillStyle = e.big ? '#7c2d12' : '#7f1d1d'
  ctx.beginPath()
  ctx.ellipse(px, py + halfH * 0.25, 3.5, 6, 0, 0, Math.PI * 2)
  ctx.fill()
  // 受击闪白
  if (e.flash && t - e.flash < 120) {
    ctx.globalAlpha = 1 - (t - e.flash) / 120
    ctx.fillStyle = '#ffffff'
    ctx.beginPath()
    ctx.moveTo(px, bot)
    ctx.lineTo(px + halfW, top)
    ctx.lineTo(px - halfW, top)
    ctx.closePath()
    ctx.fill()
    ctx.globalAlpha = 1
  }
  ctx.restore()
}
