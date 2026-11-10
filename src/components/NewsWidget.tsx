import { useEffect, useState } from 'react'

/**
 * 右栏「热点新闻」：国内热榜。
 * 数据源用开源 60s API（https://github.com/vikiboss/60s），公开、无需 key、带 CORS，
 * 浏览器直连实测可用。主源百度热点，失败自动切到镜像域的今日头条热榜。
 * 模块级缓存 10 分钟，切页面不重复请求；请求失败时沿用旧缓存，没有缓存才显示重试。
 */

type RawItem = {
  title?: string
  url?: string
  link?: string
  score_desc?: string
  hot_value?: number | string
}

type NewsItem = {
  id: string
  title: string
  url: string
  hot: string
}

type Source = { label: string; url: string }
type Cache = { at: number; items: NewsItem[]; source: string }

// 第 2 个源故意换域名 + 换榜单，主域整体故障时仍有较大概率可用
const SOURCES: Source[] = [
  { label: '百度热点', url: 'https://60s.viki.moe/v2/baidu/hot' },
  { label: '今日头条', url: 'https://60s-api.viki.moe/v2/toutiao' },
]
const TTL = 10 * 60 * 1000
const COUNT = 5

let cache: Cache | null = null
let pending: Promise<Cache> | null = null

/** 头条给的是原始热度数值，转成「万 / 亿」短文案；百度已带 score_desc 就直接用 */
function formatHot(v: unknown): string {
  const n = Number(v)
  if (!Number.isFinite(n) || n <= 0) return ''
  if (n >= 1e8) return `${(n / 1e8).toFixed(1)}亿`
  if (n >= 1e4) return `${(n / 1e4).toFixed(1)}万`
  return String(Math.round(n))
}

const searchUrl = (title: string) => `https://www.baidu.com/s?wd=${encodeURIComponent(title)}`

async function fetchSource(src: Source, signal: AbortSignal): Promise<NewsItem[]> {
  const res = await fetch(src.url, { signal })
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  const data = (await res.json()) as { data?: RawItem[] }
  const rows = Array.isArray(data.data) ? data.data.slice(0, COUNT) : []
  const items: NewsItem[] = rows
    .filter((r) => r && r.title)
    .map((r, i) => {
      const title = String(r.title)
      return {
        id: `${i}-${title}`,
        title,
        url: r.url || r.link || searchUrl(title),
        hot: r.score_desc || formatHot(r.hot_value),
      }
    })
  if (!items.length) throw new Error('榜单为空')
  return items
}

async function requestNews(): Promise<Cache> {
  let lastErr: unknown
  for (const src of SOURCES) {
    const ctl = new AbortController()
    const timer = setTimeout(() => ctl.abort(), 8000)
    try {
      const items = await fetchSource(src, ctl.signal)
      return { at: Date.now(), items, source: src.label }
    } catch (e) {
      lastErr = e
    } finally {
      clearTimeout(timer)
    }
  }
  throw lastErr ?? new Error('所有新闻源均不可用')
}

function getNews(force = false): Promise<Cache> {
  if (!force && cache && Date.now() - cache.at < TTL) return Promise.resolve(cache)
  if (!pending) {
    pending = requestNews()
      .then((c) => {
        cache = c
        return c
      })
      .finally(() => {
        pending = null
      })
  }
  return pending
}

export default function NewsWidget() {
  const [items, setItems] = useState<NewsItem[]>(cache?.items ?? [])
  const [status, setStatus] = useState<'loading' | 'ok' | 'error'>(cache ? 'ok' : 'loading')
  const [at, setAt] = useState(cache?.at ?? 0)
  const [source, setSource] = useState(cache?.source ?? '')

  const load = async (force = false) => {
    if (!force && cache) {
      setItems(cache.items)
      setAt(cache.at)
      setSource(cache.source)
      setStatus('ok')
      return
    }
    setStatus('loading')
    try {
      const c = await getNews(force)
      setItems(c.items)
      setAt(c.at)
      setSource(c.source)
      setStatus('ok')
    } catch {
      // 有旧数据就继续展示，别因为一次失败把整张卡片清空
      if (cache) {
        setItems(cache.items)
        setAt(cache.at)
        setSource(cache.source)
        setStatus('ok')
      } else {
        setStatus('error')
      }
    }
  }

  useEffect(() => {
    void load()
  }, [])

  const timeText = at
    ? new Date(at).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit', hour12: false })
    : ''

  return (
    <section className="widget-card news-widget" aria-label="热点新闻">
      <div className="ww-title">📰 热点新闻</div>

      {status === 'loading' && <div className="news-state">正在获取热点…</div>}
      {status === 'error' && (
        <div className="news-state">
          热点获取失败
          <button type="button" className="news-link" onClick={() => void load(true)}>
            重试
          </button>
        </div>
      )}
      {status === 'ok' && (
        <div className="news-list">
          {items.map((n, i) => (
            <a
              key={n.id}
              className="news-item"
              href={n.url}
              target="_blank"
              rel="noopener noreferrer"
              title={n.title}
            >
              <span className="news-rank">{i + 1}</span>
              <span className="news-body">
                <span className="news-title">{n.title}</span>
                <span className="news-meta">{n.hot ? `热度 ${n.hot}` : '点击查看'}</span>
              </span>
            </a>
          ))}
        </div>
      )}

      <div className="news-foot">
        <span>{source || '国内热点'}{timeText ? ` · ${timeText} 更新` : ''}</span>
        <button
          type="button"
          className="news-refresh"
          onClick={() => void load(true)}
          disabled={status === 'loading'}
        >
          刷新
        </button>
      </div>
    </section>
  )
}
