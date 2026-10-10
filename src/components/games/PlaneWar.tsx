import { useCallback, useEffect, useRef, useState } from 'react'
import type { PointerEvent as ReactPointerEvent } from 'react'

/** 飞机大战：多机型敌机 + 变向变速子弹 + 我方道具升级 */
const W = 360
const H = 480
const PLAYER_W = 36
const PLAYER_H = 32
const BULLET_W = 4
const BULLET_H = 12
const INVULN_MS = 1000 // 受击后无敌时间，避免一帧内被多发子弹连续扣命

type Status = 'idle' | 'playing' | 'over'
type EnemyKind = 'scout' | 'fighter' | 'zigzag' | 'gunner' | 'tank'
type PowerKind = 'power' | 'shield' | 'life' | 'rapid'

// 敌机机型配置：尺寸 / 血量 / 下落速度 / 得分 / 配色 / 道具掉落概率
const ENEMY_DEF: Record<
  EnemyKind,
  {
    w: number
    h: number
    hp: number
    sMin: number
    sMax: number
    score: number
    glow: string
    grad: [string, string]
    drop: number
  }
> = {
  scout: { w: 28, h: 24, hp: 1, sMin: 150, sMax: 215, score: 10, glow: '#ef4444', grad: ['#fca5a5', '#b91c1c'], drop: 0.12 },
  fighter: { w: 34, h: 30, hp: 2, sMin: 70, sMax: 110, score: 30, glow: '#f59e0b', grad: ['#fbbf24', '#b45309'], drop: 0.18 },
  zigzag: { w: 30, h: 26, hp: 1, sMin: 110, sMax: 140, score: 15, glow: '#a855f7', grad: ['#d8b4fe', '#7e22ce'], drop: 0.16 },
  gunner: { w: 32, h: 28, hp: 2, sMin: 85, sMax: 115, score: 25, glow: '#22c55e', grad: ['#86efac', '#15803d'], drop: 0.22 },
  tank: { w: 44, h: 38, hp: 4, sMin: 40, sMax: 62, score: 60, glow: '#64748b', grad: ['#cbd5e1', '#334155'], drop: 0.45 },
}

type Enemy = {
  kind: EnemyKind
  x: number
  y: number
  baseX: number
  amp: number
  phase: number
  speed: number
  hp: number
  flash: number
  nextShot: number
}

// 子弹统一用速度向量（px/秒），方向速度各不相同
type Bullet = { x: number; y: number; vx: number; vy: number }
type EBullet = { x: number; y: number; vx: number; vy: number; size: number; color: string }
type Spark = { x: number; y: number; born: number }
type PowerUp = { x: number; y: number; kind: PowerKind }

export default function PlaneWar({ onGameOver }: { onGameOver: (s: number) => void }) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [status, setStatus] = useState<Status>('idle')
  const [score, setScore] = useState(0)
  const [lives, setLives] = useState(3)
  const [hud, setHud] = useState({ power: 1, shield: false, rapid: false })

  // 游戏状态放 ref，主循环直接读写，不触发重渲染
  const playerX = useRef(W / 2)
  const playerY = useRef(H - PLAYER_H / 2)
  const bullets = useRef<Bullet[]>([])
  const enemies = useRef<Enemy[]>([])
  const eBullets = useRef<EBullet[]>([])
  const sparks = useRef<Spark[]>([])
  const powerups = useRef<PowerUp[]>([])
  const scoreRef = useRef(0)
  const livesRef = useRef(3)
  const powerLevel = useRef(1)
  const shieldUntil = useRef(0)
  const rapidUntil = useRef(0)
  const alive = useRef(false)
  const overNotified = useRef(false)
  const raf = useRef(0)
  const lastTs = useRef(0)
  const lastShot = useRef(0)
  const lastSpawn = useRef(0)
  const spawnGap = useRef(900)
  const startT = useRef(0)
  const invulnUntil = useRef(0)
  const keys = useRef({ left: false, right: false, up: false, down: false })
  const hudRef = useRef({ power: 1, shield: false, rapid: false })

  const clampX = (x: number) => Math.max(PLAYER_W / 2, Math.min(W - PLAYER_W / 2, x))
  const clampY = (y: number) => Math.max(PLAYER_H / 2 + 24, Math.min(H - PLAYER_H / 2, y))

  const syncHud = useCallback(
    (next: { power: number; shield: boolean; rapid: boolean }) => {
      const p = hudRef.current
      if (p.power !== next.power || p.shield !== next.shield || p.rapid !== next.rapid) {
        hudRef.current = next
        setHud(next)
      }
    },
    [],
  )

  const reset = useCallback(() => {
    playerX.current = W / 2
    playerY.current = H - PLAYER_H / 2
    bullets.current = []
    enemies.current = []
    eBullets.current = []
    sparks.current = []
    powerups.current = []
    scoreRef.current = 0
    livesRef.current = 3
    powerLevel.current = 1
    shieldUntil.current = 0
    rapidUntil.current = 0
    spawnGap.current = 900
    lastShot.current = 0
    lastSpawn.current = 0
    startT.current = 0
    invulnUntil.current = 0
    hudRef.current = { power: 1, shield: false, rapid: false }
    setScore(0)
    setLives(3)
    setHud({ power: 1, shield: false, rapid: false })
  }, [])

  const damage = useCallback(
    (t: number) => {
      if (t < invulnUntil.current) return
      if (t < shieldUntil.current) return // 护盾期间免伤
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

  /** 随时间提升敌机机型权重：前期小股，后期坦克/炮手登场 */
  const pickKind = useCallback((elapsed: number): EnemyKind => {
    const r = Math.random()
    if (elapsed < 10000) {
      if (r < 0.6) return 'scout'
      if (r < 0.85) return 'fighter'
      return 'zigzag'
    } else if (elapsed < 22000) {
      if (r < 0.42) return 'scout'
      if (r < 0.68) return 'fighter'
      if (r < 0.84) return 'zigzag'
      return 'gunner'
    }
    if (r < 0.34) return 'scout'
    if (r < 0.55) return 'fighter'
    if (r < 0.7) return 'zigzag'
    if (r < 0.86) return 'gunner'
    return 'tank'
  }, [])

  const spawnEnemy = useCallback(
    (t: number) => {
      const kind = pickKind(t - startT.current)
      const def = ENEMY_DEF[kind]
      const isZig = kind === 'zigzag'
      const x = Math.random() * (W - def.w)
      enemies.current.push({
        kind,
        x,
        baseX: x,
        amp: isZig ? 38 : 0,
        phase: Math.random() * Math.PI * 2,
        y: -def.h,
        speed: def.sMin + Math.random() * (def.sMax - def.sMin),
        hp: def.hp,
        flash: 0,
        nextShot: t + 700 + Math.random() * 900,
      })
    },
    [pickKind],
  )

  const pushEB = useCallback((x: number, y: number, vx: number, vy: number, color: string, size = 4) => {
    eBullets.current.push({ x, y, vx, vy, color, size })
  }, [])

  const firePlayer = useCallback((t: number) => {
    const x = playerX.current
    const y = playerY.current - PLAYER_H / 2 - 4
    const spd = 380
    const lvl = powerLevel.current
    if (lvl <= 1) {
      bullets.current.push({ x, y, vx: 0, vy: -spd })
    } else if (lvl === 2) {
      bullets.current.push({ x: x - 7, y, vx: -45, vy: -spd })
      bullets.current.push({ x: x + 7, y, vx: 45, vy: -spd })
    } else {
      bullets.current.push({ x, y, vx: 0, vy: -spd })
      bullets.current.push({ x, y, vx: -130, vy: -spd })
      bullets.current.push({ x, y, vx: 130, vy: -spd })
    }
  }, [])

  const dropPower = useCallback((cx: number, cy: number) => {
    const r = Math.random()
    const kind: PowerKind = r < 0.45 ? 'power' : r < 0.7 ? 'shield' : r < 0.9 ? 'rapid' : 'life'
    powerups.current.push({ x: cx, y: cy, kind })
  }, [])

  const applyPower = useCallback((p: PowerKind, t: number) => {
    if (p === 'power') powerLevel.current = Math.min(3, powerLevel.current + 1)
    else if (p === 'shield') shieldUntil.current = t + 6000
    else if (p === 'rapid') rapidUntil.current = t + 6000
    else if (p === 'life') {
      livesRef.current = Math.min(5, livesRef.current + 1)
      setLives(livesRef.current)
    }
    syncHud({ power: powerLevel.current, shield: t < shieldUntil.current, rapid: t < rapidUntil.current })
  }, [syncHud])

  const loop = useCallback(
    (t: number) => {
      if (!alive.current) return
      const ctx = canvasRef.current?.getContext('2d')
      if (!ctx) return
      if (!startT.current) startT.current = t
      const dt = lastTs.current ? Math.min(50, t - lastTs.current) : 16
      lastTs.current = t
      const eStep = dt / 1000

      // 键盘移动（前后左右）
      const mv = 0.34 * dt
      if (keys.current.left) playerX.current -= mv
      if (keys.current.right) playerX.current += mv
      if (keys.current.up) playerY.current -= mv
      if (keys.current.down) playerY.current += mv
      playerX.current = clampX(playerX.current)
      playerY.current = clampY(playerY.current)

      // 玩家自动射击（等级越高弹道越宽；急速时射速翻倍）
      const interval = t < rapidUntil.current ? 160 : 320
      if (t - lastShot.current > interval) {
        lastShot.current = t
        firePlayer(t)
      }

      // 敌机生成（随时间加快）
      if (t - lastSpawn.current > spawnGap.current) {
        lastSpawn.current = t
        spawnEnemy(t)
        spawnGap.current = Math.max(280, spawnGap.current - 8)
      }

      // 玩家子弹（带速度向量，map 需保留 vx/vy 否则下一帧速度丢失变 NaN）
      bullets.current = bullets.current
        .map((b) => ({ x: b.x + b.vx * eStep, y: b.y + b.vy * eStep, vx: b.vx, vy: b.vy }))
        .filter((b) => b.y > -BULLET_H && b.x > -10 && b.x < W + 10)

      // 敌弹（变向变速）
      eBullets.current = eBullets.current
        .map((b) => ({ ...b, x: b.x + b.vx * eStep, y: b.y + b.vy * eStep }))
        .filter((b) => b.y > -16 && b.y < H + 16 && b.x > -16 && b.x < W + 16)

      // 子弹对打：玩家子弹与敌弹相撞则相互抵消，并迸发火花
      const pbKill = new Set<number>()
      const ebKill = new Set<number>()
      for (let i = 0; i < bullets.current.length; i++) {
        if (pbKill.has(i)) continue
        const b = bullets.current[i]
        const bx1 = b.x - BULLET_W / 2
        const bx2 = b.x + BULLET_W / 2
        const by1 = b.y
        const by2 = b.y + BULLET_H
        for (let j = 0; j < eBullets.current.length; j++) {
          if (ebKill.has(j)) continue
          const e = eBullets.current[j]
          const ex1 = e.x - e.size
          const ex2 = e.x + e.size
          const ey1 = e.y - e.size
          const ey2 = e.y + e.size
          if (bx1 < ex2 && bx2 > ex1 && by1 < ey2 && by2 > ey1) {
            pbKill.add(i)
            ebKill.add(j)
            sparks.current.push({ x: (b.x + e.x) / 2, y: (b.y + e.y) / 2, born: t })
            break
          }
        }
      }
      if (pbKill.size) bullets.current = bullets.current.filter((_, i) => !pbKill.has(i))
      if (ebKill.size) eBullets.current = eBullets.current.filter((_, i) => !ebKill.has(i))
      sparks.current = sparks.current.filter((s) => t - s.born < 180)

      // 敌机下落 + 蛇形 + 开火 + 撞玩家
      const px = playerX.current
      const py = playerY.current
      const survivors: Enemy[] = []
      for (const e of enemies.current) {
        const def = ENEMY_DEF[e.kind]
        e.y += e.speed * eStep
        if (e.amp) {
          e.phase += dt * 0.005
          e.x = clampX(e.baseX + Math.sin(e.phase) * e.amp)
        }
        // 开火：不同机型弹道与速度各异
        if (e.y > 8 && t > e.nextShot) {
          const ex = e.x + def.w / 2
          const ey = e.y + def.h
          if (e.kind === 'scout') {
            e.nextShot = t + 1500 + Math.random() * 1200
            pushEB(ex, ey, 0, 150, '#fb7185')
          } else if (e.kind === 'fighter') {
            e.nextShot = t + 900 + Math.random() * 600
            pushEB(ex, ey, 0, 190, '#fde047')
          } else if (e.kind === 'zigzag') {
            e.nextShot = t + 1200 + Math.random() * 800
            const dx = px - ex
            const dy = py - ey
            const len = Math.hypot(dx, dy) || 1
            pushEB(ex, ey, (dx / len) * 210, (dy / len) * 210, '#e879f9')
          } else if (e.kind === 'gunner') {
            e.nextShot = t + 900 + Math.random() * 600
            const dx = px - ex
            const dy = py - ey
            const len = Math.hypot(dx, dy) || 1
            pushEB(ex, ey, (dx / len) * 230, (dy / len) * 230, '#4ade80')
          } else {
            // tank：三向散射
            e.nextShot = t + 1100 + Math.random() * 600
            const s = 170
            pushEB(ex, ey, 0, s, '#94a3b8')
            pushEB(ex, ey, -s * 0.5, s * 0.866, '#94a3b8')
            pushEB(ex, ey, s * 0.5, s * 0.866, '#94a3b8')
          }
        }
        const ex = e.x + def.w / 2
        const ey = e.y + def.h / 2
        if (Math.abs(ex - px) < def.w / 2 + PLAYER_W / 2 && Math.abs(ey - py) < def.h / 2 + PLAYER_H / 2) {
          damage(t) // 撞机：玩家受伤，敌机消失
          continue
        }
        if (e.y > H) continue // 漏过底部，不计分
        survivors.push(e)
      }
      enemies.current = survivors

      // 玩家子弹 vs 敌机（hp 制）
      const hitSet = new Set<number>()
      bullets.current = bullets.current.filter((b) => {
        for (let i = 0; i < enemies.current.length; i++) {
          if (hitSet.has(i)) continue
          const e = enemies.current[i]
          const def = ENEMY_DEF[e.kind]
          if (
            Math.abs(b.x - (e.x + def.w / 2)) < def.w / 2 + BULLET_W / 2 &&
            Math.abs(b.y - (e.y + def.h / 2)) < def.h / 2 + BULLET_H / 2
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
            gained += ENEMY_DEF[e.kind].score
            if (Math.random() < ENEMY_DEF[e.kind].drop) dropPower(e.x + ENEMY_DEF[e.kind].w / 2, e.y + ENEMY_DEF[e.kind].h / 2)
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
      eBullets.current = eBullets.current.filter((b) => {
        if (Math.abs(b.x - px) < b.size + PLAYER_W / 2 && Math.abs(b.y - py) < b.size + PLAYER_H / 2) {
          damage(t)
          return false
        }
        return true
      })

      // 道具下落 + 拾取
      powerups.current = powerups.current
        .map((p) => ({ ...p, y: p.y + 95 * eStep }))
        .filter((p) => {
          if (p.y > H + 16) return false
          if (Math.abs(p.x - px) < 14 + PLAYER_W / 2 && Math.abs(p.y - py) < 14 + PLAYER_H / 2) {
            applyPower(p.kind, t)
            return false
          }
          return true
        })

      syncHud({ power: powerLevel.current, shield: t < shieldUntil.current, rapid: t < rapidUntil.current })

      // ===== 绘制 =====
      ctx.clearRect(0, 0, W, H)
      ctx.fillStyle = '#0b1220'
      ctx.fillRect(0, 0, W, H)

      // 敌弹（按颜色区分机型弹道）
      for (const b of eBullets.current) {
        ctx.fillStyle = b.color
        ctx.fillRect(b.x - b.size, b.y - b.size, b.size * 2, b.size * 2)
      }
      // 玩家子弹（带辉光）
      ctx.save()
      ctx.shadowColor = '#22d3ee'
      ctx.shadowBlur = 6
      ctx.fillStyle = '#a5f3fc'
      for (const b of bullets.current) ctx.fillRect(b.x - BULLET_W / 2, b.y, BULLET_W, BULLET_H)
      ctx.restore()

      // 敌机
      for (const e of enemies.current) drawEnemy(ctx, e, t)
      // 子弹对打火花
      for (const s of sparks.current) {
        const k = (t - s.born) / 180
        ctx.save()
        ctx.globalAlpha = 1 - k
        ctx.strokeStyle = '#fde047'
        ctx.lineWidth = 2
        ctx.beginPath()
        ctx.arc(s.x, s.y, 3 + k * 9, 0, Math.PI * 2)
        ctx.stroke()
        ctx.restore()
      }
      // 道具
      for (const p of powerups.current) drawPowerUp(ctx, p)
      // 玩家飞机（受击闪烁 + 护盾环）
      const blink = t < invulnUntil.current && Math.floor(t / 90) % 2 === 0
      const shield = t < shieldUntil.current
      ctx.save()
      if (blink) ctx.globalAlpha = 0.35
      drawPlayer(ctx, px, py, t, shield)
      ctx.restore()

      raf.current = requestAnimationFrame(loop)
    },
    [applyPower, damage, dropPower, firePlayer, pushEB, spawnEnemy, syncHud],
  )

  const start = useCallback(() => {
    reset()
    overNotified.current = false
    alive.current = true
    lastTs.current = 0
    setStatus('playing')
    raf.current = requestAnimationFrame(loop)
  }, [reset, loop])

  // 键盘控制（输入框聚焦时不抢按键）：方向键 或 WASD
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement) return
      const k = e.key
      if (k === 'ArrowLeft' || k === 'a' || k === 'A') {
        keys.current.left = true
        e.preventDefault()
      } else if (k === 'ArrowRight' || k === 'd' || k === 'D') {
        keys.current.right = true
        e.preventDefault()
      } else if (k === 'ArrowUp' || k === 'w' || k === 'W') {
        keys.current.up = true
        e.preventDefault()
      } else if (k === 'ArrowDown' || k === 's' || k === 'S') {
        keys.current.down = true
        e.preventDefault()
      } else if (k === 'Enter' && status !== 'playing') {
        start()
      }
    }
    const onUp = (e: KeyboardEvent) => {
      const k = e.key
      if (k === 'ArrowLeft' || k === 'a' || k === 'A') keys.current.left = false
      else if (k === 'ArrowRight' || k === 'd' || k === 'D') keys.current.right = false
      else if (k === 'ArrowUp' || k === 'w' || k === 'W') keys.current.up = false
      else if (k === 'ArrowDown' || k === 's' || k === 'S') keys.current.down = false
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

  // 指针控制：鼠标 / 触摸映射到 canvas 内坐标（双轴，前后左右都能跟手）
  const aim = (clientX: number, clientY: number) => {
    const c = canvasRef.current
    if (!c) return
    const rect = c.getBoundingClientRect()
    const scaleX = W / rect.width
    const scaleY = H / rect.height
    playerX.current = clampX((clientX - rect.left) * scaleX)
    playerY.current = clampY((clientY - rect.top) * scaleY)
  }
  const onPointerMove = (e: ReactPointerEvent<HTMLCanvasElement>) => {
    if (status === 'playing') aim(e.clientX, e.clientY)
  }

  const powerLabel = hud.power > 1 ? `🔥${hud.power}` : ''
  const shieldLabel = hud.shield ? '🛡' : ''
  const rapidLabel = hud.rapid ? '⚡' : ''

  return (
    <div className="game-plane">
      <div className="game-score">
        ✈️ {score} · ❤ {lives} {powerLabel} {shieldLabel} {rapidLabel}
      </div>
      <canvas
        ref={canvasRef}
        width={W}
        height={H}
        className="game-canvas"
        onPointerMove={onPointerMove}
        onTouchMove={(e) => {
          e.preventDefault()
          if (status === 'playing' && e.touches[0]) aim(e.touches[0].clientX, e.touches[0].clientY)
        }}
      />
      {status !== 'playing' && (
        <div className="game-overlay">
          <p>{status === 'idle' ? '移动鼠标 / 触摸或 WASD 四向飞行，自动射击；击落敌机掉落道具升级' : `游戏结束，得分 ${score}`}</p>
          <button type="button" className="btn-primary game-btn" onClick={start}>
            {status === 'idle' ? '开始游戏' : '再来一局'}
          </button>
        </div>
      )}
      <p className="game-help">🖱 鼠标 / 触摸 或 WASD 四向飞行 · 自动射击 · 拾取道具升级（🔥火力 🛡护盾 ⚡急速 ❤生命）· 子弹可拦截敌弹</p>
    </div>
  )
}

/** 玩家战机：机身渐变 + 蓝色辉光 + 座舱 + 引擎尾焰闪烁 + 护盾环 */
function drawPlayer(ctx: CanvasRenderingContext2D, px: number, py: number, t: number, shield: boolean) {
  const halfW = PLAYER_W / 2
  const halfH = PLAYER_H / 2
  const top = py - halfH
  const bot = py + halfH
  ctx.save()
  if (shield) {
    ctx.strokeStyle = 'rgba(34,211,238,0.9)'
    ctx.lineWidth = 2.5
    ctx.shadowColor = '#22d3ee'
    ctx.shadowBlur = 10
    ctx.beginPath()
    ctx.arc(px, py, halfW + 8, 0, Math.PI * 2)
    ctx.stroke()
    ctx.shadowBlur = 0
  }
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

/** 敌机：机头朝下，按机型配色 + 辉光 + 座舱；受击短暂闪白 */
function drawEnemy(ctx: CanvasRenderingContext2D, e: Enemy, t: number) {
  const def = ENEMY_DEF[e.kind]
  const px = e.x + def.w / 2
  const py = e.y + def.h / 2
  const halfW = def.w / 2
  const halfH = def.h / 2
  const top = e.y
  const bot = e.y + def.h
  ctx.save()
  ctx.shadowColor = def.glow
  ctx.shadowBlur = 8
  const g = ctx.createLinearGradient(0, top, 0, bot)
  g.addColorStop(0, def.grad[0])
  g.addColorStop(1, def.grad[1])
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
  ctx.fillStyle = def.grad[1]
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

/** 道具图标：圆形底色 + 字母/符号 */
function drawPowerUp(ctx: CanvasRenderingContext2D, p: PowerUp) {
  const map: Record<PowerKind, { c: string; s: string }> = {
    power: { c: '#f472b6', s: '🔥' },
    shield: { c: '#22d3ee', s: '🛡' },
    rapid: { c: '#facc15', s: '⚡' },
    life: { c: '#f43f5e', s: '❤' },
  }
  const m = map[p.kind]
  ctx.save()
  ctx.shadowColor = m.c
  ctx.shadowBlur = 10
  ctx.fillStyle = m.c
  ctx.beginPath()
  ctx.arc(p.x, p.y, 11, 0, Math.PI * 2)
  ctx.fill()
  ctx.shadowBlur = 0
  ctx.fillStyle = '#0b1220'
  ctx.font = 'bold 13px sans-serif'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText(m.s, p.x, p.y + 0.5)
  ctx.restore()
}
