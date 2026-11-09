import { useEffect, useRef } from 'react'

// 锁屏背景：一个纯 Canvas 模拟的生态鱼缸（不依赖任何图片 / 第三方库）。
// 水体 → 水面波纹 → 光柱 → 浮游颗粒 → 沙床与卵石 → 水草 → 气泡 → 鱼 → 涟漪
// 鱼会缓慢巡游并躲开鼠标；点一下水面会荡开涟漪、冒出一串气泡。

type Fish = {
  x: number
  y: number
  /** 朝向：1 向右，-1 向左 */
  dir: 1 | -1
  /** 水平速度 px/s */
  speed: number
  vy: number
  /** 巡游的目标高度 */
  ty: number
  /** 体长 px */
  len: number
  kind: number
  /** 摆尾相位 */
  phase: number
  /** 远景鱼：略小、半透明，用来做出水深层次 */
  far: boolean
}

type Bubble = { x: number; y: number; r: number; vy: number; phase: number; drift: number }
type Ripple = { x: number; y: number; r: number; life: number }
type Weed = { x: number; height: number; width: number; blades: number; phase: number; sway: number; depth: number }
type Pebble = { x: number; y: number; rx: number; ry: number; tone: number }
type Mote = { x: number; y: number; r: number; vy: number; phase: number; alpha: number }

/** 六种配色，模拟常见的观赏鱼（小丑鱼带白条纹） */
const FISH_KINDS = [
  { body: '#fb923c', belly: '#fed7aa', fin: '#f97316', stripe: '#fffbeb', outline: 'rgba(124,45,18,.30)' },
  { body: '#3b82f6', belly: '#93c5fd', fin: '#facc15', stripe: '', outline: 'rgba(15,23,42,.30)' },
  { body: '#fbbf24', belly: '#fef3c7', fin: '#f59e0b', stripe: '', outline: 'rgba(120,53,15,.28)' },
  { body: '#34d399', belly: '#bbf7d0', fin: '#10b981', stripe: '', outline: 'rgba(6,78,59,.30)' },
  { body: '#fb7185', belly: '#fecdd3', fin: '#f43f5e', stripe: '', outline: 'rgba(76,5,25,.28)' },
  { body: '#cbd5e1', belly: '#f8fafc', fin: '#94a3b8', stripe: '', outline: 'rgba(15,23,42,.24)' },
]

const WEED_TINTS = [
  ['rgba(45,212,191,', 'rgba(13,148,136,'],
  ['rgba(74,222,128,', 'rgba(22,163,74,'],
  ['rgba(125,211,252,', 'rgba(14,165,233,'],
]

export default function FishTank() {
  const hostRef = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const host = hostRef.current
    const canvas = canvasRef.current
    if (!host || !canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches

    let w = 0
    let h = 0
    let dpr = 1
    let raf = 0
    let last = 0
    let time = 0

    let fish: Fish[] = []
    let bubbles: Bubble[] = []
    let ripples: Ripple[] = []
    let weeds: Weed[] = []
    let pebbles: Pebble[] = []
    let motes: Mote[] = []

    const rand = (a: number, b: number) => a + Math.random() * (b - a)
    const pointer = { x: -9999, y: -9999 }

    /**
     * 鱼的巡游高度。桌面端整个水体都可以去；窄屏上登录卡占掉中间一大块，
     * 就让鱼待在上/下两条水带里，免得全被卡片挡住。
     */
    const pickTy = (): number => {
      if (w >= 720) return rand(h * 0.12, h * 0.76)
      return Math.random() < 0.55 ? rand(52, h * 0.2) : rand(h * 0.74, h * 0.8)
    }

    // ── 场景初始化 ─────────────────────────────────────────
    const seedScene = () => {
      const scale = Math.min(1.15, Math.max(0.6, w / 1200))
      const fishCount = Math.round(Math.min(15, Math.max(7, (w * h) / 62000)))
      fish = Array.from({ length: fishCount }, (_, i) => {
        const far = i % 4 === 3
        const len = rand(28, 52) * scale * (far ? 0.74 : 1)
        return {
          x: rand(w * 0.15, w * 0.85),
          y: pickTy(),
          dir: i % 2 === 0 ? 1 : -1,
          speed: rand(22, 52) * scale * (far ? 0.8 : 1),
          vy: rand(-4, 4),
          ty: pickTy(),
          len,
          kind: i % FISH_KINDS.length,
          phase: rand(0, Math.PI * 2),
          far,
        }
      })

      const bubbleCount = Math.round(Math.min(34, Math.max(12, w / 40)))
      bubbles = Array.from({ length: bubbleCount }, () => ({
        x: Math.random() * w,
        y: Math.random() * h,
        r: rand(2, 6.5) * Math.min(1.2, Math.max(0.7, w / 1400)),
        vy: rand(16, 46),
        phase: rand(0, Math.PI * 2),
        drift: rand(4, 16),
      }))

      const weedCount = Math.round(Math.min(15, Math.max(6, w / 105)))
      weeds = Array.from({ length: weedCount }, () => ({
        x: Math.random() * w,
        height: rand(70, 230) * Math.min(1.1, Math.max(0.62, h / 900)),
        width: rand(5, 11),
        blades: Math.round(rand(3, 5)),
        phase: rand(0, Math.PI * 2),
        sway: rand(14, 40),
        depth: Math.random() < 0.45 ? 0.32 : 0.62,
      }))

      pebbles = Array.from({ length: Math.round(w / 60) }, () => ({
        x: Math.random() * w,
        y: h * 0.9 + Math.random() * h * 0.09,
        rx: rand(5, 17),
        ry: rand(3, 8),
        tone: rand(0, 1),
      }))

      const moteCount = Math.round(Math.min(70, Math.max(24, (w * h) / 24000)))
      motes = Array.from({ length: moteCount }, () => ({
        x: Math.random() * w,
        y: Math.random() * h * 0.9,
        r: rand(0.6, 1.9),
        vy: rand(-6, -1.5),
        phase: rand(0, Math.PI * 2),
        alpha: rand(0.08, 0.3),
      }))

      ripples = []
    }

    // ── 绘制：水体 ─────────────────────────────────────────
    const drawWater = () => {
      const g = ctx.createLinearGradient(0, 0, 0, h)
      g.addColorStop(0, '#12657a')
      g.addColorStop(0.22, '#0c4b5e')
      g.addColorStop(0.6, '#07303e')
      g.addColorStop(1, '#03141c')
      ctx.fillStyle = g
      ctx.fillRect(0, 0, w, h)

      // 左上射入的主光团
      const glow = ctx.createRadialGradient(w * 0.28, -h * 0.12, 0, w * 0.28, -h * 0.12, h * 1.05)
      glow.addColorStop(0, 'rgba(125,245,225,0.22)')
      glow.addColorStop(0.5, 'rgba(94,234,212,0.06)')
      glow.addColorStop(1, 'rgba(94,234,212,0)')
      ctx.fillStyle = glow
      ctx.fillRect(0, 0, w, h)
    }

    // 水面：顶部几道缓慢起伏的波纹
    const drawSurface = () => {
      ctx.save()
      const band = ctx.createLinearGradient(0, 0, 0, h * 0.14)
      band.addColorStop(0, 'rgba(190,255,248,0.16)')
      band.addColorStop(1, 'rgba(190,255,248,0)')
      ctx.fillStyle = band
      ctx.fillRect(0, 0, w, h * 0.14)
      ctx.lineWidth = 1.4
      for (let i = 0; i < 3; i++) {
        ctx.beginPath()
        ctx.strokeStyle = `rgba(214,255,251,${0.13 - i * 0.035})`
        for (let x = 0; x <= w; x += 12) {
          const y =
            8 + i * 13 + Math.sin(x * 0.011 + time * 0.8 + i * 1.4) * (5 - i) + Math.sin(x * 0.004 - time * 0.5) * 3
          if (x === 0) ctx.moveTo(x, y)
          else ctx.lineTo(x, y)
        }
        ctx.stroke()
      }
      ctx.restore()
    }

    // 光柱：预渲染到半分辨率图层再模糊放大，边缘柔和，也不占每帧的路径开销
    let rayLayer: HTMLCanvasElement | null = null
    const buildRays = () => {
      if (!rayLayer) rayLayer = document.createElement('canvas')
      rayLayer.width = Math.max(1, Math.round(w / 2))
      rayLayer.height = Math.max(1, Math.round(h / 2))
      const rc = rayLayer.getContext('2d')
      if (!rc) return
      rc.setTransform(1, 0, 0, 1, 0, 0)
      rc.clearRect(0, 0, rayLayer.width, rayLayer.height)
      rc.scale(0.5, 0.5)
      // 半分辨率上 7px ≈ 屏幕 14px，用作光柱的柔边
      rc.filter = 'blur(7px)'
      for (let i = 0; i < 5; i++) {
        const x = w * (0.1 + i * 0.2)
        const topW = 30 + i * 10
        const botW = 150 + i * 30
        const g = rc.createLinearGradient(x, 0, x + botW * 0.3, h * 0.95)
        g.addColorStop(0, 'rgba(198,255,248,0.20)')
        g.addColorStop(0.42, 'rgba(170,248,238,0.09)')
        g.addColorStop(1, 'rgba(170,248,238,0)')
        rc.beginPath()
        rc.moveTo(x - topW * 0.5, -20)
        rc.lineTo(x + topW * 0.5, -20)
        rc.lineTo(x + botW * 0.5 + 80, h + 20)
        rc.lineTo(x - botW * 0.5 + 80, h + 20)
        rc.closePath()
        rc.fillStyle = g
        rc.fill()
      }
      rc.filter = 'none'
    }

    const drawRays = () => {
      if (!rayLayer) return
      // 整层做极缓慢的横向漂移，像水面被风吹动
      const dx = Math.sin(time * 0.13) * 18
      const dy = Math.cos(time * 0.1) * 8
      ctx.save()
      ctx.globalAlpha = 0.95
      ctx.drawImage(rayLayer, dx - 40, dy - 20, w + 80, h + 40)
      ctx.restore()
    }

    const drawMotes = () => {
      for (const m of motes) {
        ctx.beginPath()
        ctx.arc(m.x, m.y, m.r, 0, Math.PI * 2)
        ctx.fillStyle = `rgba(206,250,246,${m.alpha})`
        ctx.fill()
      }
    }

    // 沙床 + 卵石
    const drawSand = () => {
      const baseY = h * 0.885
      ctx.beginPath()
      ctx.moveTo(0, h)
      ctx.lineTo(0, baseY + Math.sin(1) * 6)
      for (let x = 0; x <= w; x += 10) {
        const y = baseY + Math.sin(x * 0.008 + 0.6) * 9 + Math.sin(x * 0.021 + 2.1) * 4
        ctx.lineTo(x, y)
      }
      ctx.lineTo(w, h)
      ctx.closePath()
      const g = ctx.createLinearGradient(0, baseY - 10, 0, h)
      g.addColorStop(0, '#2f463c')
      g.addColorStop(0.45, '#22362f')
      g.addColorStop(1, '#101d1a')
      ctx.fillStyle = g
      ctx.fill()

      // 沙面的一层微光
      ctx.beginPath()
      for (let x = 0; x <= w; x += 10) {
        const y = baseY + Math.sin(x * 0.008 + 0.6) * 9 + Math.sin(x * 0.021 + 2.1) * 4
        if (x === 0) ctx.moveTo(x, y)
        else ctx.lineTo(x, y)
      }
      ctx.strokeStyle = 'rgba(178,235,214,0.18)'
      ctx.lineWidth = 1.2
      ctx.stroke()

      for (const p of pebbles) {
        ctx.beginPath()
        ctx.ellipse(p.x, p.y, p.rx, p.ry, 0, 0, Math.PI * 2)
        const tone = Math.round(96 + p.tone * 60)
        ctx.fillStyle = `rgba(${tone},${tone + 8},${tone - 4},0.45)`
        ctx.fill()
      }
    }

    // 水草：几条带弧度的叶片，顶端随时间摆动
    const drawWeeds = () => {
      for (const weed of weeds) {
        const bottom = h * 0.9
        const [c1, c2] = WEED_TINTS[Math.round(weed.x) % WEED_TINTS.length]
        ctx.save()
        ctx.globalAlpha = weed.depth
        for (let b = 0; b < weed.blades; b++) {
          const bx = weed.x + (b - (weed.blades - 1) / 2) * weed.width * 1.15
          const lean = (b - (weed.blades - 1) / 2) * 0.3
          const bh = weed.height * (0.72 + 0.28 * Math.sin(b * 1.7 + weed.phase))
          const swayAmt = weed.sway * (0.7 + 0.3 * Math.sin(time * 1.05 + weed.phase + b * 0.8))
          const tipX = bx + swayAmt + lean * 26
          const midX = bx + swayAmt * 0.32 + lean * 12
          ctx.beginPath()
          ctx.moveTo(bx - weed.width * 0.5, bottom)
          ctx.quadraticCurveTo(midX - weed.width * 0.32, bottom - bh * 0.55, tipX, bottom - bh)
          ctx.quadraticCurveTo(midX + weed.width * 0.34, bottom - bh * 0.55, bx + weed.width * 0.5, bottom)
          ctx.closePath()
          ctx.fillStyle = `${b % 2 ? c1 : c2}${0.5 + 0.18 * Math.sin(time * 0.9 + b)})`
          ctx.fill()
        }
        ctx.restore()
      }
    }

    const drawBubbles = () => {
      for (const b of bubbles) {
        ctx.beginPath()
        ctx.arc(b.x, b.y, b.r, 0, Math.PI * 2)
        ctx.fillStyle = 'rgba(198,246,255,0.13)'
        ctx.fill()
        ctx.strokeStyle = 'rgba(226,255,255,0.42)'
        ctx.lineWidth = 1
        ctx.stroke()
        // 高光
        ctx.beginPath()
        ctx.arc(b.x - b.r * 0.32, b.y - b.r * 0.34, Math.max(0.6, b.r * 0.24), 0, Math.PI * 2)
        ctx.fillStyle = 'rgba(255,255,255,0.7)'
        ctx.fill()
      }
    }

    // 一条鱼：身体 / 尾鳍 / 背鳍 / 腹鳍 / 白条纹 / 眼睛
    const drawFish = (f: Fish, t: number) => {
      const k = FISH_KINDS[f.kind]
      const L = f.len
      const H = L * 0.52
      const wag = Math.sin(f.phase * 2)

      ctx.save()
      ctx.translate(f.x, f.y + Math.sin(t * 1.9 + f.phase) * 1.6)
      ctx.scale(f.dir, 1)
      if (f.far) ctx.globalAlpha = 0.55

      // 尾鳍
      ctx.beginPath()
      ctx.moveTo(-L * 0.3, 0)
      ctx.quadraticCurveTo(-L * 0.5, -H * 0.36 + wag * H * 0.3, -L * 0.66, -H * 0.5 + wag * H * 0.48)
      ctx.quadraticCurveTo(-L * 0.44, 0, -L * 0.66, H * 0.5 + wag * H * 0.48)
      ctx.quadraticCurveTo(-L * 0.5, H * 0.36 + wag * H * 0.3, -L * 0.3, 0)
      ctx.closePath()
      ctx.fillStyle = k.fin
      ctx.fill()

      // 背鳍
      ctx.beginPath()
      ctx.moveTo(-L * 0.14, -H * 0.42)
      ctx.quadraticCurveTo(-L * 0.02, -H * 1.02, L * 0.2, -H * 0.34)
      ctx.closePath()
      ctx.fillStyle = k.fin
      ctx.fill()

      // 腹鳍
      ctx.beginPath()
      ctx.moveTo(-L * 0.02, H * 0.4)
      ctx.quadraticCurveTo(L * 0.06, H * 0.92, L * 0.2, H * 0.3)
      ctx.closePath()
      ctx.fillStyle = k.fin
      ctx.fill()

      // 身体
      const bodyPath = () => {
        ctx.beginPath()
        ctx.moveTo(L * 0.5, 0)
        ctx.bezierCurveTo(L * 0.24, -H * 0.62, -L * 0.12, -H * 0.56, -L * 0.33, 0)
        ctx.bezierCurveTo(-L * 0.12, H * 0.56, L * 0.24, H * 0.62, L * 0.5, 0)
        ctx.closePath()
      }
      bodyPath()
      const bg = ctx.createLinearGradient(0, -H * 0.6, 0, H * 0.6)
      bg.addColorStop(0, k.body)
      bg.addColorStop(1, k.belly)
      ctx.fillStyle = bg
      ctx.fill()
      ctx.strokeStyle = k.outline
      ctx.lineWidth = 1
      ctx.stroke()

      // 小丑鱼的白条纹（裁在身体里）
      if (k.stripe) {
        ctx.save()
        bodyPath()
        ctx.clip()
        ctx.fillStyle = k.stripe
        ctx.globalAlpha = 0.85
        ctx.translate(L * 0.12, 0)
        ctx.rotate(0.32)
        ctx.fillRect(-L * 0.05, -H, L * 0.085, H * 2)
        ctx.fillRect(L * 0.17, -H, L * 0.07, H * 2)
        ctx.restore()
      }

      // 眼睛
      const ex = L * 0.33
      const ey = -H * 0.14
      ctx.beginPath()
      ctx.arc(ex, ey, Math.max(1.5, L * 0.048), 0, Math.PI * 2)
      ctx.fillStyle = '#0a1a20'
      ctx.fill()
      ctx.beginPath()
      ctx.arc(ex + Math.max(0.5, L * 0.012), ey - Math.max(0.5, L * 0.016), Math.max(0.6, L * 0.017), 0, Math.PI * 2)
      ctx.fillStyle = 'rgba(255,255,255,0.9)'
      ctx.fill()

      ctx.restore()
    }

    const drawRipples = () => {
      for (const r of ripples) {
        ctx.beginPath()
        ctx.arc(r.x, r.y, r.r, 0, Math.PI * 2)
        ctx.strokeStyle = `rgba(226,255,252,${r.life * 0.5})`
        ctx.lineWidth = 1.6
        ctx.stroke()
        ctx.beginPath()
        ctx.arc(r.x, r.y, r.r * 0.72, 0, Math.PI * 2)
        ctx.strokeStyle = `rgba(226,255,252,${r.life * 0.22})`
        ctx.lineWidth = 1
        ctx.stroke()
      }
    }

    const render = () => {
      ctx.clearRect(0, 0, w, h)
      drawWater()
      drawSurface()
      drawRays()
      drawMotes()
      drawSand()
      drawWeeds()
      drawBubbles()
      for (const f of fish) drawFish(f, time)
      drawRipples()
    }

    // ── 状态推进 ───────────────────────────────────────────
    const update = (dt: number) => {
      const padX = 44
      for (const f of fish) {
        // 垂直方向：慢慢游向目标高度
        f.vy += ((f.ty - f.y) * 1.1 - f.vy * 1.5) * dt

        // 躲鼠标
        const dx = f.x - pointer.x
        const dy = f.y - pointer.y
        const dist2 = dx * dx + dy * dy
        if (dist2 < 175 * 175) {
          const d = Math.sqrt(dist2) || 1
          const push = (1 - d / 175) * 260
          f.vy += (dy / d) * push * dt
          f.x += (dx / d) * push * 0.4 * dt
          if (d < 95 && Math.sign(pointer.x - f.x) === f.dir) f.dir = f.dir === 1 ? -1 : 1
        }

        f.x += f.dir * f.speed * dt
        f.y += f.vy * dt
        f.x = Math.min(w - 24, Math.max(24, f.x))

        if (f.x <= padX) f.dir = 1
        else if (f.x >= w - padX) f.dir = -1
        if (f.y < 46) {
          f.y = 46
          f.vy = Math.abs(f.vy) * 0.5
        } else if (f.y > h * 0.82) {
          f.y = h * 0.82
          f.vy = -Math.abs(f.vy) * 0.5
        }

        f.phase += dt * (2.2 + f.speed / 90)
        if (Math.random() < dt * 0.28) f.ty = pickTy()
      }

      for (const b of bubbles) {
        b.y -= b.vy * dt
        b.x += Math.sin(time * 1.7 + b.phase) * b.drift * dt
        if (b.y < -20 || b.x < -20 || b.x > w + 20) {
          b.y = h + rand(0, 40)
          b.x = rand(0, w)
          b.phase = rand(0, Math.PI * 2)
        }
      }

      for (const m of motes) {
        m.y += m.vy * dt
        m.x += Math.sin(time * 0.6 + m.phase) * 4 * dt
        if (m.y < -6) {
          m.y = h * 0.9
          m.x = rand(0, w)
        }
      }

      for (let i = ripples.length - 1; i >= 0; i--) {
        const r = ripples[i]
        r.r += 130 * dt
        r.life -= dt * 0.85
        if (r.life <= 0) ripples.splice(i, 1)
      }
    }

    // ── 尺寸 ───────────────────────────────────────────────
    const resize = () => {
      const rect = host.getBoundingClientRect()
      const nextW = Math.max(1, Math.round(rect.width))
      const nextH = Math.max(1, Math.round(rect.height))
      if (nextW === w && nextH === h) return
      w = nextW
      h = nextH
      dpr = Math.min(window.devicePixelRatio || 1, 2)
      canvas.width = Math.round(w * dpr)
      canvas.height = Math.round(h * dpr)
      canvas.style.width = `${w}px`
      canvas.style.height = `${h}px`
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      // 尺寸变了就按新画布重铺场景（鱼群/水草位置都是相对比例算的）
      seedScene()
      buildRays()
      if (reduce) render()
    }

    // ── 交互 ───────────────────────────────────────────────
    const onPointerMove = (e: PointerEvent) => {
      const rect = host.getBoundingClientRect()
      pointer.x = e.clientX - rect.left
      pointer.y = e.clientY - rect.top
    }
    const onPointerLeave = () => {
      pointer.x = -9999
      pointer.y = -9999
    }
    const onPointerDown = (e: PointerEvent) => {
      const rect = host.getBoundingClientRect()
      const x = e.clientX - rect.left
      const y = e.clientY - rect.top
      ripples.push({ x, y, r: 6, life: 1 })
      for (let i = 0; i < 7; i++) {
        bubbles.push({
          x: x + rand(-16, 16),
          y: y + rand(-6, 6),
          r: rand(2, 5.5),
          vy: rand(30, 70),
          phase: rand(0, Math.PI * 2),
          drift: rand(6, 18),
        })
      }
      // 气泡数量兜底，避免频繁点击越来越卡
      if (bubbles.length > 90) bubbles.splice(0, bubbles.length - 90)
    }

    // ── 主循环 ─────────────────────────────────────────────
    const frame = (ts: number) => {
      if (!last) last = ts
      let dt = (ts - last) / 1000
      last = ts
      dt = Math.min(dt, 0.05)
      time += dt
      update(dt)
      render()
      raf = requestAnimationFrame(frame)
    }

    resize()
    const ro = new ResizeObserver(resize)
    ro.observe(host)

    if (reduce) {
      time = 0.7
      render()
    } else {
      raf = requestAnimationFrame(frame)
    }

    window.addEventListener('pointermove', onPointerMove, { passive: true })
    window.addEventListener('pointerdown', onPointerMove, { passive: true })
    host.addEventListener('pointerleave', onPointerLeave)
    host.addEventListener('pointerdown', onPointerDown)

    const onVisibility = () => {
      if (document.hidden) {
        cancelAnimationFrame(raf)
        raf = 0
      } else if (!reduce && !raf) {
        last = 0
        raf = requestAnimationFrame(frame)
      }
    }
    document.addEventListener('visibilitychange', onVisibility)

    return () => {
      cancelAnimationFrame(raf)
      ro.disconnect()
      document.removeEventListener('visibilitychange', onVisibility)
      window.removeEventListener('pointermove', onPointerMove)
      window.removeEventListener('pointerdown', onPointerMove)
      host.removeEventListener('pointerleave', onPointerLeave)
      host.removeEventListener('pointerdown', onPointerDown)
    }
  }, [])

  return (
    <div className="lock-tank" ref={hostRef} aria-hidden="true">
      <canvas ref={canvasRef} />
    </div>
  )
}
