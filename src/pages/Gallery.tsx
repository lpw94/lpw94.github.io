import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { Helmet } from 'react-helmet-async'
import Gallery3D from '../components/Gallery3D'
import { GALLERY_PROJECTS, type GalleryProject } from '../lib/gallery'

/**
 * 3D 个人展厅：Three.js 画廊房间里挂着项目画框，
 * 点击画框弹出项目介绍卡（技术栈标签 + 简介 + 在线体验 / 源码链接）。
 */
export default function Gallery() {
  const [selected, setSelected] = useState<GalleryProject | null>(null)

  // 详情弹窗打开期间：锁背景滚动 + Esc 关闭
  useEffect(() => {
    if (!selected) return
    const prevOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setSelected(null)
    }
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.body.style.overflow = prevOverflow
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [selected])

  return (
    <div className="gallery-page">
      <Helmet>
        <title>展厅 · 沃哥博客</title>
      </Helmet>

      <div className="gallery-head">
        <h1 className="gallery-title">3D 个人展厅</h1>
        <p className="gallery-hint muted">🖱️ 拖拽旋转 · 滚轮缩放 · 点击画框查看项目详情</p>
      </div>

      <div className="gallery3d-wrap">
        <Gallery3D onSelect={setSelected} />
      </div>

      {/* 画框下方的文字导航：不想转视角也能直接点 */}
      <ul className="gallery-list">
        {GALLERY_PROJECTS.map((p) => (
          <li key={p.id}>
            <button
              type="button"
              className="gallery-list-item"
              onClick={() => setSelected(p)}
              style={{ background: `linear-gradient(135deg, ${p.colors[0]}, ${p.colors[1]})` }}
            >
              {p.title}
            </button>
          </li>
        ))}
      </ul>

      {selected &&
        createPortal(
          <div
            className="modal-backdrop"
            onMouseDown={(e) => {
              // 只有点到遮罩本身才关闭，点弹窗内部不关
              if (e.target === e.currentTarget) setSelected(null)
            }}
          >
            <div
              className="modal gallery-modal"
              role="dialog"
              aria-modal="true"
              aria-labelledby="gallery-modal-title"
            >
              <div className="modal-head">
                <h2 id="gallery-modal-title">{selected.title}</h2>
                <button
                  type="button"
                  className="modal-close"
                  onClick={() => setSelected(null)}
                  aria-label="关闭"
                >
                  ×
                </button>
              </div>

              <div className="gallery-modal-tags">
                {selected.tech.map((t) => (
                  <span key={t} className="gallery-tag">
                    {t}
                  </span>
                ))}
              </div>

              <p className="gallery-modal-desc">{selected.description}</p>

              <div className="gallery-modal-actions">
                {selected.link && (
                  <a
                    className="btn-primary gallery-modal-btn"
                    href={selected.link}
                    target="_blank"
                    rel="noreferrer"
                  >
                    在线体验 →
                  </a>
                )}
                {selected.repo && (
                  <a
                    className="btn-ghost gallery-modal-btn"
                    href={selected.repo}
                    target="_blank"
                    rel="noreferrer"
                  >
                    源代码
                  </a>
                )}
                {!selected.link && !selected.repo && (
                  <span className="muted">企业内部项目，暂不提供公开链接</span>
                )}
              </div>
            </div>
          </div>,
          document.body,
        )}
    </div>
  )
}
