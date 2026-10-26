import { useState, type ComponentType } from 'react'
import { Helmet } from 'react-helmet-async'
import Calculator from '../components/tools/Calculator'
import LoanCalc from '../components/tools/LoanCalc'
import UnitConvert from '../components/tools/UnitConvert'
import BmiCalc from '../components/tools/BmiCalc'
import QrTool from '../components/tools/QrTool'
import JsonTool from '../components/tools/JsonTool'
import TimestampTool from '../components/tools/TimestampTool'
import CodecTool from '../components/tools/CodecTool'
import TaxTool from '../components/tools/TaxTool'
import DateTool from '../components/tools/DateTool'
import CompoundTool from '../components/tools/CompoundTool'

// 在线小工具：id / 名称 / 图标 / 对应组件（全部纯本地计算）
// hidden: 组件与实现都保留，只是不在页面上露出；想恢复把标记去掉即可
const TOOLS: {
  id: string
  name: string
  icon: string
  Comp: ComponentType
  hidden?: boolean
}[] = [
  { id: 'calc', name: '计算器', icon: '🧮', Comp: Calculator },
  { id: 'loan', name: '贷款计算', icon: '🏦', Comp: LoanCalc },
  { id: 'unit', name: '单位换算', icon: '📐', Comp: UnitConvert, hidden: true },
  { id: 'bmi', name: 'BMI', icon: '⚕️', Comp: BmiCalc, hidden: true },
  { id: 'qr', name: '二维码', icon: '🔗', Comp: QrTool },
  { id: 'json', name: 'JSON', icon: '{ }', Comp: JsonTool },
  { id: 'timestamp', name: '时间戳', icon: '⏱️', Comp: TimestampTool },
  { id: 'codec', name: '编解码', icon: '🔀', Comp: CodecTool },
  { id: 'tax', name: '个税', icon: '🧾', Comp: TaxTool, hidden: true },
  { id: 'date', name: '日期计算', icon: '📅', Comp: DateTool },
  { id: 'compound', name: '复利', icon: '📈', Comp: CompoundTool, hidden: true },
]

/** 页面上实际展示的工具 */
const VISIBLE_TOOLS = TOOLS.filter((t) => !t.hidden)

export default function Toolbox() {
  const [active, setActive] = useState('calc')
  const Active = (VISIBLE_TOOLS.find((t) => t.id === active) ?? VISIBLE_TOOLS[0]).Comp

  return (
    <div className="tools-page">
      <Helmet>
        <title>工具箱 · woge博客</title>
      </Helmet>

      <h1 className="tools-title">实用工具箱</h1>
      <p className="tools-sub">常用计算小工具，纯本地运行，数据不出浏览器</p>

      <div className="toolbox">
        <div className="toolbox-tabs">
          {VISIBLE_TOOLS.map((t) => (
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
