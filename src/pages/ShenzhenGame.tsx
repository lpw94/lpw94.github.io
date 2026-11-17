import { useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { Helmet } from 'react-helmet-async'

/**
 * 独立游戏页：把 public/games/shenzhen-driver.html 用 iframe 嵌进来。
 * 游戏是自包含单文件（Canvas 2D 伪 3D 驾驶 + WebAudio 合成音效，零外部请求），
 * 用 iframe 隔离它自己的全屏样式、键盘监听与渲染循环，不污染主站。
 */
const GAME_URL = '/games/shenzhen-driver.html'

export default function ShenzhenGame() {
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
        <title>深漂夜行 · 深圳打工仔 · woge博客</title>
        <meta
          name="description"
          content="从坪洲地铁站到深圳北站的一场深夜驾驶：选一台车，穿过科技园、高架、城中村与龙华隧道，把乘客送到下一站。"
        />
        <meta name="robots" content="noindex, nofollow" />
      </Helmet>

      <section className="game-embed" aria-label="深漂夜行 · 深圳打工仔">
        <div className="game-embed-head">
          <div className="game-embed-heading">
            <h1>深漂夜行 · 深圳打工仔</h1>
            <p>坪洲地铁站 → 深圳北站 · 24 km · 六段打工人的夜路</p>
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
            title="深漂夜行 · 深圳打工仔"
            allow="autoplay; fullscreen; gamepad"
            allowFullScreen
            referrerPolicy="same-origin"
          />
        </div>

        <p className="game-embed-tip">
          点击「接单出发」开始 · 方向键 / WASD 驾驶、空格鸣笛、P 暂停；手机用屏幕虚拟按键。留意乘客满意度与路段事件，平稳开到深圳北站结算车费与星级。
        </p>
      </section>
    </>
  )
}
