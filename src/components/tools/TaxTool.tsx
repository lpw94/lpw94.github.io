import { useMemo, useState } from 'react'

// 年度综合所得税率表（工资薪金，中国）
const BRACKETS: { up: number; rate: number; deduct: number }[] = [
  { up: 36000, rate: 0.03, deduct: 0 },
  { up: 144000, rate: 0.10, deduct: 2520 },
  { up: 300000, rate: 0.20, deduct: 16920 },
  { up: 420000, rate: 0.25, deduct: 31920 },
  { up: 660000, rate: 0.30, deduct: 52920 },
  { up: 960000, rate: 0.35, deduct: 85920 },
  { up: Infinity, rate: 0.45, deduct: 181920 },
]
const money = (n: number) => (Number.isFinite(n) ? n : 0).toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

/** 个税计算：按年综合所得（起征点 6 万 + 五险一金 + 专项附加扣除） */
export default function TaxTool() {
  const [salary, setSalary] = useState('20000') // 税前月薪
  const [insurance, setInsurance] = useState('3000') // 五险一金·个人月缴
  const [special, setSpecial] = useState('1000') // 专项附加扣除·月额
  const [bonus, setBonus] = useState('0') // 年终奖（并入综合）

  const r = useMemo(() => {
    const s = parseFloat(salary)
    const ins = parseFloat(insurance)
    const sp = parseFloat(special)
    const bo = parseFloat(bonus)
    if (![s, ins, sp, bo].every((x) => Number.isFinite(x) && x >= 0) || s <= 0) return null
    const annualIncome = s * 12 + bo
    const annualIns = ins * 12
    const taxable = Math.max(0, annualIncome - 60000 - annualIns - sp * 12)
    const b = BRACKETS.find((x) => taxable <= x.up)!
    const tax = Math.max(0, taxable * b.rate - b.deduct)
    const afterTaxAnnual = annualIncome - annualIns - tax
    return {
      annualIncome,
      taxable,
      tax,
      monthlyAfter: afterTaxAnnual / 12,
      rate: annualIncome > 0 ? tax / annualIncome : 0,
    }
  }, [salary, insurance, special, bonus])

  return (
    <div className="tl-grid">
      <p className="tl-msg">按年综合所得计算（起征点 6 万/年，扣除五险一金与专项附加），年终奖选择并入综合计税；结果为估算，实际以汇算为准。</p>
      <div className="tax-grid">
        <label className="tl-field"><span>税前月薪（元）</span><input className="tl-input" type="number" min="0" value={salary} onChange={(e) => setSalary(e.target.value)} /></label>
        <label className="tl-field"><span>五险一金·个人月缴（元）</span><input className="tl-input" type="number" min="0" value={insurance} onChange={(e) => setInsurance(e.target.value)} /></label>
        <label className="tl-field"><span>专项附加扣除·月额（元）</span><input className="tl-input" type="number" min="0" value={special} onChange={(e) => setSpecial(e.target.value)} /></label>
        <label className="tl-field"><span>年终奖（元，并入综合）</span><input className="tl-input" type="number" min="0" value={bonus} onChange={(e) => setBonus(e.target.value)} /></label>
      </div>
      {r ? (
        <div className="tl-stats">
          <div className="tl-stat"><span className="tl-stat-label">年缴个税</span><span className="tl-stat-value">¥{money(r.tax)}</span></div>
          <div className="tl-stat"><span className="tl-stat-label">月均到手</span><span className="tl-stat-value">¥{money(r.monthlyAfter)}</span></div>
          <div className="tl-stat"><span className="tl-stat-label">年应纳税所得额</span><span className="tl-stat-value">¥{money(r.taxable)}</span></div>
          <div className="tl-stat"><span className="tl-stat-label">实际税负率</span><span className="tl-stat-value">{(r.rate * 100).toFixed(2)}%</span></div>
        </div>
      ) : (
        <p className="tl-msg err">请输入有效的月薪（≥0）。</p>
      )}
    </div>
  )
}
