import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import QRCode from 'qrcode'

type Props = {
  open: boolean
  onClose: () => void
  title: string
  summary: string
  url: string
  author?: string
  siteName?: string
  /** 同域头像，避免 canvas 被跨域图片污染导致无法导出 */
  avatar?: string
}

const W = 600
const H = 860

/** 圆角矩形（兼容不支持 ctx.roundRect 的环境） */
function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath()
  ctx.moveTo(x + r, y)
  ctx.arcTo(x + w, y, x + w, y + h, r)
  ctx.arcTo(x + w, y + h, x, y + h, r)
  ctx.arcTo(x, y + h, x, y, r)
  ctx.arcTo(x, y, x + w, y, r)
  ctx.closePath()
}

/** 按最大宽度把文字折成多行，超 maxLines 行则末行省略 */
function wrapText(ctx: CanvasRenderingContext2D, text: string, maxWidth: number, maxLines: number) {
  const chars = Array.from(text)
  const lines: string[] = []
  let line = ''
  for (const ch of chars) {
    const test = line + ch
    if (ctx.measureText(test).width > maxWidth && line) {
      lines.push(line)
      line = ch
      if (lines.length === maxLines - 1) break
    } else {
      line = test
    }
  }
  if (lines.length < maxLines) lines.push(line)
  else {
    // 末尾行压缩，超出加省略号
    let last = lines[maxLines - 1]
    while (last && ctx.measureText(last + '…').width > maxWidth) last = last.slice(0, -1)
    lines[maxLines - 1] = last + '…'
  }
  return lines
}

/**
 * 分享海报：用 canvas 绘制一张带二维码的分享图，可「保存图片」（桌面下载）或
 * 移动端长按弹出的 `<img>` 保存到相册。刻意只使用同域头像 + 本地生成的二维码，
 * 不绘制远程封面图，避免 canvas 被跨域图片污染后 toDataURL 抛安全错误。
 */
export default function SharePoster({ open, onClose, title, summary, url, author, siteName = '沃哥博客', avatar = '/avatar.png' }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [poster, setPoster] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!open) return
    setPoster('')
    setError('')
    const canvas = canvasRef.current
    if (!canvas) return
    const dpr = Math.min(window.devicePixelRatio || 1, 2)
    canvas.width = W * dpr
    canvas.height = H * dpr
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    ctx.scale(dpr, dpr)

    const pad = 40
    const cardX = 34
    const cardY = 34
    const cardW = W - cardX * 2
    const cardH = H - cardY * 2

    // 背景渐变
    const bg = ctx.createLinearGradient(0, 0, 0, H)
    bg.addColorStop(0, '#6366f1')
    bg.addColorStop(1, '#8b5cf6')
    ctx.fillStyle = bg
    ctx.fillRect(0, 0, W, H)

    // 白色卡片
    ctx.fillStyle = '#ffffff'
    roundRect(ctx, cardX, cardY, cardW, cardH, 26)
    ctx.fill()

    // 顶部：头像 + 站点名
    const avatarD = 64
    const avatarX = cardX + pad
    const avatarY = cardY + pad
    ctx.save()
    ctx.beginPath()
    ctx.arc(avatarX + avatarD / 2, avatarY + avatarD / 2, avatarD / 2, 0, Math.PI * 2)
    ctx.closePath()
    ctx.clip()
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => ctx.drawImage(img, avatarX, avatarY, avatarD, avatarD)
    img.onerror = () => {
      // 头像加载失败也不影响海报（画个纯色圆兜底）
      ctx.fillStyle = '#e5e7eb'
      ctx.fillRect(avatarX, avatarY, avatarD, avatarD)
    }
    img.src = avatar
    ctx.restore()

    ctx.fillStyle = '#111827'
    ctx.font = '600 22px -apple-system, "PingFang SC", "Microsoft YaHei", sans-serif'
    ctx.textBaseline = 'middle'
    ctx.fillText(siteName, avatarX + avatarD + 16, avatarY + 18)
    ctx.fillStyle = '#6b7280'
    ctx.font = '400 14px -apple-system, "PingFang SC", "Microsoft YaHei", sans-serif'
    ctx.fillText(`${author ? author + ' 的文章' : '分享一篇文章'}`, avatarX + avatarD + 16, avatarY + 44)

    // 标题（最多 3 行）
    let y = avatarY + avatarD + 36
    ctx.fillStyle = '#111827'
    ctx.font = '700 30px -apple-system, "PingFang SC", "Microsoft YaHei", sans-serif'
    const titleLines = wrapText(ctx, title, cardW - pad * 2, 3)
    for (const ln of titleLines) {
      ctx.fillText(ln, cardX + pad, y)
      y += 42
    }

    // 分隔线
    y += 6
    ctx.strokeStyle = '#eef0f4'
    ctx.lineWidth = 2
    ctx.beginPath()
    ctx.moveTo(cardX + pad, y)
    ctx.lineTo(cardX + cardW - pad, y)
    ctx.stroke()

    // 摘要（最多 7 行）
    y += 26
    ctx.fillStyle = '#4b5563'
    ctx.font = '400 17px -apple-system, "PingFang SC", "Microsoft YaHei", sans-serif'
    const sumLines = wrapText(ctx, summary || '点击查看全文，获取完整内容与代码示例。', cardW - pad * 2, 7)
    for (const ln of sumLines) {
      ctx.fillText(ln, cardX + pad, y)
      y += 28
    }

    // 底部二维码区
    const qrSize = 168
    const qrX = cardX + (cardW - qrSize) / 2
    const qrY = cardY + cardH - qrSize - 70
    ctx.fillStyle = '#ffffff'
    roundRect(ctx, qrX - 12, qrY - 12, qrSize + 24, qrSize + 24, 16)
    ctx.fill()
    ctx.strokeStyle = '#eef0f4'
    ctx.lineWidth = 1
    ctx.stroke()

    ctx.fillStyle = '#6b7280'
    ctx.font = '400 15px -apple-system, "PingFang SC", "Microsoft YaHei", sans-serif'
    ctx.textAlign = 'center'
    ctx.fillText('长按识别二维码 · 阅读全文', W / 2, qrY + qrSize + 30)
    ctx.textAlign = 'left'

    // 生成二维码并合成（异步）
    QRCode.toDataURL(url, {
      width: qrSize * dpr,
      margin: 1,
      color: { dark: '#111827', light: '#ffffff' },
    })
      .then((dataUrl) => {
        const qr = new Image()
        qr.onload = () => {
          ctx.drawImage(qr, qrX, qrY, qrSize, qrSize)
          setPoster(canvas.toDataURL('image/png'))
        }
        qr.onerror = () => setError('二维码生成失败，请直接复制链接分享。')
        qr.src = dataUrl
      })
      .catch(() => setError('二维码生成失败，请直接复制链接分享。'))
  }, [open, title, summary, url, author, siteName, avatar])

  const save = () => {
    if (!poster) return
    setSaving(true)
    const a = document.createElement('a')
    a.href = poster
    a.download = `分享海报-${title.slice(0, 20)}.png`
    document.body.appendChild(a)
    a.click()
    a.remove()
    setSaving(false)
  }

  const copyLink = () => {
    navigator.clipboard?.writeText(url).then(() => setError('链接已复制')).catch(() => {})
  }

  if (!open) return null

  // 用 portal 挂到 body：脱离所有祖先（任何带 transform/backdrop-filter 的容器都会让
  // position:fixed 的包含块变成该祖先，页面很长时弹窗就被推到「页面中间」而非「屏幕中间」）。
  // 挂到 body 后 fixed 必然相对视口，无论页面多长都居中在屏幕上。
  return createPortal(
    <div className="poster-backdrop" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="poster-modal" role="dialog" aria-modal="true" aria-label="分享海报">
        <div className="poster-modal-head">
          <h3>分享海报</h3>
          <button type="button" className="modal-close" onClick={onClose} aria-label="关闭">
            ×
          </button>
        </div>
        <div className="poster-canvas-wrap">
          {poster ? (
            <img className="poster-img" src={poster} alt="文章分享海报" />
          ) : (
            <div className="poster-loading">海报生成中…{error && <span className="poster-err">（{error}）</span>}</div>
          )}
        </div>
        <div className="poster-actions">
          <button type="button" className="btn-primary" onClick={save} disabled={!poster || saving}>
            保存图片
          </button>
          <button type="button" className="btn-ghost" onClick={copyLink}>
            复制链接
          </button>
        </div>
        <p className="poster-tip muted">手机端可长按上方图片保存到相册</p>
        {/* 离屏画布，仅用于绘制；展示用上面的 <img> 以便移动端长按 */}
        <canvas ref={canvasRef} style={{ display: 'none' }} />
      </div>
    </div>,
    document.body,
  )
}
