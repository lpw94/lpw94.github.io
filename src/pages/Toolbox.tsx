import { useState, type ComponentType } from 'react'
import { Helmet } from 'react-helmet-async'
import Calculator from '../components/tools/Calculator'
import LoanCalc from '../components/tools/LoanCalc'
import UnitConvert from '../components/tools/UnitConvert'
import BmiCalc from '../components/tools/BmiCalc'
import QrTool from '../components/tools/QrTool'

// 在线小工具：id / 名称 / 图标 / 对应组件（全部纯本地计算）
const TOOLS: { id: string; name: string; icon: string; Comp: ComponentType }[] = [
  { id: 'calc', name: '计算器', icon: '🧮', Comp: Calculator },
  { id: 'loan', name: '贷款计算', icon: '🏦', Comp: LoanCalc },
  { id: 'unit', name: '单位换算', icon: '📐', Comp: UnitConvert },
  { id: 'bmi', name: 'BMI', icon: '⚕️', Comp: BmiCalc },
  { id: 'qr', name: '二维码', icon: '🔗', Comp: QrTool },
]

export default function Toolbox() {
  const [active, setActive] = useState('calc')
  const Active = (TOOLS.find((t) => t.id === active) ?? TOOLS[0]).Comp

  return (
    <div className="tools-page">
      <Helmet>
        <title>工具箱 · 沃哥博客</title>
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
    </div>
  )
}
