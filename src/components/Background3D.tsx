import { useEffect, useRef } from 'react'
import {
  Scene,
  PerspectiveCamera,
  WebGLRenderer,
  BufferGeometry,
  Float32BufferAttribute,
  PointsMaterial,
  Points,
  Color,
  CanvasTexture,
  AdditiveBlending,
} from 'three'
import type { BgTheme } from '../lib/themes'

/**
 * 生成柔光圆形贴图（白心→透明边缘），用作粒子点精灵，
 * 让 Points 渲染成圆点而非默认方块。
 */
function createCircleTexture(): CanvasTexture {
  const size = 64
  const canvas = document.createElement('canvas')
  canvas.width = canvas.height = size
  const ctx = canvas.getContext('2d')!
  const g = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2)
  g.addColorStop(0, 'rgba(255,255,255,1)')
  g.addColorStop(0.35, 'rgba(255,255,255,0.85)')
  g.addColorStop(1, 'rgba(255,255,255,0)')
  ctx.fillStyle = g
  ctx.fillRect(0, 0, size, size)
  const tex = new CanvasTexture(canvas)
  tex.needsUpdate = true
  return tex
}

/**
 * 全屏 3D 粒子星河背景（主题可切换，见 src/lib/themes.ts）。
 * - fixed 定位、z-index:-1、pointer-events:none，始终位于内容层之下，不拦截任何交互。
 * - 粒子配色 / 尺寸 / 页面深空底色均由传入的 theme 决定；整体缓慢自转 + 鼠标视差。
 * - 尊重 prefers-reduced-motion：开启时只渲染一帧静态画面，不启动动画循环（无障碍/省电）。
 * - 移动端自动降低粒子数；theme 变化时重建场景；卸载时 dispose 所有 GPU 资源，避免内存泄漏。
 */
export default function Background3D({ theme }: { theme: BgTheme }) {
  const mountRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const mount = mountRef.current
    if (!mount) return

    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const isMobile = window.innerWidth < 768

    const scene = new Scene()
    const camera = new PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 1000)
    camera.position.z = 60

    const renderer = new WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'high-performance' })
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    renderer.setSize(window.innerWidth, window.innerHeight)
    renderer.setClearColor(0x000000, 0) // 透明：露出 body 的深空底色
    mount.appendChild(renderer.domElement)
    // 应用主题的深空底色（canvas 透明处透出），无 JS 时由 CSS 兜底
    document.body.style.background = theme.bodyBg

    // 球形分布 + 主题配色
    const COUNT = isMobile ? 900 : 2200
    const positions = new Float32Array(COUNT * 3)
    const colors = new Float32Array(COUNT * 3)
    const c = new Color()
    for (let i = 0; i < COUNT; i++) {
      const r = 40 + Math.random() * 60
      const theta = Math.random() * Math.PI * 2
      const phi = Math.acos(2 * Math.random() - 1)
      positions[i * 3] = r * Math.sin(phi) * Math.cos(theta)
      positions[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta)
      positions[i * 3 + 2] = r * Math.cos(phi) - 20
      c.setHSL(
        theme.hue[0] + Math.random() * (theme.hue[1] - theme.hue[0]),
        theme.sat,
        theme.light[0] + Math.random() * (theme.light[1] - theme.light[0])
      )
      colors[i * 3] = c.r
      colors[i * 3 + 1] = c.g
      colors[i * 3 + 2] = c.b
    }
    const geometry = new BufferGeometry()
    geometry.setAttribute('position', new Float32BufferAttribute(positions, 3))
    geometry.setAttribute('color', new Float32BufferAttribute(colors, 3))

    const sprite = createCircleTexture()
    const material = new PointsMaterial({
      size: theme.size,
      sizeAttenuation: true,
      vertexColors: true,
      map: sprite,
      alphaMap: sprite,
      transparent: true,
      opacity: 0.9,
      depthWrite: false,
      blending: AdditiveBlending,
    })
    const points = new Points(geometry, material)
    scene.add(points)

    // 鼠标视差：相机随光标轻微位移
    const target = { x: 0, y: 0 }
    const current = { x: 0, y: 0 }
    const onMouseMove = (e: MouseEvent) => {
      target.x = (e.clientX / window.innerWidth - 0.5) * 0.6
      target.y = (e.clientY / window.innerHeight - 0.5) * 0.6
    }
    window.addEventListener('mousemove', onMouseMove)

    const onResize = () => {
      camera.aspect = window.innerWidth / window.innerHeight
      camera.updateProjectionMatrix()
      renderer.setSize(window.innerWidth, window.innerHeight)
    }
    window.addEventListener('resize', onResize)

    let raf = 0
    let t = 0
    const renderFrame = () => {
      t += 0.0025
      points.rotation.y = t
      points.rotation.x = Math.sin(t * 0.5) * 0.15
      current.x += (target.x - current.x) * 0.04
      current.y += (target.y - current.y) * 0.04
      camera.position.x = current.x * 20
      camera.position.y = -current.y * 20
      camera.lookAt(scene.position)
      renderer.render(scene, camera)
      raf = requestAnimationFrame(renderFrame)
    }

    if (reduceMotion) {
      renderer.render(scene, camera)
    } else {
      raf = requestAnimationFrame(renderFrame)
    }

    return () => {
      cancelAnimationFrame(raf)
      window.removeEventListener('mousemove', onMouseMove)
      window.removeEventListener('resize', onResize)
      geometry.dispose()
      material.dispose()
      sprite.dispose()
      renderer.dispose()
      if (renderer.domElement.parentNode === mount) mount.removeChild(renderer.domElement)
    }
  }, [theme])

  return <div ref={mountRef} className="bg3d" aria-hidden="true" />
}
