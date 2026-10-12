import { useEffect, useState } from 'react'

type Op = '+' | '-' | '×' | '÷'

const applyOp = (a: number, b: number, op: Op): number => {
  switch (op) {
    case '+': return a + b
    case '-': return a - b
    case '×': return a * b
    case '÷': return b === 0 ? NaN : a / b
  }
}

/** 规整浮点误差：四舍五入到 10 位小数并去掉多余的 0，避免 0.1+0.2=0.30000000000000004 */
const fmt = (n: number): string => {
  if (!Number.isFinite(n)) return '错误'
  return String(Math.round(n * 1e10) / 1e10)
}

/** 标准计算器：四则运算、连续运算、百分比、正负、退格；支持物理键盘 */
export default function Calculator() {
  const [display, setDisplay] = useState('0')
  const [prev, setPrev] = useState<number | null>(null)
  const [op, setOp] = useState<Op | null>(null)
  // waiting：刚按了运算符或 =，下次输入数字应替换而不是追加
  const [waiting, setWaiting] = useState(false)

  const inputDigit = (d: string) => {
    if (waiting) { setDisplay(d); setWaiting(false); return }
    setDisplay(display === '0' ? d : display + d)
  }
  const inputDot = () => {
    if (waiting) { setDisplay('0.'); setWaiting(false); return }
    if (!display.includes('.')) setDisplay(display + '.')
  }
  const clearAll = () => { setDisplay('0'); setPrev(null); setOp(null); setWaiting(false) }
  const backspace = () => {
    if (waiting) return
    setDisplay(display.length > 1 ? display.slice(0, -1) : '0')
  }
  const toggleSign = () => {
    if (display === '0') return
    setDisplay(display.startsWith('-') ? display.slice(1) : '-' + display)
  }
  const percent = () => setDisplay(fmt(parseFloat(display) / 100))
  const chooseOp = (nextOp: Op) => {
    const cur = parseFloat(display)
    if (prev === null) {
      setPrev(cur)
    } else if (op && !waiting) {
      const res = applyOp(prev, cur, op)
      setPrev(res)
      setDisplay(fmt(res))
    }
    setOp(nextOp)
    setWaiting(true)
  }
  const equals = () => {
    if (op === null || prev === null) return
    const res = applyOp(prev, parseFloat(display), op)
    setDisplay(fmt(res))
    setPrev(null)
    setOp(null)
    setWaiting(true)
  }

  // 物理键盘支持（内联逻辑引用最新 state，随 state 变化重新绑定）
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const k = e.key
      if (/^\d$/.test(k)) {
        const d = display === '0' || waiting ? k : display + k
        setDisplay(d); setWaiting(false)
      } else if (k === '.') {
        if (waiting) { setDisplay('0.'); setWaiting(false) }
        else if (!display.includes('.')) setDisplay(display + '.')
      } else if (k === '+' || k === '-' || k === '*' || k === '/') {
        const nextOp = k === '*' ? '×' : k === '/' ? '÷' : (k as Op)
        const cur = parseFloat(display)
        if (prev === null) setPrev(cur)
        else if (op && !waiting) { const r = applyOp(prev, cur, op); setPrev(r); setDisplay(fmt(r)) }
        setOp(nextOp); setWaiting(true)
        if (k === '/') e.preventDefault()
      } else if (k === 'Enter' || k === '=') {
        e.preventDefault()
        if (op !== null && prev !== null) {
          const r = applyOp(prev, parseFloat(display), op)
          setDisplay(fmt(r)); setPrev(null); setOp(null); setWaiting(true)
        }
      } else if (k === 'Backspace') {
        if (!waiting) setDisplay(display.length > 1 ? display.slice(0, -1) : '0')
      } else if (k === 'Escape') {
        clearAll()
      } else if (k === '%') {
        setDisplay(fmt(parseFloat(display) / 100))
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [display, prev, op, waiting])

  const keys: { l: string; a: () => void; cls?: string }[] = [
    { l: 'C', a: clearAll, cls: 'fn' },
    { l: '⌫', a: backspace, cls: 'fn' },
    { l: '%', a: percent, cls: 'fn' },
    { l: '÷', a: () => chooseOp('÷'), cls: 'op' },
    { l: '7', a: () => inputDigit('7') },
    { l: '8', a: () => inputDigit('8') },
    { l: '9', a: () => inputDigit('9') },
    { l: '×', a: () => chooseOp('×'), cls: 'op' },
    { l: '4', a: () => inputDigit('4') },
    { l: '5', a: () => inputDigit('5') },
    { l: '6', a: () => inputDigit('6') },
    { l: '-', a: () => chooseOp('-'), cls: 'op' },
    { l: '1', a: () => inputDigit('1') },
    { l: '2', a: () => inputDigit('2') },
    { l: '3', a: () => inputDigit('3') },
    { l: '+', a: () => chooseOp('+'), cls: 'op' },
    { l: '±', a: toggleSign, cls: 'fn' },
    { l: '0', a: () => inputDigit('0') },
    { l: '.', a: inputDot },
    { l: '=', a: equals, cls: 'eq' },
  ]

  return (
    <div className="calc">
      <div className="calc-screen">
        <span className="calc-expr">
          {prev !== null && op ? `${fmt(prev)} ${op}` : '\u00a0'}
        </span>
        <span className="calc-display">{display}</span>
      </div>
      <div className="calc-keys">
        {keys.map((k) => (
          <button
            key={k.l}
            type="button"
            className={`calc-key ${k.cls ?? ''}`}
            onClick={k.a}
          >
            {k.l}
          </button>
        ))}
      </div>
      <p className="calc-hint">支持键盘：数字 / + - * / 、Enter 计算、Backspace 退格、Esc 清空</p>
    </div>
  )
}
