import { useEffect, useRef } from 'react'
import * as THREE from 'three'
import { OrbitControls } from 'three/addons/controls/OrbitControls.js'
import { GALLERY_PROJECTS, type GalleryProject } from '../lib/gallery'

// ── 画框封面贴图 ─────────────────────────────────────────
// 用 canvas 生成（渐变底 + 标题 + 技术栈 + 提示），零图片资源依赖；
// 想换真实截图时，把这里换成 TextureLoader 加载图片即可。
function makeCoverTexture(p: GalleryProject): THREE.CanvasTexture {
  const W = 1024
  const H = 640
  const c = document.createElement('canvas')
  c.width = W
  c.height = H
  const ctx = c.getContext('2d')!

  const g = ctx.createLinearGradient(0, 0, W, H)
  g.addColorStop(0, p.colors[0])
  g.addColorStop(1, p.colors[1])
  ctx.fillStyle = g
  ctx.fillRect(0, 0, W, H)

  // 背景装饰圆
  ctx.globalAlpha = 0.12
  ctx.fillStyle = '#ffffff'
  ctx.beginPath()
  ctx.arc(W * 0.86, H * 0.18, 180, 0, Math.PI * 2)
  ctx.fill()
  ctx.beginPath()
  ctx.arc(W * 0.08, H * 0.92, 140, 0, Math.PI * 2)
  ctx.fill()
  ctx.globalAlpha = 1

  // 标题（过长时逐级缩字号）
  let fontSize = 72
  ctx.textBaseline = 'middle'
  do {
    ctx.font = `700 ${fontSize}px system-ui, "Microsoft YaHei", sans-serif`
    fontSize -= 4
  } while (ctx.measureText(p.title).width > W - 140 && fontSize > 36)
  ctx.fillStyle = '#ffffff'
  ctx.fillText(p.title, 60, H * 0.44)

  // 技术栈
  ctx.font = '400 30px system-ui, "Microsoft YaHei", sans-serif'
  ctx.fillStyle = 'rgba(255,255,255,0.85)'
  ctx.fillText(p.tech.slice(0, 4).join('  ·  '), 60, H * 0.62)

  // 底部提示
  ctx.font = '400 26px system-ui, "Microsoft YaHei", sans-serif'
  ctx.fillStyle = 'rgba(255,255,255,0.55)'
  ctx.fillText('点击查看项目详情 →', 60, H * 0.82)

  const tex = new THREE.CanvasTexture(c)
  tex.colorSpace = THREE.SRGBColorSpace
  tex.anisotropy = 4
  return tex
}

type Props = {
  /** 点击某个画框时回调（弹出项目详情） */
  onSelect: (p: GalleryProject) => void
}

/**
 * 3D 个人展厅：一间深色画廊，项目以画框挂在后墙与两侧墙上。
 * 鼠标拖拽旋转视角（OrbitControls + 自动慢转），hover 画框放大，点击触发 onSelect。
 */
export default function Gallery3D({ onSelect }: Props) {
  const hostRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const host = hostRef.current
    if (!host) return

    // ── 场景 / 相机 / 渲染器 ──
    const scene = new THREE.Scene()
    scene.background = new THREE.Color(0x0b1020)
    scene.fog = new THREE.Fog(0x0b1020, 12, 28)

    const camera = new THREE.PerspectiveCamera(
      55,
      host.clientWidth / host.clientHeight,
      0.1,
      100,
    )
    camera.position.set(0, 1.8, 5.2)

    const renderer = new THREE.WebGLRenderer({ antialias: true })
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    renderer.setSize(host.clientWidth, host.clientHeight)
    renderer.domElement.style.cursor = 'grab'
    host.appendChild(renderer.domElement)

    const controls = new OrbitControls(camera, renderer.domElement)
    controls.target.set(0, 1.6, -1)
    controls.enableDamping = true
    controls.dampingFactor = 0.06
    controls.enablePan = false
    controls.minDistance = 2.2
    controls.maxDistance = 8
    // 限制俯仰，避免钻到地板下或飞到屋顶上
    controls.minPolarAngle = 0.85
    controls.maxPolarAngle = 1.62
    controls.autoRotate = true
    controls.autoRotateSpeed = 0.5

    // ── 灯光 ──
    scene.add(new THREE.AmbientLight(0xffffff, 0.55))
    const key = new THREE.DirectionalLight(0xffffff, 1.1)
    key.position.set(3, 6, 4)
    scene.add(key)
    const fill = new THREE.PointLight(0x88aaff, 12, 20)
    fill.position.set(-3, 3, 2)
    scene.add(fill)

    const disposables: { dispose(): void }[] = []

    // ── 房间（地板 / 天花 / 三面墙）──
    const room = new THREE.Group()
    const mkMat = (color: number, roughness: number, metalness: number) => {
      const m = new THREE.MeshStandardMaterial({ color, roughness, metalness })
      disposables.push(m)
      return m
    }
    const mkPlane = (w: number, h: number, mat: THREE.Material) => {
      const geo = new THREE.PlaneGeometry(w, h)
      disposables.push(geo)
      return new THREE.Mesh(geo, mat)
    }

    const floor = mkPlane(12, 10, mkMat(0x141a2e, 0.35, 0.55))
    floor.rotation.x = -Math.PI / 2
    room.add(floor)

    const ceil = mkPlane(12, 10, mkMat(0x10152a, 1, 0))
    ceil.rotation.x = Math.PI / 2
    ceil.position.y = 4
    room.add(ceil)

    const backWall = mkPlane(12, 4, mkMat(0x1b2340, 0.9, 0.05))
    backWall.position.set(0, 2, -5)
    room.add(backWall)

    const leftWall = mkPlane(10, 4, mkMat(0x1b2340, 0.9, 0.05))
    leftWall.rotation.y = Math.PI / 2
    leftWall.position.set(-6, 2, 0)
    room.add(leftWall)

    const rightWall = mkPlane(10, 4, mkMat(0x1b2340, 0.9, 0.05))
    rightWall.rotation.y = -Math.PI / 2
    rightWall.position.set(6, 2, 0)
    room.add(rightWall)
    scene.add(room)

    // 顶部长条灯带（纯装饰，自发光）
    for (const x of [-2.5, 2.5]) {
      const lampGeo = new THREE.BoxGeometry(2.2, 0.06, 0.3)
      const lampMat = new THREE.MeshBasicMaterial({ color: 0xcfe0ff })
      const lamp = new THREE.Mesh(lampGeo, lampMat)
      lamp.position.set(x, 3.96, -1)
      scene.add(lamp)
      disposables.push(lampGeo, lampMat)
    }

    // ── 画框：后墙 3 + 左墙 1 + 右墙 1 ──
    const slots = [
      { pos: [-3.4, 2, -4.93], ry: 0 },
      { pos: [0, 2, -4.93], ry: 0 },
      { pos: [3.4, 2, -4.93], ry: 0 },
      { pos: [-5.93, 2, -1.2], ry: Math.PI / 2 },
      { pos: [5.93, 2, -1.2], ry: -Math.PI / 2 },
    ] as const

    const frames: THREE.Group[] = []
    GALLERY_PROJECTS.slice(0, slots.length).forEach((p, i) => {
      const slot = slots[i]
      const group = new THREE.Group()
      group.position.set(slot.pos[0], slot.pos[1], slot.pos[2])
      group.rotation.y = slot.ry

      // 深色木框
      const frameGeo = new THREE.BoxGeometry(2.5, 1.66, 0.07)
      const frameMat = new THREE.MeshStandardMaterial({
        color: 0x2a2218,
        roughness: 0.4,
        metalness: 0.6,
      })
      group.add(new THREE.Mesh(frameGeo, frameMat))

      // 画面（自发光材质：不受灯光影响，文字始终清晰）
      const coverTex = makeCoverTexture(p)
      const coverGeo = new THREE.PlaneGeometry(2.3, 1.46)
      const coverMat = new THREE.MeshBasicMaterial({ map: coverTex })
      const cover = new THREE.Mesh(coverGeo, coverMat)
      cover.position.z = 0.041
      group.add(cover)

      group.userData.project = p
      group.userData.baseY = slot.pos[1]
      scene.add(group)
      frames.push(group)
      disposables.push(frameGeo, frameMat, coverGeo, coverMat, coverTex)
    })

    // ── 拾取（hover 放大 + 点击选择）──
    const raycaster = new THREE.Raycaster()
    const pointer = new THREE.Vector2()
    let hovered: THREE.Group | null = null

    const pick = (clientX: number, clientY: number): THREE.Group | null => {
      const rect = renderer.domElement.getBoundingClientRect()
      pointer.x = ((clientX - rect.left) / rect.width) * 2 - 1
      pointer.y = -((clientY - rect.top) / rect.height) * 2 + 1
      raycaster.setFromCamera(pointer, camera)
      const hits = raycaster.intersectObjects(frames, true)
      if (!hits.length) return null
      let obj: THREE.Object3D | null = hits[0].object
      while (obj && !obj.userData.project) obj = obj.parent
      return obj as THREE.Group | null
    }

    const onMove = (e: PointerEvent) => {
      hovered = pick(e.clientX, e.clientY)
      renderer.domElement.style.cursor = hovered ? 'pointer' : 'grab'
    }
    const onClick = (e: MouseEvent) => {
      const g = pick(e.clientX, e.clientY)
      const p = g?.userData.project as GalleryProject | undefined
      if (p) onSelect(p)
    }
    renderer.domElement.addEventListener('pointermove', onMove)
    renderer.domElement.addEventListener('click', onClick)

    // ── 动画循环 ──
    let raf = 0
    const clock = new THREE.Clock()
    const animate = () => {
      raf = requestAnimationFrame(animate)
      const t = clock.getElapsedTime()
      for (const f of frames) {
        // hover 平滑放大
        const target = f === hovered ? 1.05 : 1
        const s = f.scale.x + (target - f.scale.x) * 0.12
        f.scale.setScalar(s)
        // 极轻微呼吸浮动，增加"活着"的感觉
        f.position.y = f.userData.baseY + Math.sin(t * 1.2 + f.position.x) * 0.012
      }
      controls.update()
      renderer.render(scene, camera)
    }
    animate()

    const onResize = () => {
      const w = host.clientWidth
      const h = host.clientHeight
      if (!w || !h) return
      camera.aspect = w / h
      camera.updateProjectionMatrix()
      renderer.setSize(w, h)
    }
    window.addEventListener('resize', onResize)

    // ── 清理：全部 GPU 资源 dispose，防内存泄漏 ──
    return () => {
      cancelAnimationFrame(raf)
      window.removeEventListener('resize', onResize)
      renderer.domElement.removeEventListener('pointermove', onMove)
      renderer.domElement.removeEventListener('click', onClick)
      controls.dispose()
      disposables.forEach((d) => d.dispose())
      renderer.dispose()
      if (renderer.domElement.parentElement === host) {
        host.removeChild(renderer.domElement)
      }
    }
    // onSelect 来自 useState 的 setter / useCallback，引用稳定，不会导致场景重建
  }, [onSelect])

  return <div className="gallery3d" ref={hostRef} aria-label="3D 项目展厅" />
}
