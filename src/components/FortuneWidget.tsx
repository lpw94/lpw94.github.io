import { useMemo, useState } from 'react'

const SIGNS = ['🌟 大吉', '⭐ 中吉', '🔥 好运', '💡 小吉', '🌈 平稳', '🌙 平', '🍀 小凶', '⚡ 留意']
const LINES = [
  '今天适合把拖延的事一口气做完。',
  '贵人藏在常被你忽略的人里。',
  '少说多做，运气都藏在行动里。',
  '给自己一点奖励，你值得。',
  '一杯咖啡的时间，能想清楚很多事。',
  '今天很适合学点新东西。',
  '别和熬夜较劲，早点休息运气更好。',
  '随手帮个人，好运回头就找上你。',
  '把计划写下来，今天的执行率会很高。',
  '心情闷就出门走走，转角有惊喜。',
]
const YI = ['coding', '读书', '表白', '整理', '运动', '联系老友', '早点睡', '尝新菜']
const JI = ['摸鱼', '内耗', '冲动消费', '熬夜', '拖延', '钻牛角尖', '发脾气']
const COLORS = ['#2563eb', '#16a34a', '#f59e0b', '#db2777', '#7c3aed', '#0891b2', '#dc2626']

function hash(str: string) {
  let h = 0
  for (let i = 0; i < str.length; i++) h = (h * 31 + str.charCodeAt(i)) | 0
  return Math.abs(h)
}
const next = (s: number) => (s * 1103515245 + 12345) & 0x7fffffff
const pick = <T,>(arr: T[], s: number) => arr[s % arr.length]

function draw(seed: number) {
  let s = seed
  s = next(s)
  const sign = pick(SIGNS, s)
  s = next(s)
  const line = pick(LINES, s)
  s = next(s)
  const yi = pick(YI, s)
  s = next(s)
  const ji = pick(JI, s)
  s = next(s)
  const color = pick(COLORS, s)
  return { sign, line, yi, ji, color }
}

export default function FortuneWidget() {
  const todaySeed = useMemo(() => hash(new Date().toDateString()), [])
  const [seed, setSeed] = useState(todaySeed)
  const [flip, setFlip] = useState(0)
  const f = draw(seed)

  const redo = () => {
    setSeed((Math.random() * 1e9) | 0)
    setFlip((v) => v + 1)
  }

  return (
    <section className="widget-card fortune-widget" aria-label="今日运势">
      <div className="ww-title">🔮 今日运势</div>
      <div className="fw-card" key={flip} style={{ borderTopColor: f.color }}>
        <div className="fw-sign" style={{ color: f.color }}>
          {f.sign}
        </div>
        <p className="fw-line">{f.line}</p>
        <div className="fw-meta">
          <span className="fw-yi">宜 · {f.yi}</span>
          <span className="fw-ji">忌 · {f.ji}</span>
        </div>
        <div className="fw-color">
          幸运色 <i style={{ background: f.color }} />
        </div>
      </div>
      <button type="button" className="fw-btn" onClick={redo}>
        再抽一签
      </button>
    </section>
  )
}
