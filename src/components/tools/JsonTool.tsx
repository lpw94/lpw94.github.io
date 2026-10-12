import { useState } from 'react'
import { toast } from '../../lib/toast'

/** JSON 格式化 / 压缩 / 校验 */
export default function JsonTool() {
  const [input, setInput] = useState('')
  const [output, setOutput] = useState('')
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null)

  const run = (mode: 'format' | 'minify') => {
    if (!input.trim()) { setMsg({ ok: false, text: '请输入 JSON' }); return }
    try {
      const obj = JSON.parse(input)
      setOutput(mode === 'format' ? JSON.stringify(obj, null, 2) : JSON.stringify(obj))
      setMsg({ ok: true, text: 'JSON 合法' })
    } catch (e) {
      setOutput('')
      setMsg({ ok: false, text: `解析失败：${(e as Error).message}` })
    }
  }
  const copy = async () => {
    if (!output) return
    try { await navigator.clipboard.writeText(output); toast('已复制到剪贴板', 'success') }
    catch { toast('复制失败', 'error') }
  }
  const clear = () => { setInput(''); setOutput(''); setMsg(null) }

  return (
    <div className="tl-grid">
      <label className="tl-field">
        <span>输入 JSON</span>
        <textarea
          className="tl-area"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder={'{"name":"沃哥","age":18,"tags":["前端","博客"]}'}
        />
      </label>
      <div className="tl-actions">
        <button type="button" className="tl-btn primary" onClick={() => run('format')}>格式化</button>
        <button type="button" className="tl-btn" onClick={() => run('minify')}>压缩</button>
        <button type="button" className="tl-btn" onClick={copy} disabled={!output}>复制结果</button>
        <button type="button" className="tl-btn" onClick={clear}>清空</button>
      </div>
      {msg && <p className={`tl-msg ${msg.ok ? 'ok' : 'err'}`}>{msg.text}</p>}
      {output && <pre className="tl-out">{output}</pre>}
    </div>
  )
}
