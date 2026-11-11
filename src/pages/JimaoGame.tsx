import { useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { Helmet } from 'react-helmet-async'

/**
 * 独立游戏页：把 public/games/jimao-3a.html 用 iframe 嵌进来。
 * 原文件是自包含的单文件 3D 游戏（内联 Three.js、程序化生成场景，无外部请求），
 * 用 iframe 隔离它自己的全屏样式、键盘监听与 requestAnimationFrame，不污染主站。
 * iframe 必须 allow pointer-lock / fullscreen，否则游戏里的鼠标锁定与全屏会被浏览器拦掉。
 */
const GAME_URL = '/games/jimao-3a.html'

export default function JimaoGame() {
  const frameRef = useRef<HTMLDivElement>(null)
  /** 换 key 强制 iframe 重新加载，等于「重开一局」 */
  const [reloadKey, setReloadKey] = useState(0)

  const toggleFullscreen = () => {
    const el = frameRef.current
    if (!el) return
    if (document.fullscreenElement) {
      void document.exitFullscreen().catch(() => {})
      return
    }
    try {
      const p = el.requestFullscreen?.()
      p?.catch?.(() => {})
    } catch {
      /* 浏览器不支持全屏时静默忽略 */
    }
  }

  return (
    <>
      <Helmet>
        <title>几猫3A大作 · woge博客</title>
        <meta
          name="description"
          content="几猫港区潜入行动：切断三处上行中继，避开机械守卫，登船撤离。浏览器里直接开玩的单文件 3D 游戏。"
        />
        {/* 游戏页正文只有一个 iframe，搜索引擎抓不到有意义的内容 */}
        <meta name="robots" content="noindex, nofollow" />
      </Helmet>

      <section className="game-embed" aria-label="几猫3A大作">
        <div className="game-embed-head">
          <div className="game-embed-heading">
            <h1>几猫3A大作</h1>
            <p>几猫港区 · 四号泊位 · 切断三处上行中继后撤离</p>
          </div>
          <div className="game-embed-actions">
            <button type="button" onClick={toggleFullscreen}>全屏</button>
            <button type="button" onClick={() => setReloadKey((k) => k + 1)}>重新加载</button>
            <a href={GAME_URL} target="_blank" rel="noopener noreferrer">新窗口打开</a>
            <Link to="/">返回首页</Link>
          </div>
        </div>

        <div className="game-embed-frame" ref={frameRef}>
          <iframe
            key={reloadKey}
            src={GAME_URL}
            title="几猫3A大作"
            allow="autoplay; fullscreen; pointer-lock; gamepad"
            allowFullScreen
            referrerPolicy="same-origin"
          />
        </div>

        <p className="game-embed-tip">
          点击画面开始 · 键盘 / 鼠标 / 触屏 / 手柄均可操作，具体键位见游戏内「操作说明」；画质可在设置里调整。
        </p>
      </section>
    </>
  )
}
