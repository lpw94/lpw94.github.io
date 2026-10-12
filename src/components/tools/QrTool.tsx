import { useEffect, useState } from 'react'
import QRCode from 'qrcode'
import { toast } from '../../lib/toast'

const SIZES = [
  { v: 160, label: '小 160px' },
  { v: 256, label: '中 256px' },
  { v: 384, label: '大 384px' },
]

/** 二维码生成器：输入文本/链接，实时生成可下载的 PNG 二维码 */
export default function QrTool() {
  const [text, setText] = useState('')
  const [size, setSize] = useState(256)
  const [url, setUrl] = useState('')

  useEffect(() => {
    const t = text.trim()
    if (!t) { setUrl(''); return }
    QRCode.toDataURL(t, { width: size, margin: 1, errorCorrectionLevel: 'M' })
      .then(setUrl)
      .catch(() => { setUrl(''); toast('二维码生成失败', 'error') })
  }, [text, size])

  const download = () => {
    if (!url) return
    const a = document.createElement('a')
    a.href = url
    a.download = `qrcode-${size}.png`
    document.body.appendChild(a)
    a.click()
    a.remove()
    toast('二维码已下载', 'success')
  }

  return (
    <div className="qr">
      <label className="qr-field">
        <span>文本 / 链接</span>
        <textarea
          rows={3}
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="输入网址或任意文本，实时生成二维码"
        />
      </label>
      <div className="qr-sizes">
        <span>尺寸</span>
        {SIZES.map((s) => (
          <button
            key={s.v}
            type="button"
            className={size === s.v ? 'active' : ''}
            onClick={() => setSize(s.v)}
          >
            {s.label}
          </button>
        ))}
      </div>
      <div className="qr-preview">
        {url ? (
          <>
            <img src={url} alt="二维码预览" width={size} height={size} />
            <button type="button" className="btn-primary qr-download" onClick={download}>
              下载 PNG
            </button>
          </>
        ) : (
          <p className="qr-empty">输入内容后这里会显示二维码</p>
        )}
      </div>
    </div>
  )
}
