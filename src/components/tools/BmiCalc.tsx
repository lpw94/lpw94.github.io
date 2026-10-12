import { useState } from 'react'

interface Zone { label: string; min: number; max: number; color: string; advice: string }

// 中国成人 BMI 分级标准
const ZONES: Zone[] = [
  { label: '偏瘦', min: 0, max: 18.5, color: '#3b82f6', advice: '注意补充营养，适当增重。' },
  { label: '正常', min: 18.5, max: 24, color: '#16a34a', advice: '保持良好作息与饮食，维持当前体重。' },
  { label: '超重', min: 24, max: 28, color: '#f59e0b', advice: '控制热量摄入，增加有氧运动。' },
  { label: '肥胖', min: 28, max: Infinity, color: '#dc2626', advice: '建议制定减重计划，必要时咨询医生。' },
]

const zoneOf = (bmi: number): Zone => ZONES.find((z) => bmi >= z.min && bmi < z.max) ?? ZONES[ZONES.length - 1]

/** BMI 计算器：身高体重 → BMI、所属区间与健康体重范围 */
export default function BmiCalc() {
  const [height, setHeight] = useState('170') // cm
  const [weight, setWeight] = useState('65') // kg

  const h = parseFloat(height)
  const w = parseFloat(weight)
  const valid = Number.isFinite(h) && h > 0 && Number.isFinite(w) && w > 0
  const bmi = valid ? w / (h / 100) ** 2 : 0
  const zone = valid ? zoneOf(bmi) : null
  // 健康体重范围（BMI 18.5 ~ 23.9）
  const minW = valid ? 18.5 * (h / 100) ** 2 : 0
  const maxW = valid ? 23.9 * (h / 100) ** 2 : 0

  return (
    <div className="bmi">
      <div className="bmi-form">
        <label className="bmi-field">
          <span>身高（cm）</span>
          <input type="number" min="1" value={height} onChange={(e) => setHeight(e.target.value)} />
        </label>
        <label className="bmi-field">
          <span>体重（kg）</span>
          <input type="number" min="1" value={weight} onChange={(e) => setWeight(e.target.value)} />
        </label>
      </div>

      {valid && zone ? (
        <div className="bmi-result">
          <div className="bmi-score">
            <span className="bmi-score-value">{bmi.toFixed(1)}</span>
            <span className="bmi-score-unit">BMI</span>
          </div>
          <div className="bmi-zone" style={{ color: zone.color, borderColor: zone.color }}>
            {zone.label}
          </div>
          <p className="bmi-advice">{zone.advice}</p>
          <div className="bmi-bar">
            {ZONES.map((z) => (
              <div
                key={z.label}
                className="bmi-bar-seg"
                style={{ background: z.color, flex: z.max === Infinity ? 1 : 1 }}
                title={z.label}
              />
            ))}
          </div>
          <p className="bmi-range">
            按此身高，健康体重范围约 <b>{minW.toFixed(1)} ~ {maxW.toFixed(1)} kg</b>
          </p>
        </div>
      ) : (
        <p className="bmi-empty">请输入有效的身高和体重。</p>
      )}
    </div>
  )
}
