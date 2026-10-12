import { useMemo, useState } from 'react'

const money = (n: number) => (Number.isFinite(n) ? n : 0).toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

/** 复利 / 定投计算：初始本金 + 每月定投，按月复利 */
export default function CompoundTool() {
  const [principal, setPrincipal] = useState('10000') // 初始本金
  const [monthly, setMonthly] = useState('1000') // 每月定投（月末）
  const [rate, setRate] = useState('5') // 年收益率 %
  const [years, setYears] = useState('10')

  const r = useMemo(() => {
    const P = parseFloat(principal)
    const A = parseFloat(monthly)
    const R = parseFloat(rate)
    const Y = parseInt(years, 10)
    if (![P, A, R].every((x) => Number.isFinite(x) && x >= 0) || !Number.isFinite(Y) || Y < 1 || Y > 100) return null
    const n = Y * 12
    const mr = R / 100 / 12
    const fvPrincipal = mr === 0 ? P : P * Math.pow(1 + mr, n)
    const fvMonthly = mr === 0 ? A * n : A * ((Math.pow(1 + mr, n) - 1) / mr)
    const total = fvPrincipal + fvMonthly
    const invested = P + A * n
    const profit = total - invested
    const yearly: { y: number; value: number }[] = []
    for (let y = 1; y <= Y; y++) {
      const m = y * 12
      const vp = mr === 0 ? P : P * Math.pow(1 + mr, m)
      const vm = mr === 0 ? A * m : A * ((Math.pow(1 + mr, m) - 1) / mr)
      yearly.push({ y, value: vp + vm })
    }
    return { total, invested, profit, yearly, roi: invested > 0 ? profit / invested : 0 }
  }, [principal, monthly, rate, years])

  return (
    <div className="tl-grid">
      <p className="tl-msg">按月复利、每月末定投；收益为估算，不构成投资建议。</p>
      <div className="tax-grid">
        <label className="tl-field"><span>初始本金（元）</span><input className="tl-input" type="number" min="0" value={principal} onChange={(e) => setPrincipal(e.target.value)} /></label>
        <label className="tl-field"><span>每月定投（元）</span><input className="tl-input" type="number" min="0" value={monthly} onChange={(e) => setMonthly(e.target.value)} /></label>
        <label className="tl-field"><span>年收益率（%）</span><input className="tl-input" type="number" step="0.1" min="0" value={rate} onChange={(e) => setRate(e.target.value)} /></label>
        <label className="tl-field"><span>投资年限（年）</span><input className="tl-input" type="number" min="1" max="100" value={years} onChange={(e) => setYears(e.target.value)} /></label>
      </div>
      {r ? (
        <>
          <div className="tl-stats">
            <div className="tl-stat"><span className="tl-stat-label">期末总额</span><span className="tl-stat-value tl-stat-sm">¥{money(r.total)}</span></div>
            <div className="tl-stat"><span className="tl-stat-label">总投入</span><span className="tl-stat-value tl-stat-sm">¥{money(r.invested)}</span></div>
            <div className="tl-stat"><span className="tl-stat-label">总收益</span><span className="tl-stat-value tl-profit">¥{money(r.profit)}</span></div>
            <div className="tl-stat"><span className="tl-stat-label">总收益率</span><span className="tl-stat-value">{(r.roi * 100).toFixed(1)}%</span></div>
          </div>
          <div className="tl-field">
            <span>每年末账户总额</span>
            <div className="loan-table-wrap">
              <table className="loan-table">
                <thead>
                  <tr><th>年末</th><th>账户总额</th></tr>
                </thead>
                <tbody>
                  {r.yearly.map((y) => (
                    <tr key={y.y}><td>第 {y.y} 年</td><td>{money(y.value)}</td></tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      ) : (
        <p className="tl-msg err">请输入有效数值（年限 1~100 年）。</p>
      )}
    </div>
  )
}
