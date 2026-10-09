import { useEffect, useRef, useState } from 'react'

// 宠物形象池（emoji，零资源、轻量、可爱）
// 每种宠物带自己的专属台词，说话风格跟形象对得上，比共用一套台词更像"活的"
type Pet = { emoji: string; name: string; lines: string[] }

const PETS: Pet[] = [
  { emoji: '🐱', name: '小猫', lines: ['喵~ 来玩呀！', '喵？你在偷偷看我', '呼噜呼噜…'] },
  { emoji: '🐶', name: '小狗', lines: ['汪！', '摇尾巴~ 想出门啦', '球！球！快扔球'] },
  { emoji: '🐲', name: '小龙', lines: ['呼——喷一小口火 🔥', '龙也要写博客', '嗷呜~'] },
  { emoji: '🐰', name: '兔子', lines: ['胡萝卜呢？🥕', '蹦蹦跳~', '耳朵动了动'] },
  { emoji: '🦊', name: '狐狸', lines: ['叮！发现一只狐狸', '今天也狡猾地可爱着', '尾巴扫一扫~'] },
  { emoji: '🐼', name: '熊猫', lines: ['竹子竹子 🎋', '打个滚~', '啃竹子中…'] },
  { emoji: '🐹', name: '仓鼠', lines: ['腮帮子塞满了', '吱吱！', '跑轮中…'] },
  { emoji: '🐨', name: '考拉', lines: ['抱树中… zzZ', '桉树叶~', '再睡五分钟'] },
  { emoji: '🐧', name: '企鹅', lines: ['摇摇摆摆~', '好冷，蹭蹭', '噗通！'] },
  { emoji: '🦄', name: '独角兽', lines: ['✨ 许个愿吧', '彩虹来了！', '我的角亮了哦'] },
]

// 通用台词，和专属台词混在一起随机取，避免反复出现同一句
const LINES = [
  '今天也要加油写博客哦 💪',
  '你发现我啦 🎉',
  '摸摸头~',
  '注意休息，别太累啦',
  '坚持更新就有人看 😉',
  '代码写累了？摸我回血~',
]

// 待机时随机做的小动作，对应 CSS 里的 .act-* 动画
const ACTIONS = ['spin', 'stretch', 'wag', 'nod', 'jump'] as const
type Action = (typeof ACTIONS)[number]

/** 每个小动作的持续时间，要和 CSS 动画时长对齐 */
const ACTION_DURATION: Record<Action, number> = {
  spin: 720,
  stretch: 820,
  wag: 640,
  nod: 520,
  jump: 620,
}

export default function FloatingPet() {
  const reduced = useRef(
    typeof window !== 'undefined' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches
  ).current

  const [pet, setPet] = useState<Pet>(PETS[0])
  const [visible, setVisible] = useState(!reduced)
  const [left, setLeft] = useState(-100) // 宠物水平像素位置（absolute left）
  const [facing, setFacing] = useState<'left' | 'right'>('left') // 朝向：决定镜像翻转
  const [phase, setPhase] = useState<'walk' | 'idle' | 'hidden'>(
    reduced ? 'idle' : 'hidden'
  )
  const [bubble, setBubble] = useState<string | null>(null)
  const [happy, setHappy] = useState(false)
  /** 待机小动作：转圈 / 伸懒腰 / 摇尾巴 / 点头 / 蹦一下 */
  const [action, setAction] = useState<Action | null>(null)
  /** 互动次数，用作特效的 key，保证连点时动画每次都重新播放 */
  const [interact, setInteract] = useState(0)

  // 位置的镜像副本：判断"该往哪边转身"时不能读 state（异步更新拿不到最新值）
  const leftRef = useRef(-100)
  const moveTo = (x: number) => {
    leftRef.current = x
    setLeft(x)
  }

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

  // 专属台词 + 通用台词混合随机，避免反复说同一句
  const popBubble = () => {
    const pool = [...pet.lines, ...LINES]
    setBubble(pool[Math.floor(Math.random() * pool.length)])
    later(() => setBubble(null), 2600)
  }

  // 走动：按目标位置转向并移动，走完自动回到待机（走路蹦得急，待机是轻微呼吸）
  const walkTo = (target: number) => {
    setPhase('walk')
    setFacing(target >= leftRef.current ? 'right' : 'left')
    moveTo(target)
    later(() => setPhase('idle'), 1400)
  }

  // 待机时随机做点小动作，让它不像一张贴图杵在那儿
  const playAntic = () => {
    const a = ACTIONS[Math.floor(Math.random() * ACTIONS.length)]
    setAction(a)
    later(() => setAction(null), ACTION_DURATION[a])
  }

  // 离开：往指定方向走回视口外，走完隐藏并安排下一次出现
  const leave = (exitSide: 'left' | 'right') => {
    setAction(null)
    setPhase('walk')
    setFacing(exitSide)
    moveTo(exitSide === 'left' ? -100 : window.innerWidth - 40)
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
    setPet(PETS[Math.floor(Math.random() * PETS.length)])
    setFacing(fromLeft ? 'right' : 'left')
    setPhase('walk')
    moveTo(fromLeft ? -100 : window.innerWidth - 40)
    setVisible(true)
    // 两帧后再移动到容器边缘，触发 CSS transition 走路动画
    const target = fromLeft ? e.left : e.right
    requestAnimationFrame(() =>
      requestAnimationFrame(() => moveTo(target))
    )
    // 走到位后转待机，之后在容器边缘之间踱两步、做几个小动作
    later(() => setPhase('idle'), 1400)

    const strolls = 1 + Math.floor(Math.random() * 2) // 停留期间踱 1~2 次
    for (let i = 0; i < strolls; i++) {
      later(
        () => walkTo(e.left + Math.random() * (e.right - e.left)),
        2600 + i * (2400 + Math.random() * 1600)
      )
    }

    const antics = 2 + Math.floor(Math.random() * 2) // 2~3 个小动作
    for (let i = 0; i < antics; i++) {
      later(playAntic, 1800 + i * (2000 + Math.random() * 1500))
    }

    // 停留 6~10 秒后离开
    later(() => leave(fromLeft ? 'left' : 'right'), 6000 + Math.random() * 4000)
  }

  // 安排下一次自动出现（减少动态偏好下不自动游走）
  const schedule = () => {
    if (reduced) return
    later(appear, 90000 + Math.random() * 20000) // 12~32 秒后
  }

  useEffect(() => {
    if (reduced) {
      // 减少动态：常驻容器右侧外缘、静态可点，不自动游走
      const e = edges()
      moveTo(e.right)
      setFacing('left')
      setPhase('idle')
      setVisible(true) // 修复：reduced 下也要显示，否则永远 return null
      return () => clearTimers()
    }
    // 首次出现缩短到约 1.5 秒，让用户加载后即能看到；之后由 leave→schedule 循环 12~32s
    later(appear, 15*1000)
    return () => clearTimers()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reduced])

  const onClick = () => {
    setHappy(true)
    setInteract((n) => n + 1)
    // 与冒心特效时长对齐（0.9s），特效没播完就别撤掉
    later(() => setHappy(false), 900)
    popBubble()
  }

  if (!visible) return null

  return (
    <div className="pet-layer" aria-hidden="true">
      <button
        type="button"
        className={`pet ${phase}${action ? ` act-${action}` : ''}${
          happy ? ' happy' : ''
        }`}
        style={{ left: `${left}px` }}
        onClick={onClick}
        aria-label={`摸摸${pet.name}`}
      >
        {bubble && <span className="pet-bubble">{bubble}</span>}
        {/* key 随互动自增：连点时重新挂载，特效每次都会重播 */}
        {happy && (
          <span className="pet-hearts" key={interact}>
            <span className="pet-heart">❤️</span>
            <span className="pet-heart">✨</span>
            <span className="pet-heart">💛</span>
          </span>
        )}
        <span
          className="pet-flip"
          style={{ transform: facing === 'left' ? 'scaleX(-1)' : 'none' }}
        >
          <span className="pet-body">{pet.emoji}</span>
        </span>
      </button>
    </div>
  )
}
