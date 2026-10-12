import { useState } from 'react'
import { toast } from '../../lib/toast'

type Mode = 'base64' | 'url'

// TextEncoder 处理 UTF-8，避免 btoa 对中文报错
const b64encode = (s: string) => {
  const bytes = new TextEncoder().encode(s)
  let bin = ''
  bytes.forEach((b) => (bin += String.fromCharCode(b)))
  return btoa(bin)
}
const b64decode = (s: string) => {
  const bin = atob(s.trim())
  const bytes = Uint8Array.from(bin, (c) => c.charCodeAt(0))
  return new TextDecoder().decode(bytes)
}

/** Base64 / URL 编解码 */
export default function CodecTool() {
  const [mode, setMode] = useState<Mode>('base64')
  const [input, setInput] = useState('')
  const [output, setOutput] = useState('')
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null)

  const encode = () => {
    if (!input) { setMsg({ ok: false, text: '请输入内容' }); return }
    try { setOutput(mode === 'base64' ? b64encode(input) : encodeURIComponent(input)); setMsg({ ok: true, text: '已编码' }) }
    catch { setOutput(''); setMsg({ ok: false, text: '编码失败' }) }
  }
  const decode = () => {
    if (!input) { setMsg({ ok: false, text: '请输入内容' }); return }
    try { setOutput(mode === 'base64' ? b64decode(input) : decodeURIComponent(input)); setMsg({ ok: true, text: '已解码' }) }
    catch (e) { setOutput(''); setMsg({ ok: false, text: `解码失败：${(e as Error).message}` }) }
  }
  const swap = () => { setInput(output); setOutput(''); setMsg(null) }
  const copy = async () => {
    if (!output) return
    try { await navigator.clipboard.writeText(output); toast('已复制到剪贴板', 'success') }
    catch { toast('复制失败', 'error') }
  }

  return (
    <div className="tl-grid">
      <div className="tl-actions">
        <button type="button" className={`tl-btn ${mode === 'base64' ? 'active' : ''}`} onClick={() => { setMode('base64'); setOutput(''); setMsg(null) }}>Base64</button>
        <button type="button" className={`tl-btn ${mode === 'url' ? 'active' : ''}`} onClick={() => { setMode('url'); setOutput(''); setMsg(null) }}>URL</button>
      </div>
      <label className="tl-field">
        <span>输入</span>
        <textarea className="tl-area" value={input} onChange={(e) => setInput(e.target.value)} placeholder="输入要编码 / 解码的内容" />
      </label>
      <div className="tl-actions">
        <button type="button" className="tl-btn primary" onClick={encode}>编码 ↓</button>
        <button type="button" className="tl-btn primary" onClick={decode}>解码 ↓</button>
        <button type="button" className="tl-btn" onClick={swap} disabled={!output}>结果转输入</button>
        <button type="button" className="tl-btn" onClick={copy} disabled={!output}>复制结果</button>
      </div>
      {msg && <p className={`tl-msg ${msg.ok ? 'ok' : 'err'}`}>{msg.text}</p>}
      {output && <pre className="tl-out">{output}</pre>}
    </div>
  )
}
