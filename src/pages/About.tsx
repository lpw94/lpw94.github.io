import { useEffect, useRef, useState, type CSSProperties } from 'react'
import { Helmet } from 'react-helmet-async'
import { resume } from '../resume'
import { SITE_NAME, SITE_URL } from '../lib/site'
import '../styles/about.css'

const ROLE_TEXT = resume.role

const PAGE_URL = `${SITE_URL}/about`
const OG_IMAGE = `${SITE_URL}/avatar.png`
const PAGE_TITLE = `${resume.name} · Web 全栈研发工程师 · 广东深圳`
const PAGE_DESC = `${resume.name}（沃哥）的个人简历：${resume.role}。${resume.projects.length} 段项目经验，覆盖 React / Vue 大屏、Node.js 与 Python 服务端、AI 应用开发。`

// 结构化数据：让搜索与社交平台能识别「这是一个工程师的简历」
const PERSON_LD = {
  '@context': 'https://schema.org',
  '@type': 'Person',
  name: resume.name,
  alternateName: '沃哥',
  jobTitle: 'Web 全栈研发工程师',
  description: PAGE_DESC,
  url: PAGE_URL,
  image: OG_IMAGE,
  email: `mailto:${resume.email}`,
  telephone: `+86-${resume.phone}`,
  address: {
    '@type': 'PostalAddress',
    addressLocality: '深圳',
    addressRegion: '广东',
    addressCountry: 'CN',
  },
  sameAs: [resume.github],
  knowsAbout: resume.skills.map((s) => s.name),
}

const PrintIcon = () => (
  <svg viewBox="0 0 24 24" className="icon" aria-hidden="true">
    <path d="M7 2.5h10a1.5 1.5 0 0 1 1.5 1.5v3.5H5.5V4A1.5 1.5 0 0 1 7 2.5Zm-3 6h16A1.5 1.5 0 0 1 21.5 10v6h-3.5v-2.5h-12V16H2.5v-6A1.5 1.5 0 0 1 4 8.5Zm4 5h8V21H8v-7.5Z" />
  </svg>
)

const MailIcon = () => (
  <svg viewBox="0 0 24 24" className="icon" aria-hidden="true">
    <path d="M2 6a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V6Zm2.2.5L12 12.7l7.8-6.2H4.2Z" />
  </svg>
)

const PinIcon = () => (
  <svg viewBox="0 0 24 24" className="icon" aria-hidden="true">
    <path d="M12 2a7 7 0 0 0-7 7c0 5.25 7 13 7 13s7-7.75 7-13a7 7 0 0 0-7-7Zm0 9.5A2.5 2.5 0 1 1 12 6.5a2.5 2.5 0 0 1 0 5Z" />
  </svg>
)

const PhoneIcon = () => (
  <svg viewBox="0 0 24 24" className="icon" aria-hidden="true">
    <path d="M6.6 2.5a1.8 1.8 0 0 1 1.66 1.1l1.26 3a1.8 1.8 0 0 1-.4 2l-1.1 1.1a13.4 13.4 0 0 0 6.28 6.28l1.1-1.1a1.8 1.8 0 0 1 2-.4l3 1.26a1.8 1.8 0 0 1 1.1 1.66v2.4a1.8 1.8 0 0 1-1.96 1.8C10.9 20.7 3.3 13.1 2.4 4.46A1.8 1.8 0 0 1 4.2 2.5h2.4Z" />
  </svg>
)

const GithubIcon = () => (
  <svg viewBox="0 0 24 24" className="icon" aria-hidden="true">
    <path d="M12 2a10 10 0 0 0-3.16 19.49c.5.09.68-.22.68-.48v-1.7c-2.78.6-3.37-1.34-3.37-1.34-.45-1.16-1.11-1.47-1.11-1.47-.91-.62.07-.6.07-.6 1 .07 1.53 1.03 1.53 1.03.89 1.53 2.34 1.09 2.91.83.09-.65.35-1.09.63-1.34-2.22-.25-4.56-1.11-4.56-4.95 0-1.09.39-1.99 1.03-2.69-.1-.25-.45-1.27.1-2.65 0 0 .84-.27 2.75 1.03a9.4 9.4 0 0 1 5 0c1.91-1.3 2.75-1.03 2.75-1.03.55 1.38.2 2.4.1 2.65.64.7 1.03 1.6 1.03 2.69 0 3.85-2.35 4.7-4.58 4.94.36.31.68.92.68 1.85v2.74c0 .27.18.58.69.48A10 10 0 0 0 12 2Z" />
  </svg>
)

export default function About() {
  // 打字机逐字显示的职位描述
  const [typed, setTyped] = useState('')
  // 数据概览的滚动数字，初始全 0
  const [counts, setCounts] = useState<number[]>(() => resume.stats.map(() => 0))
  // 头像失败回退：head.png -> avatar.svg -> 文字缩写
  const [avatarSrc, setAvatarSrc] = useState(resume.avatar)
  const avatarStage = useRef(0)

  useEffect(() => {
    let i = 0
    const timer = window.setInterval(() => {
      i += 1
      setTyped(ROLE_TEXT.slice(0, i))
      if (i >= ROLE_TEXT.length) window.clearInterval(timer)
    }, 90)
    return () => window.clearInterval(timer)
  }, [])

  useEffect(() => {
    const duration = 1200
    const start = performance.now()
    let raf = 0
    const step = (now: number) => {
      const p = Math.min((now - start) / duration, 1)
      const eased = 1 - Math.pow(1 - p, 3)
      setCounts(resume.stats.map((s) => Math.round(s.value * eased)))
      if (p < 1) raf = window.requestAnimationFrame(step)
    }
    raf = window.requestAnimationFrame(step)
    return () => window.cancelAnimationFrame(raf)
  }, [])

  const handleAvatarError = () => {
    if (avatarStage.current === 0) {
      avatarStage.current = 1
      setAvatarSrc(resume.avatarFallback)
      return
    }
    avatarStage.current = 2
    setAvatarSrc('')
  }

  return (
    <>
      <Helmet>
        <title>{PAGE_TITLE}</title>
        <meta name="description" content={PAGE_DESC} />
        <link rel="canonical" href={PAGE_URL} />
        <meta property="og:type" content="profile" />
        <meta property="og:site_name" content={SITE_NAME} />
        <meta property="og:locale" content="zh_CN" />
        <meta property="og:title" content={PAGE_TITLE} />
        <meta property="og:description" content={PAGE_DESC} />
        <meta property="og:url" content={PAGE_URL} />
        <meta property="og:image" content={OG_IMAGE} />
        <meta name="twitter:card" content="summary" />
        <script type="application/ld+json">{JSON.stringify(PERSON_LD)}</script>
      </Helmet>

      <div className="about-page">
        {/* 背景光斑 */}
        <div className="orbs" aria-hidden="true">
          <span className="orb orb-1" />
          <span className="orb orb-2" />
          <span className="orb orb-3" />
        </div>

        {/* 头部名片 */}
        <header className="hero">
          <div className="hero-inner">
            <div className="avatar-wrap">
              <span className="avatar-ring" />
              <div className="avatar">
                {avatarSrc ? (
                  <img
                    src={avatarSrc}
                    alt={`${resume.name} 的头像`}
                    onError={handleAvatarError}
                  />
                ) : (
                  <span className="avatar-text">{resume.initials}</span>
                )}
              </div>
            </div>

            <h1 className="name">{resume.name}</h1>
            <p className="role">
              <span className="typed">{typed}</span>
              <span className="caret" />
            </p>

            <div className="chips">
              <a className="chip" href={`mailto:${resume.email}`}>
                <MailIcon />
                {resume.email}
              </a>
              <a className="chip" href={`tel:${resume.phone}`}>
                <PhoneIcon />
                {resume.phone}
              </a>
              <span className="chip">
                <PinIcon />
                {resume.location}
              </span>
              <a className="chip" href={resume.github} target="_blank" rel="noreferrer">
                <GithubIcon />
                {resume.github.replace(/^https?:\/\//, '')}
              </a>
            </div>
          </div>
        </header>

        {/* 导出 PDF：走浏览器打印，版式由 about.css 的 @media print 接管 */}
        <div className="print-bar">
          <button type="button" className="print-btn" onClick={() => window.print()}>
            <PrintIcon />
            导出 PDF
          </button>
          <span className="print-hint">按 A4 排版，可直接投递</span>
        </div>

        {/* 数据概览 */}
        <section className="stats reveal" style={{ animationDelay: '0.05s' }}>
          {resume.stats.map((s, index) => (
            <div key={s.label} className="stat">
              <div className="stat-num">
                <span>{counts[index] ?? 0}</span>
                <i>{s.suffix}</i>
              </div>
              <div className="stat-label">{s.label}</div>
            </div>
          ))}
        </section>

        {/* 求职意向 */}
        <section className="card reveal" style={{ animationDelay: '0.25s' }}>
          <h2 className="card-title">求职意向</h2>
          <div className="intent">
            {resume.intents.map((item) => (
              <div key={item.label} className="intent-item">
                <span className="intent-label">{item.label}</span>
                <span className="intent-value">{item.value}</span>
              </div>
            ))}
          </div>
        </section>

        {/* 项目经验 */}
        <section className="card reveal" style={{ animationDelay: '0.35s' }}>
          <h2 className="card-title">项目经验</h2>
          <div className="projects">
            {resume.projects.map((p) => (
              <article key={p.name} className="project">
                <div className="project-head">
                  <h3 className="project-name">{p.name}</h3>
                  <span className="project-role">{p.role}</span>
                  <span className="project-period">{p.period}</span>
                </div>
                <div className="project-stack">
                  {p.stack.map((t) => (
                    <span key={t} className="stack-tag">
                      {t}
                    </span>
                  ))}
                </div>
                <ul className="project-points">
                  {p.points.map((pt) => (
                    <li key={pt}>{pt}</li>
                  ))}
                </ul>
              </article>
            ))}
          </div>
        </section>

        {/* 自我评价 */}
        <section className="card reveal" style={{ animationDelay: '0.45s' }}>
          <h2 className="card-title">自我评价</h2>
          <p className="desc">{resume.intro}</p>
          <div className="tags">
            {resume.traits.map((t) => (
              <span key={t} className="tag">
                {t}
              </span>
            ))}
          </div>
        </section>

        {/* 技能特长 */}
        <section className="card reveal" style={{ animationDelay: '0.55s' }}>
          <h2 className="card-title">技能特长</h2>
          <div className="skills">
            {resume.skills.map((s, index) => (
              <div key={s.name} className="skill">
                <div className="skill-head">
                  <span className="skill-name">{s.name}</span>
                  <span className="skill-percent">{s.value}%</span>
                </div>
                <div className="skill-track">
                  <div
                    className="skill-bar"
                    style={
                      {
                        '--w': `${s.value}%`,
                        animationDelay: `${0.55 + index * 0.07}s`,
                      } as CSSProperties
                    }
                  />
                </div>
              </div>
            ))}
          </div>
          <p className="skills-extra">{resume.alsoSkills}</p>
        </section>

        <div className="about-footer">保持热爱，奔赴山海 · Powered by React + Supabase</div>
      </div>
    </>
  )
}
