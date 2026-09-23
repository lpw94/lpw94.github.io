// 正文格式判断：后台支持「富文本（HTML）」和「纯文本 / Markdown」两种编辑方式，
// 存进数据库的都是同一个 content 字段，所以由内容本身来决定怎么渲染。
// 纯 Markdown 一般不会出现这些块级/行内标签，用它们做判断足够可靠。
const HTML_TAG =
  /<\/?(p|h[1-6]|ul|ol|li|blockquote|pre|strong|em|a|br|img|figure|table)\b[^>]*>/i

export function looksLikeHtml(content: string) {
  return HTML_TAG.test(content)
}

/** 剥掉 HTML 标签，用于生成 meta description 摘要 */
export function toPlainText(content: string) {
  return content.replace(/<[^>]+>/g, ' ')
}
