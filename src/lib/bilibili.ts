// B 站嵌入式播放器：放映厅的「B 站影视」标签用它放视频。
//
// 为什么只嵌播放器、不嵌整站：www.bilibili.com 带 X-Frame-Options，嵌进去是白屏；
// player.bilibili.com 是 B 站官方提供给站外嵌入的播放器页，没有该限制（实测 readyState=4 可播）。
// 片子能不能看取决于 B 站侧的版权与分区权限，本站只做播放器壳。
const LS_KEY = 'cinema-bili'

export interface BiliRef {
  /** BV 号，如 BV1GJ411x7h7 */
  bvid: string
  /** 分 P，从 1 开始 */
  page: number
}

const BV_RE = /BV[0-9A-Za-z]{10}/

/**
 * 从「BV 号 / 完整链接」里取出 bvid 与分 P。
 * 支持 bilibili.com/video/BVxxx?p=2、m.bilibili.com、带一堆 query 的分享链接；
 * b23.tv 短链在前端无法展开，需要用户先点开复制成完整链接。
 */
export function parseBv(input: string): BiliRef | null {
  const s = input.trim()
  if (!s) return null
  const m = s.match(BV_RE)
  if (!m) return null
  const p = s.match(/[?&]p=(\d+)/)
  const page = p ? Number(p[1]) : 1
  return { bvid: m[0], page: page > 0 ? page : 1 }
}

/** 官方嵌入播放器地址；danmaku=0 关弹幕，high_quality=1 优先高清 */
export function playerUrl(ref: BiliRef): string {
  const q = new URLSearchParams({
    bvid: ref.bvid,
    p: String(ref.page),
    autoplay: '0',
    high_quality: '1',
    danmaku: '0',
  })
  return `https://player.bilibili.com/player.html?${q.toString()}`
}

/** 在 B 站打开原页面（看不清 / 要选集 / 要评论时用） */
export function watchUrl(ref: BiliRef): string {
  return `https://www.bilibili.com/video/${ref.bvid}${ref.page > 1 ? `?p=${ref.page}` : ''}`
}

export function loadBili(): BiliRef | null {
  try {
    const raw = localStorage.getItem(LS_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as Partial<BiliRef>
    if (!parsed.bvid || !BV_RE.test(parsed.bvid)) return null
    return { bvid: parsed.bvid, page: parsed.page && parsed.page > 0 ? parsed.page : 1 }
  } catch {
    return null
  }
}

export function saveBili(ref: BiliRef): void {
  try {
    localStorage.setItem(LS_KEY, JSON.stringify(ref))
  } catch {
    /* 隐私模式下写不进去，本次会话照常播 */
  }
}
