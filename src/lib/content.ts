// 正文格式判断：后台支持「富文本（HTML）」和「纯文本 / Markdown」两种编辑方式，
// 存进数据库的都是同一个 content 字段，所以由内容本身来决定怎么渲染。
//
// 判定前必须先剥掉代码块与行内代码，否则会大面积误判：
// 技术文章里「提到」某个标签非常常见（例如行内的 `<p>`、`<img>`），
// 一旦被判成 HTML，整篇 Markdown 会被原样输出，表现为「详情页没有格式」。
const FENCED_CODE = /```[\s\S]*?```|~~~[\s\S]*?~~~/g
const INLINE_CODE = /`[^`\n]*`/g

// 纯 Markdown 在代码之外一般不会出现这些块级/行内标签，用它们做判断足够可靠。
const HTML_TAG =
  /<\/?(p|h[1-6]|ul|ol|li|blockquote|pre|strong|em|a|br|img|figure|table)\b[^>]*>/i

export function looksLikeHtml(content: string) {
  const stripped = content.replace(FENCED_CODE, ' ').replace(INLINE_CODE, ' ')
  return HTML_TAG.test(stripped)
}

/** 剥掉 HTML 标签，用于生成 meta description 摘要 */
export function toPlainText(content: string) {
  return content.replace(/<[^>]+>/g, ' ')
}

/**
 * 估算阅读时长（分钟）。中文按约 400 字/分钟，英文单词按 200 词/分钟，
 * 取两者较大值避免低估。代码块会拉高字数但阅读快，这里仍按纯文本粗算，够用。
 */
export function readingTime(content: string): number {
  const text = toPlainText(content)
  const cjk = (text.match(/[一-龥]/g) || []).length
  const words = (text.replace(/[一-龥]/g, ' ').match(/[A-Za-z0-9]+/g) || []).length
  const minutes = Math.max(cjk / 400, words / 200)
  return Math.max(1, Math.round(minutes))
}
