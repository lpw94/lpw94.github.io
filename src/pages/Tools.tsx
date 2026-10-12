import { useState, type ComponentType } from 'react'
import { Helmet } from 'react-helmet-async'
import { SITE_NAV } from '../sites'
import Calculator from '../components/tools/Calculator'
import LoanCalc from '../components/tools/LoanCalc'
import UnitConvert from '../components/tools/UnitConvert'
import BmiCalc from '../components/tools/BmiCalc'
import QrTool from '../components/tools/QrTool'

// 每个分类一个主题色（循环取用），用于分类标记和卡片首字母图标
const PALETTE = ['#3b82f6', '#8b5cf6', '#06b6d4', '#f59e0b', '#ef4444', '#10b981']

// 在线小工具：id / 名称 / 图标 / 对应组件（全部纯本地计算）
const TOOLS: { id: string; name: string; icon: string; Comp: ComponentType }[] = [
  { id: 'calc', name: '计算器', icon: '🧮', Comp: Calculator },
  { id: 'loan', name: '贷款计算', icon: '🏦', Comp: LoanCalc },
  { id: 'unit', name: '单位换算', icon: '📐', Comp: UnitConvert },
  { id: 'bmi', name: 'BMI', icon: '⚕️', Comp: BmiCalc },
  { id: 'qr', name: '二维码', icon: '🔗', Comp: QrTool },
]

export default function Tools() {
  const [active, setActive] = useState('calc')
  const Active = (TOOLS.find((t) => t.id === active) ?? TOOLS[0]).Comp

  return (
    <div className="tools-page">
      <Helmet>
        <title>工具 · 沃哥博客</title>
      </Helmet>

      <h1 className="tools-title">实用工具箱</h1>
      <p className="tools-sub">常用计算小工具，纯本地运行，数据不出浏览器</p>

      <div className="toolbox">
        <div className="toolbox-tabs">
          {TOOLS.map((t) => (
            <button
              key={t.id}
              type="button"
              className={`toolbox-tab ${active === t.id ? 'active' : ''}`}
              onClick={() => setActive(t.id)}
            >
              <span className="toolbox-tab-icon">{t.icon}</span>
              {t.name}
            </button>
          ))}
        </div>
        <div className="toolbox-panel">
          <Active />
        </div>
      </div>

      <div className="tools-divider" />

      <h2 className="tools-nav-title">常用网站导航</h2>
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
