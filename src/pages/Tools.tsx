import { Helmet } from 'react-helmet-async'
import { SITE_NAV } from '../sites'

// 每个分类一个主题色（循环取用），用于分类标记和卡片首字母图标
const PALETTE = ['#3b82f6', '#8b5cf6', '#06b6d4', '#f59e0b', '#ef4444', '#10b981']

export default function Tools() {
  return (
    <div className="tools-page">
      <Helmet>
        <title>工具 · 沃哥博客</title>
      </Helmet>

      <h1 className="tools-title">工具导航</h1>
      <p className="tools-sub">常用网站一键直达，想增删改去 src/sites.ts</p>

      {SITE_NAV.map((cat, ci) => {
        const color = PALETTE[ci % PALETTE.length]
        return (
          <section key={cat.title} className="tools-cat">
            <h2 className="tools-cat-title">
              <i className="tools-cat-dot" style={{ background: color }} />
              {cat.title}
            </h2>
            <div className="tools-grid">
              {cat.sites.map((s) => (
                <a
                  key={s.url}
                  className="tools-card"
                  href={s.url}
                  target="_blank"
                  rel="noreferrer"
                >
                  <span className="tools-mono" style={{ background: color }}>
                    {s.name.slice(0, 1)}
                  </span>
                  <span className="tools-info">
                    <span className="tools-name">{s.name}</span>
                    {s.desc && <span className="tools-desc">{s.desc}</span>}
                  </span>
                </a>
              ))}
            </div>
          </section>
        )
      })}
    </div>
  )
}
