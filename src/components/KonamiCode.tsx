import { useEffect, useState } from 'react'

// 经典 Konami 秘籍：↑ ↑ ↓ ↓ ← → ← → B A
const SEQUENCE = [
  'ArrowUp', 'ArrowUp', 'ArrowDown', 'ArrowDown',
  'ArrowLeft', 'ArrowRight', 'ArrowLeft', 'ArrowRight',
  'b', 'a',
]

const KEY_LABEL: Record<string, string> = {
  ArrowUp: '↑', ArrowDown: '↓', ArrowLeft: '←', ArrowRight: '→', b: 'B', a: 'A',
}

// 全屏彩带爆发：临时挂到 body 顶层，动画结束后自动移除（不依赖任何动画库）
function burstConfetti() {
  const layer = document.createElement('div')
  layer.className = 'konami-burst'
  const colors = ['#ff5e5e', '#ffd166', '#06d6a0', '#4cc9f0', '#b794f6', '#f78fb3']
  const N = 90
  for (let i = 0; i < N; i++) {
    const p = document.createElement('span')
    p.className = 'konami-piece'
    const angle = Math.random() * Math.PI * 2
    const dist = 120 + Math.random() * 280
    const dx = Math.cos(angle) * dist
    const dy = Math.sin(angle) * dist - 140
    p.style.setProperty('--dx', `${dx}px`)
    p.style.setProperty('--dy', `${dy}px`)
    p.style.left = `${50 + (Math.random() * 30 - 15)}vw`
    p.style.top = '62vh'
    p.style.background = colors[i % colors.length]
    p.style.animationDelay = `${Math.random() * 0.15}s`
    layer.appendChild(p)
  }
  document.body.appendChild(layer)
  // 动画约 1.2s，留余量后清理 DOM
  setTimeout(() => layer.remove(), 1800)
}

/**
 * Konami 秘籍互动组件。全局监听按键序列，输入正确即触发全屏彩带 + 卡片进入「已激活」状态。
 * 卡片本身展示按键提示与实时进度，点击「收起」恢复提示态。
 */
export default function KonamiCode() {
  const [active, setActive] = useState(false)
  const [progress, setProgress] = useState(0)

  useEffect(() => {
    let idx = 0
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches

    const onKey = (e: KeyboardEvent) => {
      // 在输入框 / 文本域 / 可编辑区打字时不拦截，避免影响正常输入
      const t = e.target as HTMLElement | null
      if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable)) return

      const k = e.key.length === 1 ? e.key.toLowerCase() : e.key

      if (k === SEQUENCE[idx]) {
        idx += 1
        setProgress(idx)
        if (idx === SEQUENCE.length) {
          idx = 0
          setProgress(0)
          setActive(true)
          if (!reduced) burstConfetti()
        }
      } else {
        // 输错一个键时，若当前键恰好是序列首键，则当成「重新从头开始」
        idx = k === SEQUENCE[0] ? 1 : 0
        setProgress(idx)
      }
    }

    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  return (
    <section className="widget-card konami-widget" aria-label="隐藏彩蛋">
      <div className="ww-title">🎮 隐藏彩蛋</div>
      {active ? (
        <div className="konami-active">
          <div className="konami-emoji">🎉</div>
          <div className="konami-msg">
            秘籍已激活！
            <br />
            你找到了开发者彩蛋 ✨
          </div>
          <button type="button" className="konami-reset" onClick={() => setActive(false)}>
            收起
          </button>
        </div>
      ) : (
        <div className="konami-hint">
          <div className="konami-keys">
            {SEQUENCE.map((k, i) => (
              <kbd key={i} className={i < progress ? 'on' : ''}>
                {KEY_LABEL[k] ?? k}
              </kbd>
            ))}
          </div>
          <p className="konami-tip">按顺序输入上面的按键试试看～</p>
        </div>
      )}
    </section>
  )
}
