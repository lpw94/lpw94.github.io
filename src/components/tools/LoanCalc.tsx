import { useMemo, useState } from 'react'

type Method = 'equal' | 'principal' // 等额本息 / 等额本金

const money = (n: number) =>
  (Number.isFinite(n) ? n : 0).toLocaleString('zh-CN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })

/** 贷款计算器：等额本息 / 等额本金，输出月供、总利息、还款总额与分期明细 */
export default function LoanCalc() {
  const [amount, setAmount] = useState('1000000') // 贷款总额（元）
  const [rate, setRate] = useState('3.85') // 年利率 %
  const [years, setYears] = useState('30') // 贷款年限
  const [method, setMethod] = useState<Method>('equal')
  const [showAll, setShowAll] = useState(false)

  const res = useMemo(() => {
    const P = parseFloat(amount)
    const annual = parseFloat(rate)
    const y = parseFloat(years)
    if (!Number.isFinite(P) || P <= 0 || !Number.isFinite(annual) || annual < 0 || !Number.isFinite(y) || y <= 0) {
      return null
    }
    const r = annual / 100 / 12
    const n = Math.round(y * 12)

    // 每月明细：[期数, 月供, 本金, 利息, 剩余本金]
    const schedule: { k: number; pay: number; principal: number; interest: number; left: number }[] = []

    if (method === 'equal') {
      const factor = r === 0 ? 0 : Math.pow(1 + r, n)
      const monthly = r === 0 ? P / n : (P * r * factor) / (factor - 1)
      let left = P
      for (let k = 1; k <= n; k++) {
        const interest = left * r
        const principal = monthly - interest
        left = Math.max(0, left - principal)
        schedule.push({ k, pay: monthly, principal, interest, left })
      }
      const totalPay = monthly * n
      return { monthly, first: monthly, last: monthly, decrement: 0, interest: totalPay - P, totalPay, schedule }
    }

    // 等额本金：每月本金固定，利息随剩余本金递减
    const principalPer = P / n
    let left = P
    for (let k = 1; k <= n; k++) {
      const interest = left * r
      const pay = principalPer + interest
      left = Math.max(0, left - principalPer)
      schedule.push({ k, pay, principal: principalPer, interest, left })
    }
    const first = schedule[0].pay
    const last = schedule[n - 1].pay
    const interest = r === 0 ? 0 : (P * r * (n + 1)) / 2
    return { monthly: first, first, last, decrement: first - last, interest, totalPay: P + interest, schedule }
  }, [amount, rate, years, method])

  const rows = res ? (showAll ? res.schedule : res.schedule.slice(0, 12)) : []

  return (
    <div className="loan">
      <div className="loan-form">
        <label className="loan-field">
          <span>贷款总额（元）</span>
          <input type="number" min="0" value={amount} onChange={(e) => setAmount(e.target.value)} />
        </label>
        <label className="loan-field">
          <span>年利率（%）</span>
          <input type="number" step="0.01" min="0" value={rate} onChange={(e) => setRate(e.target.value)} />
        </label>
        <label className="loan-field">
          <span>贷款年限（年）</span>
          <input type="number" min="1" max="40" value={years} onChange={(e) => setYears(e.target.value)} />
        </label>
        <div className="loan-field">
          <span>还款方式</span>
          <div className="loan-methods">
            <button
              type="button"
              className={method === 'equal' ? 'active' : ''}
              onClick={() => setMethod('equal')}
            >
              等额本息
            </button>
            <button
              type="button"
              className={method === 'principal' ? 'active' : ''}
              onClick={() => setMethod('principal')}
            >
              等额本金
            </button>
          </div>
        </div>
      </div>

      {res ? (
        <div className="loan-result">
          <div className="loan-stats">
            <div className="loan-stat loan-stat-main">
              <span className="loan-stat-label">
                {method === 'equal' ? '每月月供' : '首月月供'}
              </span>
              <span className="loan-stat-value">¥{money(res.monthly)}</span>
              {method === 'principal' && (
                <span className="loan-stat-sub">末月 ¥{money(res.last)} · 每月递减 ¥{money(res.decrement)}</span>
              )}
            </div>
            <div className="loan-stat">
              <span className="loan-stat-label">支付利息</span>
              <span className="loan-stat-value loan-stat-interest">¥{money(res.interest)}</span>
            </div>
            <div className="loan-stat">
              <span className="loan-stat-label">还款总额</span>
              <span className="loan-stat-value">¥{money(res.totalPay)}</span>
            </div>
          </div>

          <div className="loan-table-head">
            <span>还款明细</span>
            {res.schedule.length > 12 && (
              <button type="button" className="loan-toggle" onClick={() => setShowAll((v) => !v)}>
                {showAll ? '收起' : `展开全部 ${res.schedule.length} 期`}
              </button>
            )}
          </div>
          <div className="loan-table-wrap">
            <table className="loan-table">
              <thead>
                <tr>
                  <th>期数</th>
                  <th>月供</th>
                  <th>本金</th>
                  <th>利息</th>
                  <th>剩余本金</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.k}>
                    <td>{r.k}</td>
                    <td>{money(r.pay)}</td>
                    <td>{money(r.principal)}</td>
                    <td>{money(r.interest)}</td>
                    <td>{money(r.left)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <p className="loan-empty">请输入有效的贷款金额、利率和年限。</p>
      )}
    </div>
  )
}
