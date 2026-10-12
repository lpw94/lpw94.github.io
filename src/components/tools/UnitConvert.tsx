import { useState } from 'react'

interface Unit { id: string; label: string; f: number } // f = 相对基准单位的倍数
interface Cat { key: string; label: string; icon: string; def: string; units: Unit[] }

// factor 均为「1 单位 = f 个基准单位」；温度单独处理（非线性）
const CATS: Cat[] = [
  {
    key: 'length', label: '长度', icon: '📏', def: 'm',
    units: [
      { id: 'mm', label: '毫米 mm', f: 0.001 },
      { id: 'cm', label: '厘米 cm', f: 0.01 },
      { id: 'm', label: '米 m', f: 1 },
      { id: 'km', label: '千米 km', f: 1000 },
      { id: 'in', label: '英寸 in', f: 0.0254 },
      { id: 'ft', label: '英尺 ft', f: 0.3048 },
      { id: 'mi', label: '英里 mi', f: 1609.344 },
    ],
  },
  {
    key: 'area', label: '面积', icon: '▦', def: 'm2',
    units: [
      { id: 'cm2', label: '平方厘米', f: 0.0001 },
      { id: 'm2', label: '平方米', f: 1 },
      { id: 'km2', label: '平方千米', f: 1e6 },
      { id: 'mu', label: '亩', f: 666.6667 },
      { id: 'ha', label: '公顷', f: 10000 },
    ],
  },
  {
    key: 'mass', label: '质量', icon: '⚖️', def: 'kg',
    units: [
      { id: 'g', label: '克 g', f: 0.001 },
      { id: 'kg', label: '千克 kg', f: 1 },
      { id: 't', label: '吨 t', f: 1000 },
      { id: 'lb', label: '磅 lb', f: 0.45359237 },
      { id: 'jin', label: '斤', f: 0.5 },
    ],
  },
  {
    key: 'volume', label: '体积', icon: '🧊', def: 'l',
    units: [
      { id: 'ml', label: '毫升 ml', f: 0.001 },
      { id: 'l', label: '升 L', f: 1 },
      { id: 'm3', label: '立方米 m³', f: 1000 },
    ],
  },
  {
    key: 'speed', label: '速度', icon: '🚀', def: 'kmh',
    units: [
      { id: 'mps', label: '米/秒', f: 1 },
      { id: 'kmh', label: '千米/时', f: 0.2777778 },
      { id: 'mph', label: '英里/时', f: 0.44704 },
      { id: 'kn', label: '节', f: 0.5144444 },
    ],
  },
  {
    key: 'data', label: '数据存储', icon: '💾', def: 'mb',
    units: [
      { id: 'b', label: '字节 B', f: 1 },
      { id: 'kb', label: '千字节 KB', f: 1024 },
      { id: 'mb', label: '兆字节 MB', f: 1024 ** 2 },
      { id: 'gb', label: '吉字节 GB', f: 1024 ** 3 },
      { id: 'tb', label: '太字节 TB', f: 1024 ** 4 },
    ],
  },
]

// 温度：单位间非线性，用摄氏度做中转
const TEMP_CAT: Cat = {
  key: 'temp', label: '温度', icon: '🌡️', def: 'c',
  units: [
    { id: 'c', label: '摄氏度 °C', f: 1 },
    { id: 'f', label: '华氏度 °F', f: 1 },
    { id: 'k', label: '开尔文 K', f: 1 },
  ],
}
const toC = (v: number, u: string) => (u === 'c' ? v : u === 'f' ? ((v - 32) * 5) / 9 : v - 273.15)
const fromC = (c: number, u: string) => (u === 'c' ? c : u === 'f' ? (c * 9) / 5 + 32 : c + 273.15)

const trim = (n: number) => {
  if (!Number.isFinite(n)) return '—'
  const r = Math.round(n * 1e8) / 1e8
  return r.toLocaleString('zh-CN', { maximumFractionDigits: 8 })
}

const ALL_CATS = [...CATS, TEMP_CAT]

export default function UnitConvert() {
  const [catKey, setCatKey] = useState('length')
  const [value, setValue] = useState('1')
  const [from, setFrom] = useState('m')

  const isTemp = catKey === 'temp'
  const cat = ALL_CATS.find((c) => c.key === catKey)!
  const v = parseFloat(value)
  const valid = Number.isFinite(v)
  const fromUnit = cat.units.find((x) => x.id === from)

  const switchCat = (c: Cat) => {
    setCatKey(c.key)
    setFrom(c.def)
  }

  return (
    <div className="unit">
      <div className="unit-cats">
        {ALL_CATS.map((c) => (
          <button
            key={c.key}
            type="button"
            className={`unit-cat ${catKey === c.key ? 'active' : ''}`}
            onClick={() => switchCat(c)}
          >
            <span className="unit-cat-icon">{c.icon}</span>
            {c.label}
          </button>
        ))}
      </div>

      <div className="unit-input-row">
        <input
          className="unit-value"
          type="number"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder="输入数值"
        />
        <select
          className="unit-select"
          value={fromUnit ? from : cat.def}
          onChange={(e) => setFrom(e.target.value)}
        >
          {cat.units.map((u) => (
            <option key={u.id} value={u.id}>{u.label}</option>
          ))}
        </select>
      </div>

      {valid && fromUnit ? (
        <div className="unit-results">
          {cat.units.map((u) => {
            let out: number
            if (isTemp) {
              out = fromC(toC(v, from), u.id)
            } else {
              out = (v * fromUnit.f) / u.f
            }
            return (
              <div key={u.id} className={`unit-row ${u.id === from ? 'unit-row-src' : ''}`}>
                <span className="unit-row-label">{u.label}</span>
                <span className="unit-row-value">{trim(out)}</span>
              </div>
            )
          })}
        </div>
      ) : (
        <p className="unit-empty">请输入有效数值。</p>
      )}
    </div>
  )
}
