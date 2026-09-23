// 时间格式化工具
// 数据库里的 published_at / created_at 是 timestamptz，PostgREST 返回的是 UTC 的 ISO 字符串
// （如 2026-09-22T01:03:51.111151+00:00）。直接 slice 出来的是 UTC 时间，
// 会比北京时间早 8 小时（所以列表里看着"都是上午"）。这里统一转成本地时区再格式化。

const pad = (n: number) => String(n).padStart(2, '0')

function toDate(iso?: string | null): Date | null {
  if (!iso) return null
  const d = new Date(iso)
  return Number.isNaN(d.getTime()) ? null : d
}

/** 本地时区的 YYYY-MM-DD */
export function formatDate(iso?: string | null): string {
  const d = toDate(iso)
  if (!d) return ''
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

/** 本地时区的 YYYY-MM-DD HH:mm */
export function formatDateTime(iso?: string | null): string {
  const d = toDate(iso)
  if (!d) return ''
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`
}
