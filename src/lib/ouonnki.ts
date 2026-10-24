// OuonnkiTV 站点地址：放映厅的「OuonnkiTV」标签用它做 iframe 内嵌。
//
// 地址来源优先级：
//   1. .env 里的 VITE_OUONNKI_URL（构建时注入，适合给自己部署的固定站点）
//   2. 本机 localStorage（在放映厅页面上直接填，改完立刻生效，不用重新部署）
//
// 说明：OuonnkiTV 只是一个聚合播放的前端，片源由部署者自行配置。
// 这里只存「站点地址」，不内置任何视频源。
const LS_KEY = 'ouonnki-url'

const ENV_URL = (import.meta.env.VITE_OUONNKI_URL as string | undefined)?.trim() ?? ''

/** 地址是否由 .env 固定（固定时页面上不给改） */
export const OUONNKI_LOCKED_BY_ENV = Boolean(ENV_URL)

/** 补协议、去尾部斜杠；空串原样返回 */
export function normalizeUrl(raw: string): string {
  const v = raw.trim()
  if (!v) return ''
  const withProto = /^https?:\/\//i.test(v) ? v : `https://${v}`
  return withProto.replace(/\/+$/, '')
}

export function loadUrl(): string {
  if (ENV_URL) return normalizeUrl(ENV_URL)
  try {
    return normalizeUrl(localStorage.getItem(LS_KEY) ?? '')
  } catch {
    return ''
  }
}

/** 保存并返回规范化后的地址 */
export function saveUrl(raw: string): string {
  const url = normalizeUrl(raw)
  try {
    localStorage.setItem(LS_KEY, url)
  } catch {
    /* 隐私模式下写入会抛错，忽略即可：本次会话仍然可用 */
  }
  return url
}

export function clearUrl(): void {
  try {
    localStorage.removeItem(LS_KEY)
  } catch {
    /* 同上 */
  }
}

/**
 * https 页面嵌入 http 站点会被浏览器直接拦掉（混合内容），
 * 保存前先判一次，能给出比「白屏」有用的提示。
 */
export function isMixedContent(url: string): boolean {
  if (typeof window === 'undefined') return false
  return window.location.protocol === 'https:' && /^http:\/\//i.test(url)
}

export function hostOf(url: string): string {
  try {
    return new URL(url).host
  } catch {
    return url
  }
}
