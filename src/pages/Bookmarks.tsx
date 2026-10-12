import { useEffect, useMemo, useState } from 'react'
import { Helmet } from 'react-helmet-async'
import { supabase } from '../lib/supabase'
import type { Bookmark } from '../types'

// 每个分类一个主题色（循环取用），与 /tools 导航页保持一致
const PALETTE = ['#3b82f6', '#8b5cf6', '#06b6d4', '#f59e0b', '#ef4444', '#10b981']

// —— 模块级缓存：与 Home 文章列表同款思路 ——
// /bookmarks 与文章详情等路由互切时会卸载重挂，没有缓存就会重复请求 Supabase。
// 带 60s TTL：命中新鲜缓存直接渲染、不发请求；过期则后台静默刷新。
type BookmarksCache = { data: Bookmark[]; ts: number }
let bookmarksCache: BookmarksCache | null = null
const BOOKMARKS_CACHE_TTL = 60 * 1000

/** 后台增删改书签后调用，让前台下次进入立即重拉 */
export function invalidateBookmarksCache() {
  bookmarksCache = null
}

/** 从网址提取域名，卡片上显示（去掉 www. 前缀） */
function hostOf(url: string) {
  try {
    return new URL(url).hostname.replace(/^www\./, '')
  } catch {
    return url
  }
}

export default function Bookmarks() {
  const [items, setItems] = useState<Bookmark[]>(() => bookmarksCache?.data ?? [])
  const [loading, setLoading] = useState(!bookmarksCache)
  const [keyword, setKeyword] = useState('')

  useEffect(() => {
    const fresh = bookmarksCache && Date.now() - bookmarksCache.ts < BOOKMARKS_CACHE_TTL
    if (fresh) {
      // 命中未过期缓存：秒显，不发请求
      setLoading(false)
      return
    }
    const hasStale = !!bookmarksCache
    if (!hasStale) setLoading(true)
    const load = async () => {
      const { data, error } = await supabase
        .from('bookmarks')
        .select('*')
        .order('created_at', { ascending: false })
      if (!error && data) {
        bookmarksCache = { data: data as Bookmark[], ts: Date.now() }
        setItems(data as Bookmark[])
      }
      setLoading(false)
    }
    void load()
  }, [])

  // 本地搜索：名称 / 介绍 / 网址 / 分类 全匹配，输完即时过滤
  const filtered = useMemo(() => {
    const kw = keyword.trim().toLowerCase()
    if (!kw) return items
    return items.filter((b) =>
      [b.name, b.description, b.url, b.category].join(' ').toLowerCase().includes(kw),
    )
  }, [items, keyword])

  // 按分类分组：保持接口返回的创建时间倒序，组内顺序即新旧顺序
  const groups = useMemo(() => {
    const map = new Map<string, Bookmark[]>()
    for (const b of filtered) {
      const arr = map.get(b.category) ?? []
      arr.push(b)
      map.set(b.category, arr)
    }
    return [...map.entries()]
  }, [filtered])

  return (
    <div className="tools-page">
      <Helmet>
        <title>书签 · 沃哥博客</title>
      </Helmet>

      <h1 className="tools-title">书签</h1>
      <p className="tools-sub">个人常用网站快速入口，后台可随时增删改</p>

      {items.length > 0 && (
        <div className="bm-search">
          <input
            type="search"
            placeholder="搜索书签：名称 / 介绍 / 网址 / 分类"
            value={keyword}
            onChange={(e) => setKeyword(e.target.value)}
            aria-label="搜索书签"
          />
        </div>
      )}

      {loading ? (
        <p className="muted">加载中…</p>
      ) : items.length === 0 ? (
        <p className="muted">还没有书签，去后台添加几个吧。</p>
      ) : groups.length === 0 ? (
        <p className="muted">没有匹配「{keyword.trim()}」的书签。</p>
      ) : (
        groups.map(([cat, list], ci) => {
          const color = PALETTE[ci % PALETTE.length]
          return (
            <section key={cat} className="tools-cat">
              <h2 className="tools-cat-title">
                <i className="tools-cat-dot" style={{ background: color }} />
                {cat}
                <span className="bm-count">{list.length}</span>
              </h2>
              <div className="tools-grid">
                {list.map((b) => (
                  <a
                    key={b.id}
                    className="tools-card"
                    href={b.url}
                    target="_blank"
                    rel="noreferrer"
                  >
                    <span className="tools-mono" style={{ background: color }}>
                      {b.name.slice(0, 1)}
                    </span>
                    <span className="tools-info">
                      <span className="tools-name">{b.name}</span>
                      {b.description && <span className="tools-desc">{b.description}</span>}
                      <span className="bm-host">{hostOf(b.url)}</span>
                    </span>
                  </a>
                ))}
              </div>
            </section>
          )
        })
      )}
    </div>
  )
}
