import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from 'react'
import { Helmet } from 'react-helmet-async'
import { FILMS } from '../lib/cinema'
import {
  OUONNKI_LOCKED_BY_ENV,
  clearUrl,
  hostOf,
  isMixedContent,
  loadUrl,
  saveUrl,
} from '../lib/ouonnki'
import { SITE_NAME, SITE_URL } from '../lib/site'
import '../styles/cinema.css'

const PAGE_URL = `${SITE_URL}/cinema`
const OG_IMAGE = `${SITE_URL}/avatar.png`

/** 数据源：本地片单 / OuonnkiTV 站点内嵌 */
type Source = 'local' | 'ouonnki'
const SOURCE_KEY = 'cinema-source'

function loadSource(): Source {
  try {
    return localStorage.getItem(SOURCE_KEY) === 'ouonnki' ? 'ouonnki' : 'local'
  } catch {
    return 'local'
  }
}

/**
 * 放映厅，两个数据源：
 *  · 本地片单 —— 上方一块屏幕播放当前影片，下方片单点一下换片（数据在 src/lib/cinema.ts）
 *  · OuonnkiTV —— iframe 内嵌自己部署的 OuonnkiTV 站点，地址在页面里填或写在 .env
 */
export default function Cinema() {
  const [source, setSource] = useState<Source>(loadSource)

  // ── 本地片单 ───────────────────────────────────────────
  const [currentId, setCurrentId] = useState(FILMS[0]?.id ?? '')
  /** 主地址播不了时，记下已切换到备用地址的影片 id，避免错误回调反复触发 */
  const [fallbackFor, setFallbackFor] = useState<string | null>(null)
  const screenRef = useRef<HTMLElement | null>(null)

  const current = useMemo(
    () => FILMS.find((f) => f.id === currentId) ?? FILMS[0],
    [currentId],
  )
  const index = FILMS.findIndex((f) => f.id === current.id)

  // 换片：切换后把屏幕滚回视野（手机上片单在屏幕下方，不滚上去会以为没反应）
  const select = useCallback((id: string) => {
    setCurrentId(id)
    setFallbackFor(null)
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

  // ← / → 切换上下部；仅本地片单模式生效，播放器获得焦点时不抢这两个键
  useEffect(() => {
    if (source !== 'local') return
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return
      const el = e.target as HTMLElement | null
      if (el && /^(INPUT|TEXTAREA|SELECT|VIDEO|IFRAME)$/.test(el.tagName)) return
      e.preventDefault()
      step(e.key === 'ArrowRight' ? 1 : -1)
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [source, step])

  // ── OuonnkiTV 内嵌 ─────────────────────────────────────
  const [ouonnkiUrl, setOuonnkiUrl] = useState<string>(loadUrl)
  const [draft, setDraft] = useState<string>(loadUrl)
  const [editing, setEditing] = useState<boolean>(() => !loadUrl())
  const [urlError, setUrlError] = useState<string | null>(null)
  const [reloadKey, setReloadKey] = useState(0)
  const embedRef = useRef<HTMLDivElement | null>(null)

  const switchSource = (next: Source) => {
    setSource(next)
    try {
      localStorage.setItem(SOURCE_KEY, next)
    } catch {
      /* 隐私模式下不记也行 */
    }
  }

  const commitUrl = (e: FormEvent) => {
    e.preventDefault()
    const url = saveUrl(draft)
    if (!url) {
      setUrlError('请先填写站点地址')
      return
    }
    setOuonnkiUrl(url)
    setEditing(false)
    // https 页面嵌 http 会被浏览器直接拦，先提示，但不阻止保存（本地 http 调试时会用到）
    setUrlError(isMixedContent(url) ? '这是 http 地址，在 https 页面里会被浏览器拦掉，建议换成 https' : null)
    setReloadKey((k) => k + 1)
  }

  const removeUrl = () => {
    clearUrl()
    setOuonnkiUrl('')
    setDraft('')
    setEditing(true)
    setUrlError(null)
  }

  const toggleFullscreen = () => {
    const el = embedRef.current
    if (!el) return
    if (document.fullscreenElement) void document.exitFullscreen()
    else void el.requestFullscreen?.()
  }

  const mixedContent = ouonnkiUrl ? isMixedContent(ouonnkiUrl) : false

  return (
    <div className="cinema-page">
      <Helmet>
        <title>放映厅 · {SITE_NAME}</title>
        <meta
          name="description"
          content={`放映厅：${FILMS.length} 部开放授权短片在线播放，也可内嵌自己部署的 OuonnkiTV 站点。`}
        />
        <link rel="canonical" href={PAGE_URL} />
        <meta property="og:type" content="website" />
        <meta property="og:title" content={`放映厅 · ${SITE_NAME}`} />
        <meta property="og:description" content="开放授权短片放映厅，或内嵌自己的 OuonnkiTV 站点。" />
        <meta property="og:url" content={PAGE_URL} />
        <meta property="og:image" content={OG_IMAGE} />
        <meta name="twitter:card" content="summary_large_image" />
      </Helmet>

      <header className="cinema-head">
        <div className="cinema-head-text">
          <h1 className="cinema-title">放映厅</h1>
          <p className="cinema-sub">
            {source === 'local'
              ? '开放授权短片 · 点片单即换片，← → 也能切'
              : '内嵌自己的 OuonnkiTV 站点 · 片源由该站点自行配置'}
          </p>
        </div>
        <div className="cinema-tabs" role="tablist" aria-label="放映数据源">
          <button
            type="button"
            role="tab"
            aria-selected={source === 'local'}
            className={`cinema-tab${source === 'local' ? ' active' : ''}`}
            onClick={() => switchSource('local')}
          >
            本地片单
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={source === 'ouonnki'}
            className={`cinema-tab${source === 'ouonnki' ? ' active' : ''}`}
            onClick={() => switchSource('ouonnki')}
          >
            OuonnkiTV
          </button>
        </div>
      </header>

      {source === 'local' ? (
        <>
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
                  key={`${current.id}-${fallbackFor === current.id ? 'fb' : 'main'}`}
                  className="cinema-media"
                  src={
                    fallbackFor === current.id && current.source.fallback
                      ? current.source.fallback
                      : current.source.src
                  }
                  poster={current.poster}
                  controls
                  playsInline
                  preload="metadata"
                  // 预加载只取元数据时画面是纯黑，先跳一点点让浏览器绘出首帧当封面
                  onLoadedMetadata={(e) => {
                    const v = e.currentTarget
                    if (v.currentTime === 0) v.currentTime = 0.1
                  }}
                  // 主地址播不了（容器 / 编码浏览器不支持）就换备用地址再试一次
                  onError={() => {
                    if (
                      current.source.type === 'mp4' &&
                      current.source.fallback &&
                      fallbackFor !== current.id
                    ) {
                      setFallbackFor(current.id)
                    }
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
        </>
      ) : (
        <section className="cinema-embed">
          {ouonnkiUrl && !editing ? (
            <>
              <div className="cinema-embed-bar">
                <span className="cinema-embed-host" title={ouonnkiUrl}>
                  {hostOf(ouonnkiUrl)}
                </span>
                <div className="cinema-embed-actions">
                  <button
                    type="button"
                    className="cinema-embed-btn"
                    onClick={() => setReloadKey((k) => k + 1)}
                  >
                    重新加载
                  </button>
                  <button type="button" className="cinema-embed-btn" onClick={toggleFullscreen}>
                    全屏
                  </button>
                  <a className="cinema-embed-btn" href={ouonnkiUrl} target="_blank" rel="noreferrer">
                    新窗口打开 ↗
                  </a>
                  {!OUONNKI_LOCKED_BY_ENV && (
                    <button
                      type="button"
                      className="cinema-embed-btn"
                      onClick={() => {
                        setDraft(ouonnkiUrl)
                        setEditing(true)
                      }}
                    >
                      更改地址
                    </button>
                  )}
                </div>
              </div>

              {mixedContent && (
                <p className="cinema-warn">
                  ⚠️ 这是 http 地址，当前页面是 https，浏览器会直接拦掉这次嵌入。换成 https 域名或套一层反向代理再试。
                </p>
              )}

              <div className="cinema-embed-frame" ref={embedRef}>
                <iframe
                  key={reloadKey}
                  src={ouonnkiUrl}
                  title="OuonnkiTV"
                  allow="autoplay; fullscreen; encrypted-media; picture-in-picture"
                  allowFullScreen
                  referrerPolicy="no-referrer-when-downgrade"
                />
              </div>

              <p className="cinema-embed-note">
                如果一直白屏，多半是对方站点设了 <code>X-Frame-Options</code> 禁止被嵌入 —— 点「新窗口打开」即可。
                OuonnkiTV 只是播放前端，片源由你的部署自行配置，本页不内置任何视频源。
              </p>
            </>
          ) : (
            <div className="cinema-setup">
              <h2>接入你的 OuonnkiTV</h2>
              <p>
                把部署好的站点地址填进来，这个标签页就会在下方内嵌显示它（搜索、选集、播放全在站内完成）。
                地址只保存在本机浏览器，不会上传；也可以在 <code>.env</code> 里写
                <code> VITE_OUONNKI_URL </code>作为默认值。
              </p>
              <form className="cinema-form" onSubmit={commitUrl}>
                <input
                  className="cinema-input"
                  type="text"
                  inputMode="url"
                  placeholder="https://tv.example.com"
                  value={draft}
                  onChange={(e) => {
                    setDraft(e.target.value)
                    setUrlError(null)
                  }}
                  aria-label="OuonnkiTV 站点地址"
                />
                <button type="submit" className="cinema-btn-primary">
                  保存并打开
                </button>
                {ouonnkiUrl && (
                  <>
                    <button
                      type="button"
                      className="cinema-embed-btn"
                      onClick={() => {
                        setDraft(ouonnkiUrl)
                        setEditing(false)
                      }}
                    >
                      取消
                    </button>
                    <button type="button" className="cinema-embed-btn" onClick={removeUrl}>
                      清除
                    </button>
                  </>
                )}
              </form>
              {urlError && <p className="cinema-warn">{urlError}</p>}
              <p className="cinema-hint">
                提示：对方站点放开被嵌入才能显示内容；不确定就先点「保存并打开」，白屏了就用新窗口打开。
              </p>
            </div>
          )}
        </section>
      )}
    </div>
  )
}
