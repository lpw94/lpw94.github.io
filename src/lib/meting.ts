/**
 * 网易云歌单接入。
 *
 * 走的是 **Meting 协议**：MetingJS 本身只是一层薄封装，做的事就是
 *   1) 请求 `<meting-api>?server=netease&type=playlist&id=<歌单ID>` 拿到曲目数组；
 *   2) 把数组喂给 APlayer 初始化。
 * 这里把第 1 步抽出来自己实现（而不是注入 MetingJS 的 `<meting-js>` 标签），
 * 原因是：远程脚本一旦被墙或 CDN 抽风，整个播放器就直接空白；
 * 而且它自建的 fixed 播放器脱离 React，卸载时清理不干净。
 *
 * 公共 Meting 接口返回的直链有相当一部分是 404（网易云版权 / VIP 限制），
 * 所以拿到列表后要逐首探测一次，只留能播的——这一步是「点了就能响」的关键。
 */

export type Song = {
  name: string
  artist: string
  url: string
  cover: string
  lrc?: string
}

/** 默认接口：i-meto 的公开实例，实测带 `Access-Control-Allow-Origin: *` */
const DEFAULT_API = 'https://api.i-meto.com/meting/api'
/**
 * 默认歌单：云音乐原创榜（2884035）。
 * 挑它是因为实测可播率最高——同为官方榜单，前 80 首里热歌榜只有 23% 能播、
 * 新歌榜 21%、飙升榜 29%，原创榜有 39%。公共 Meting 接口拿不到会员曲目的直链，
 * 换自己的歌单（ID 从分享链接里取）通常还能更高一些。
 */
const DEFAULT_PLAYLIST = '2884035'

export const METING_API = (import.meta.env.VITE_METING_API as string) || DEFAULT_API
export const PLAYLIST_ID = (import.meta.env.VITE_NETEASE_PLAYLIST as string) || DEFAULT_PLAYLIST
export const METING_SERVER = (import.meta.env.VITE_METING_SERVER as string) || 'netease'

/** 每次最多探测多少首（歌单动辄 200 首，全探太慢） */
const MAX_PROBE = 100
/** 探测并发数：太高容易被网易云限流 */
const PROBE_CONCURRENCY = 8
/** 缓存有效期：直链带签名，放久了会失效 */
const CACHE_TTL = 6 * 60 * 60 * 1000
const CACHE_KEY = `meting:v1:${METING_SERVER}:${PLAYLIST_ID}`

const buildUrl = (params: Record<string, string>) => {
  const q = new URLSearchParams({ server: METING_SERVER, ...params })
  return `${METING_API}?${q.toString()}`
}

/** 拉原始歌单；不同 Meting 实例返回的字段名不一样，统一成 Song */
export async function fetchPlaylist(): Promise<Song[]> {
  const url = buildUrl({ type: 'playlist', id: PLAYLIST_ID })
  const res = await fetch(url)
  if (!res.ok) throw new Error(`歌单请求失败（HTTP ${res.status}）`)
  const raw = await res.json()
  if (!Array.isArray(raw) || raw.length === 0) throw new Error('歌单为空或返回格式异常')

  return raw
    .map((t: Record<string, string>) => ({
      name: t.title || t.name || '未知曲目',
      artist: t.author || t.artist || '未知歌手',
      url: t.url || '',
      cover: t.pic || t.cover || '',
      lrc: t.lrc || '',
    }))
    .filter((s) => s.url)
}

/**
 * 探测单首能否播放。
 * 用 Range 只取 1 字节：接口会 302 跳到 CDN，最终 206 就是可播，404 就是版权受限。
 * 音频域同样放行跨域，所以浏览器里能直接判断。
 */
async function canPlay(url: string): Promise<boolean> {
  const ctrl = new AbortController()
  const timer = setTimeout(() => ctrl.abort(), 6000)
  try {
    const res = await fetch(url, {
      headers: { Range: 'bytes=0-1' },
      signal: ctrl.signal,
    })
    if (!res.ok) return false
    const type = res.headers.get('content-type') || ''
    // 有些失效链接会返回 200 的 HTML 错误页
    return !type.includes('text/html')
  } catch {
    return false
  } finally {
    clearTimeout(timer)
  }
}

/** 有并发上限的 map，避免一次性打 60 个请求 */
async function mapLimit<T, R>(
  items: T[],
  limit: number,
  fn: (item: T, index: number) => Promise<R>
): Promise<R[]> {
  const out: R[] = new Array(items.length)
  let cursor = 0
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (cursor < items.length) {
      const i = cursor++
      out[i] = await fn(items[i], i)
    }
  })
  await Promise.all(workers)
  return out
}

function readCache(): Song[] | null {
  try {
    const raw = localStorage.getItem(CACHE_KEY)
    if (!raw) return null
    const { at, songs } = JSON.parse(raw) as { at: number; songs: Song[] }
    if (!Array.isArray(songs) || !songs.length) return null
    if (Date.now() - at > CACHE_TTL) return null
    return songs
  } catch {
    return null
  }
}

function writeCache(songs: Song[]) {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify({ at: Date.now(), songs }))
  } catch {
    // 隐私模式下可能写不进去，忽略
  }
}

export type LoadResult = {
  songs: Song[]
  total: number
  /** 是否直接来自本地缓存（跳过了探测） */
  cached: boolean
}

/**
 * 加载歌单：缓存命中直接返回，否则拉取 + 探测 + 写缓存。
 * onProgress 用于在界面上显示「正在检查 12/60」。
 */
export async function loadPlaylist(
  onProgress?: (done: number, total: number) => void
): Promise<LoadResult> {
  const cached = readCache()
  if (cached) return { songs: cached, total: cached.length, cached: true }

  const all = await fetchPlaylist()
  const target = all.slice(0, MAX_PROBE)

  let done = 0
  onProgress?.(0, target.length)
  const flags = await mapLimit(target, PROBE_CONCURRENCY, async (song) => {
    const ok = await canPlay(song.url)
    done += 1
    onProgress?.(done, target.length)
    return ok
  })

  const songs = target.filter((_, i) => flags[i])
  if (!songs.length) throw new Error('这个歌单在当前接口下没有可播放的曲目，换一个歌单试试')

  writeCache(songs)
  return { songs, total: all.length, cached: false }
}

/** 清掉缓存（换歌单或手动刷新时用） */
export function clearCache() {
  try {
    localStorage.removeItem(CACHE_KEY)
  } catch {
    /* ignore */
  }
}
