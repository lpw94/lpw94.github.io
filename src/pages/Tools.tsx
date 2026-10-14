import { useEffect, useMemo, useState } from 'react'
import { Helmet } from 'react-helmet-async'
import { supabase } from '../lib/supabase'
import { SITE_NAV } from '../sites'
import type { Bookmark } from '../types'

// 每个分类一个主题色（循环取用），用于分类标记和卡片首字母图标
const PALETTE = ['#3b82f6', '#8b5cf6', '#06b6d4', '#f59e0b', '#ef4444', '#10b981']

// —— 模块级缓存：与 Home 文章列表同款思路 ——
// /tools 与文章详情等路由互切时会卸载重挂，没有缓存就会重复请求 Supabase。
// 带 60s TTL：命中新鲜缓存直接渲染、不发请求；过期则后台静默刷新。
// 静态工具（src/sites.ts）本身就在内存里，永远秒显，缓存只服务 DB 书签。
type ToolsCache = { data: Bookmark[]; ts: number }
let toolsCache: ToolsCache | null = null
const TOOLS_CACHE_TTL = 60 * 1000

/** 后台增删改书签后调用，让前台下次进入立即重拉 */
export function invalidateToolsCache() {
  toolsCache = null
}

/** 统一条目模型：静态工具和 DB 书签都归一化成这个形状，走完全相同的渲染 */
type NavItem = {
  name: string
  url: string
  desc: string
  host: string
}

/** 从网址提取域名，卡片上显示（去掉 www. 前缀） */
function hostOf(url: string) {
  try {
    return new URL(url).hostname.replace(/^www\./, '')
  } catch {
    return url
  }
}

/** 网址归一化：去协议 / www / 尾斜杠后比较，用于静态与 DB 两侧去重 */
function canonUrl(url: string) {
  try {
    const u = new URL(url)
    return (u.hostname.replace(/^www\./, '') + u.pathname).replace(/\/+$/, '').toLowerCase()
  } catch {
    return url.trim().toLowerCase()
  }
}

export default function Tools() {
  const [bookmarks, setBookmarks] = useState<Bookmark[]>(() => toolsCache?.data ?? [])

  useEffect(() => {
    const fresh = toolsCache && Date.now() - toolsCache.ts < TOOLS_CACHE_TTL
    if (fresh) return // 命中未过期缓存：不发请求
    const load = async () => {
      const { data } = await supabase
        .from('bookmarks')
        .select('*')
        .order('created_at', { ascending: false })
      if (data) {
        toolsCache = { data: data as Bookmark[], ts: Date.now() }
        setBookmarks(data as Bookmark[])
      }
    }
    void load()
  }, [])

  const [keyword, setKeyword] = useState('')

  // 合并两侧数据：静态工具打底（分类顺序固定），DB 书签覆盖同网址条目（原位替换），
  // 新网址追加进对应分类，全新分类追加在末尾 —— 访客看到的是同一个列表、同一套功能
  const groups = useMemo(() => {
    const map = new Map<string, NavItem[]>()
    const at = new Map<string, { cat: string; i: number }>()

    for (const cat of SITE_NAV) {
      for (const s of cat.sites) {
        const key = canonUrl(s.url)
        if (at.has(key)) continue
        const arr = map.get(cat.title) ?? []
        at.set(key, { cat: cat.title, i: arr.length })
        arr.push({ name: s.name, url: s.url, desc: s.desc ?? '', host: hostOf(s.url) })
        map.set(cat.title, arr)
      }
    }

    for (const b of bookmarks) {
      const key = canonUrl(b.url)
      const item: NavItem = {
        name: b.name,
        url: b.url,
        desc: b.description,
        host: hostOf(b.url),
      }
      const pos = at.get(key)
      if (pos) {
        // 后台加过/改过这个网址：用 DB 版本原位替换静态条目（位置不动，避免布局跳动）
        map.get(pos.cat)![pos.i] = item
        continue
      }
      const cat = b.category || '其他'
      const arr = map.get(cat) ?? []
      at.set(key, { cat, i: arr.length })
      arr.push(item)
      map.set(cat, arr)
    }

    return [...map.entries()]
  }, [bookmarks])

  // 本地搜索：名称 / 简介 / 网址 / 分类 全匹配，输完即时过滤
  const filtered = useMemo(() => {
    const kw = keyword.trim().toLowerCase()
    if (!kw) return groups
    return groups
      .map(([cat, list]) => [
        cat,
        list.filter((i) =>
          [i.name, i.desc, i.url, i.host, cat].join(' ').toLowerCase().includes(kw),
        ),
      ] as [string, NavItem[]])
      .filter(([, list]) => list.length > 0)
  }, [groups, keyword])

  return (
    <div className="tools-page">
      <Helmet>
        <title>常用导航 · 沃哥博客</title>
      </Helmet>

      <h1 className="tools-title">常用导航</h1>
      <p className="tools-sub">常用网站与个人书签快速入口：书签后台可随时增删改，静态工具改 src/sites.ts</p>

      <div className="bm-search">
        <input
          type="search"
          placeholder="搜索导航：名称 / 简介 / 网址 / 分类"
          value={keyword}
          onChange={(e) => setKeyword(e.target.value)}
          aria-label="搜索导航"
        />
      </div>

      {filtered.length === 0 ? (
        <p className="muted">没有匹配「{keyword.trim()}」的网站或书签。</p>
      ) : (
        filtered.map(([cat, list], ci) => {
          const color = PALETTE[ci % PALETTE.length]
          return (
            <section key={cat} className="tools-cat">
              <h2 className="tools-cat-title">
                <i className="tools-cat-dot" style={{ background: color }} />
                {cat}
                <span className="bm-count">{list.length}</span>
              </h2>
              <div className="tools-grid">
                {list.map((i) => (
                  <a
                    key={i.url}
                    className="tools-card"
                    href={i.url}
                    target="_blank"
                    rel="noreferrer"
                  >
                    <span className="tools-mono" style={{ background: color }}>
                      {i.name.slice(0, 1)}
                    </span>
                    <span className="tools-info">
                      <span className="tools-name">{i.name}</span>
                      {i.desc && <span className="tools-desc">{i.desc}</span>}
                      <span className="bm-host">{i.host}</span>
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
