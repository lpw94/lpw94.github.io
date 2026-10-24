import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Helmet } from 'react-helmet-async'
import { FILMS } from '../lib/cinema'
import { SITE_NAME, SITE_URL } from '../lib/site'
import '../styles/cinema.css'

const PAGE_URL = `${SITE_URL}/cinema`
const OG_IMAGE = `${SITE_URL}/avatar.png`

/**
 * 放映厅：上方一块屏幕播放当前影片，下方片单点一下就换片。
 * 片单数据在 src/lib/cinema.ts，改那个文件即可增删影片（支持 mp4 直链与外站 iframe）。
 */
export default function Cinema() {
  const [currentId, setCurrentId] = useState(FILMS[0]?.id ?? '')
  const screenRef = useRef<HTMLElement | null>(null)

  const current = useMemo(
    () => FILMS.find((f) => f.id === currentId) ?? FILMS[0],
    [currentId],
  )
  const index = FILMS.findIndex((f) => f.id === current.id)

  // 换片：切换后把屏幕滚回视野（手机上片单在屏幕下方，不滚上去会以为没反应）
  const select = useCallback((id: string) => {
    setCurrentId(id)
    screenRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }, [])

  const step = useCallback(
    (delta: number) => {
      if (FILMS.length < 2) return
      const next = FILMS[(index + delta + FILMS.length) % FILMS.length]
      select(next.id)
    },
    [index, select],
  )

  // ← / → 切换上下部；播放器获得焦点时不抢这两个键（原生播放器用它快退 / 快进）
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return
      const el = e.target as HTMLElement | null
      if (el && /^(INPUT|TEXTAREA|SELECT|VIDEO|IFRAME)$/.test(el.tagName)) return
      e.preventDefault()
      step(e.key === 'ArrowRight' ? 1 : -1)
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [step])

  return (
    <div className="cinema-page">
      <Helmet>
        <title>放映厅 · {SITE_NAME}</title>
        <meta
          name="description"
          content={`放映厅：${FILMS.length} 部开放授权短片，点片单即换片，支持 mp4 直链与外站播放器嵌入。`}
        />
        <link rel="canonical" href={PAGE_URL} />
        <meta property="og:type" content="website" />
        <meta property="og:title" content={`放映厅 · ${SITE_NAME}`} />
        <meta property="og:description" content="开放授权短片放映厅，点片单即换片。" />
        <meta property="og:url" content={PAGE_URL} />
        <meta property="og:image" content={OG_IMAGE} />
        <meta name="twitter:card" content="summary_large_image" />
      </Helmet>

      <header className="cinema-head">
        <div className="cinema-head-text">
          <h1 className="cinema-title">放映厅</h1>
          <p className="cinema-sub">开放授权短片 · 拖到片单点一下即换片，← → 也能切</p>
        </div>
        <span className="cinema-count">{FILMS.length} 部在映</span>
      </header>

      <section className="cinema-screen" ref={screenRef}>
        <div className="cinema-frame">
          {current.source.type === 'iframe' ? (
            <iframe
              key={current.id}
              className="cinema-media"
              src={current.source.src}
              title={current.title}
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; picture-in-picture; fullscreen"
              allowFullScreen
            />
          ) : (
            <video
              key={current.id}
              className="cinema-media"
              src={current.source.src}
              poster={current.poster}
              controls
              playsInline
              preload="metadata"
              // 预加载只取元数据时画面是纯黑，先跳一点点让浏览器绘出首帧当封面
              onLoadedMetadata={(e) => {
                const v = e.currentTarget
                if (v.currentTime === 0) v.currentTime = 0.1
              }}
            />
          )}
          <span className="cinema-now">
            <span className="cinema-now-dot" aria-hidden="true" />
            正在放映
          </span>
        </div>

        <div className="cinema-meta">
          <div className="cinema-meta-top">
            <h2 className="cinema-film-title">{current.title}</h2>
            {current.subtitle && <span className="cinema-film-sub">{current.subtitle}</span>}
            <span className="cinema-film-facts">
              {[current.category, current.year, current.badge, current.credit]
                .filter(Boolean)
                .join(' · ')}
            </span>
          </div>

          <p className="cinema-film-desc">{current.desc}</p>

          <div className="cinema-film-tags">
            {current.tags.map((t) => (
              <span key={t} className="cinema-tag">
                {t}
              </span>
            ))}
          </div>

          <div className="cinema-steps">
            <button type="button" className="cinema-step" onClick={() => step(-1)}>
              ← 上一部
            </button>
            <span className="cinema-step-index">
              {index + 1} / {FILMS.length}
            </span>
            <button type="button" className="cinema-step" onClick={() => step(1)}>
              下一部 →
            </button>
          </div>
        </div>
      </section>

      <section className="cinema-playlist">
        <h2 className="cinema-section-title">片单</h2>
        <ul className="cinema-list">
          {FILMS.map((f, i) => {
            const active = f.id === current.id
            return (
              <li key={f.id} className="cinema-item">
                <button
                  type="button"
                  className={`cinema-card${active ? ' active' : ''}`}
                  onClick={() => select(f.id)}
                  aria-current={active ? 'true' : undefined}
                >
                  <span
                    className="cinema-poster"
                    style={{
                      background: f.poster
                        ? `center / cover no-repeat url(${f.poster})`
                        : `linear-gradient(140deg, ${f.colors[0]}, ${f.colors[1]})`,
                    }}
                  >
                    <span className="cinema-poster-index">{String(i + 1).padStart(2, '0')}</span>
                    <span className="cinema-poster-badge">{f.badge}</span>
                  </span>
                  <span className="cinema-card-body">
                    <span className="cinema-card-title">{f.title}</span>
                    <span className="cinema-card-desc">{f.desc}</span>
                    <span className="cinema-card-facts">
                      {f.category}
                      {f.year ? ` · ${f.year}` : ''}
                    </span>
                  </span>
                </button>
              </li>
            )
          })}
        </ul>
      </section>
    </div>
  )
}
