import { useEffect, useRef } from 'react'
import type { BgTheme } from '../lib/themes'

/**
 * 点击效果叠加层（Canvas 2D，fixed 全屏，pointer-events:none，不拦截交互）：
 * 点击处涟漪扩散环 + 彩色粒子迸发，随后淡出。配色跟随当前背景主题色相。
 * 仅在有点击效果运行时才启动动画循环，空闲时不占 CPU。
 * 尊重 prefers-reduced-motion：开启时不生成粒子，仅保留短暂的扩散涟漪。
 */
export default function CursorFX({ theme }: { theme: BgTheme }) {
  const ref = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = ref.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')!
    const dpr = Math.min(window.devicePixelRatio, 2)
    let W = 0
    let H = 0

    const resize = () => {
      W = window.innerWidth
      H = window.innerHeight
      canvas.width = W * dpr
      canvas.height = H * dpr
      canvas.style.width = `${W}px`
      canvas.style.height = `${H}px`
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    }
    resize()

    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const hue = (theme.hue[0] + theme.hue[1]) / 2

    const particles: {
      x: number; y: number; vx: number; vy: number; life: number; max: number; hue: number
    }[] = []
    const ripples: { x: number; y: number; start: number }[] = []
    let raf = 0

    const spawn = (e: PointerEvent) => {
      ripples.push({ x: e.clientX, y: e.clientY, start: performance.now() })
      if (!reduce) {
        const n = 16
        for (let i = 0; i < n; i++) {
          const a = (Math.PI * 2 * i) / n + Math.random() * 0.4
          const sp = 2 + Math.random() * 4.5
          particles.push({
            x: e.clientX,
            y: e.clientY,
            vx: Math.cos(a) * sp,
            vy: Math.sin(a) * sp,
            life: 0,
            max: 0.7 + Math.random() * 0.4,
            hue: hue + (Math.random() * 40 - 20),
          })
        }
      }
      // 有活动效果时才跑循环；全部结束后自动停止（见 renderLoop 收尾）
      if (raf === 0) raf = requestAnimationFrame(renderLoop)
    }

    const renderLoop = () => {
      ctx.clearRect(0, 0, W, H)
      const now = performance.now()

      // 点击涟漪
      for (let i = ripples.length - 1; i >= 0; i--) {
        const r = ripples[i]
        const age = (now - r.start) / 650
        if (age >= 1) {
          ripples.splice(i, 1)
          continue
        }
        ctx.strokeStyle = `hsla(${hue}, 90%, 75%, ${0.6 * (1 - age)})`
        ctx.lineWidth = 2 * (1 - age) + 0.5
        ctx.beginPath()
        ctx.arc(r.x, r.y, 8 + age * 70, 0, Math.PI * 2)
        ctx.stroke()
      }

      // 粒子迸发
      for (let i = particles.length - 1; i >= 0; i--) {
        const p = particles[i]
        p.life += 0.016
        if (p.life >= p.max) {
          particles.splice(i, 1)
          continue
        }
        p.x += p.vx
        p.y += p.vy
        p.vx *= 0.93
        p.vy *= 0.93
        p.vy += 0.06
        ctx.fillStyle = `hsla(${p.hue}, 90%, 72%, ${1 - p.life / p.max})`
        ctx.beginPath()
        ctx.arc(p.x, p.y, 2.6, 0, Math.PI * 2)
        ctx.fill()
      }

      // 所有效果结束则停止循环，空闲不占 CPU
      if (ripples.length === 0 && particles.length === 0) {
        raf = 0
        return
      }
      raf = requestAnimationFrame(renderLoop)
    }

    window.addEventListener('pointerdown', spawn)
    window.addEventListener('resize', resize)

    return () => {
      cancelAnimationFrame(raf)
      window.removeEventListener('pointerdown', spawn)
      window.removeEventListener('resize', resize)
    }
  }, [theme])

  return <canvas ref={ref} className="cursor-fx" aria-hidden="true" />
}
