import { useEffect, useRef, useState } from 'react'

// 宠物形象池（emoji，零资源、轻量、可爱）
const PETS = ['🐱', '🐶', '🐲', '🐰', '🦊', '🐼']
// 点击/互动时的俏皮话
const LINES = [
  '喵~ 来玩呀！',
  '今天也要加油写博客哦 💪',
  '你发现我啦 🎉',
  '摸摸头~',
  '注意休息，别太累啦',
  '坚持更新就有人看 😉',
  '代码写累了？摸我回血~',
]

export default function FloatingPet() {
  const reduced = useRef(
    typeof window !== 'undefined' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches
  ).current

  const [emoji, setEmoji] = useState(PETS[0])
  const [visible, setVisible] = useState(!reduced)
  const [left, setLeft] = useState(-100) // 宠物水平像素位置（absolute left）
  const [facing, setFacing] = useState<'left' | 'right'>('left') // 朝向：决定镜像翻转
  const [phase, setPhase] = useState<'walk' | 'idle' | 'hidden'>(
    reduced ? 'idle' : 'hidden'
  )
  const [bubble, setBubble] = useState<string | null>(null)
  const [happy, setHappy] = useState(false)

  const timers = useRef<number[]>([])
  const clearTimers = () => {
    timers.current.forEach((t) => clearTimeout(t))
    timers.current = []
  }
  const later = (fn: () => void, ms: number) => {
    const id = window.setTimeout(fn, ms)
    timers.current.push(id)
  }

  // 计算内容容器（.container）左右外缘，宠物停在边缘外侧一点
  const edges = (): { left: number; right: number } => {
    const c = document.querySelector('.container') as HTMLElement | null
    const vw = window.innerWidth
    if (!c) return { left: 12, right: vw - 72 }
    const r = c.getBoundingClientRect()
    return {
      left: Math.max(8, r.left - 52),
      right: Math.max(72, r.right - 20),
    }
  }

  const popBubble = () => {
    setBubble(LINES[Math.floor(Math.random() * LINES.length)])
    later(() => setBubble(null), 2600)
  }

  // 离开：往指定方向走回视口外，走完隐藏并安排下一次出现
  const leave = (exitSide: 'left' | 'right') => {
    setPhase('walk')
    setFacing(exitSide)
    setLeft(exitSide === 'left' ? -100 : window.innerWidth - 40)
    later(() => {
      setVisible(false)
      setBubble(null)
      schedule()
    }, 1500)
  }

  // 出现：随机从左侧或右侧视口外走入容器边缘
  const appear = () => {
    const e = edges()
    const fromLeft = Math.random() < 0.5
    setEmoji(PETS[Math.floor(Math.random() * PETS.length)])
    setFacing(fromLeft ? 'right' : 'left')
    setPhase('walk')
    setLeft(fromLeft ? -100 : window.innerWidth - 40)
    setVisible(true)
    // 两帧后再移动到容器边缘，触发 CSS transition 走路动画
    requestAnimationFrame(() =>
      requestAnimationFrame(() => setLeft(fromLeft ? e.left : e.right))
    )
    // 停留 6~10 秒后离开
    later(() => leave(fromLeft ? 'left' : 'right'), 6000 + Math.random() * 4000)
  }

  // 安排下一次自动出现（减少动态偏好下不自动游走）
  const schedule = () => {
    if (reduced) return
    later(appear, 12000 + Math.random() * 20000) // 12~32 秒后
  }

  useEffect(() => {
    if (reduced) {
      // 减少动态：常驻容器右侧外缘、静态可点，不自动游走
      const e = edges()
      setLeft(e.right)
      setFacing('left')
      setPhase('idle')
      setVisible(true) // 修复：reduced 下也要显示，否则永远 return null
      return () => clearTimers()
    }
    // 首次出现缩短到约 1.5 秒，让用户加载后即能看到；之后由 leave→schedule 循环 12~32s
    later(appear, 1500)
    return () => clearTimers()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reduced])

  const onClick = () => {
    setHappy(true)
    later(() => setHappy(false), 500)
    popBubble()
  }

  if (!visible) return null

  return (
    <div className="pet-layer" aria-hidden="true">
      <button
        type="button"
        className={`pet ${phase}${happy ? ' happy' : ''}`}
        style={{ left: `${left}px` }}
        onClick={onClick}
        title="摸摸我"
      >
        {bubble && <span className="pet-bubble">{bubble}</span>}
        <span
          className="pet-flip"
          style={{ transform: facing === 'left' ? 'scaleX(-1)' : 'none' }}
        >
          <span className="pet-body">{emoji}</span>
        </span>
      </button>
    </div>
  )
}
