import { useState } from 'react'

/**
 * 文章 PDF 附件：默认只显示一张卡片，点「在线预览」才创建 iframe。
 * 用浏览器原生 PDF 阅读器，不引入 pdf.js（体积大、还要配 worker/CDN）；
 * 移动端浏览器内嵌 PDF 支持不一，所以同时保留「新窗口打开」兜底。
 */
export default function PdfAttachment({
  url,
  name,
}: {
  url: string
  name?: string | null
}) {
  const [open, setOpen] = useState(false)

  const label = name?.trim() || 'PDF 文档'
  const fileName = /\.pdf$/i.test(label) ? label : `${label}.pdf`
  // #toolbar / view 是浏览器 PDF 插件的通用参数；先剥掉原有 hash 避免拼成两个 #
  const baseUrl = url.split('#')[0]
  const viewerUrl = `${baseUrl}#toolbar=1&navpanes=0&view=FitH`
  // Supabase Storage 支持 ?download= 强制 Content-Disposition，跨域时比 a[download] 可靠
  const downloadUrl = baseUrl.includes('/storage/v1/object/public/')
    ? `${baseUrl}${baseUrl.includes('?') ? '&' : '?'}download=${encodeURIComponent(fileName)}`
    : baseUrl

  return (
    <section className="pdf-attachment" aria-label="PDF 附件">
      <div className="pdf-attachment-head">
        <div className="pdf-attachment-info">
          <span className="pdf-attachment-icon" aria-hidden="true">📄</span>
          <span className="pdf-attachment-name" title={label}>{label}</span>
          <span className="pdf-attachment-tag">PDF</span>
        </div>
        <div className="pdf-attachment-actions">
          <button
            type="button"
            className={open ? 'active' : ''}
            onClick={() => setOpen((v) => !v)}
          >
            {open ? '收起预览' : '在线预览'}
          </button>
          <a href={url} target="_blank" rel="noreferrer">
            新窗口打开
          </a>
          <a href={downloadUrl} download={fileName}>
            下载
          </a>
        </div>
      </div>

      {open && (
        <>
          <div className="pdf-frame">
            <iframe src={viewerUrl} title={`${label} 在线预览`} loading="lazy" />
          </div>
          <p className="pdf-frame-hint muted">
            预览使用浏览器自带的 PDF 阅读器；手机上若不显示，请点「新窗口打开」。
          </p>
        </>
      )}
    </section>
  )
}
