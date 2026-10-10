import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { toPlainText } from '../lib/content'
import { CATEGORY_LABEL, type Category } from '../types'

type Indexed = { slug: string; title: string; category: Category; text: string }
type Hit = { slug: string; title: string; category: Category; excerpt: string; score: number }

/**
 * 站内全文搜索：头部的一个输入框。
 * - 首次展开时懒加载全部已发布文章（标题 + 正文纯文本）建索引，缓存后用 includes 匹配，
 *   不引第三方依赖；标题命中权重高于正文。
 * - 下拉结果点击跳转到对应文章；按 `/` 快速聚焦（输入框/文本域聚焦时不抢键）。
 * - Supabase 未配置或查询失败时静默降级：搜索框照常显示，只是没有结果。
 */
export default function SearchBox() {
  const [q, setQ] = useState('')
  const [open, setOpen] = useState(false)
  const [indexed, setIndexed] = useState<Indexed[]>([])
  const [hits, setHits] = useState<Hit[]>([])
  const boxRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const navigate = useNavigate()

  // 首次展开时拉一次文章建索引（个人博客量小，全量缓存即可）
  useEffect(() => {
    if (indexed.length > 0) return
    let cancelled = false
    supabase
      .from('posts')
      .select('slug, title, category, content, published_at')
      .eq('status', 'published')
      .order('published_at', { ascending: false })
      .then(({ data, error }) => {
        if (cancelled || error) return
        setIndexed(
          (data || []).map((p: any) => ({
            slug: p.slug,
            title: p.title,
            category: p.category,
            text: toPlainText(p.content || '').toLowerCase(),
          }))
        )
      })
    return () => {
      cancelled = true
    }
  }, [open, indexed.length])

  // 关键词过滤 + 打分排序（标题命中优先）
  useEffect(() => {
    const term = q.trim().toLowerCase()
    if (!term) {
      setHits([])
      return
    }
    const scored: Hit[] = []
    for (const h of indexed) {
      const titleI = h.title.toLowerCase().indexOf(term)
      const bodyI = h.text.indexOf(term)
      if (titleI < 0 && bodyI < 0) continue
      const excerpt = bodyI >= 0 ? h.text.slice(Math.max(0, bodyI - 18), bodyI + 54) : ''
      scored.push({
        slug: h.slug,
        title: h.title,
        category: h.category,
        excerpt,
        score: (titleI >= 0 ? 1000 : 0) - titleI - (bodyI >= 0 ? bodyI * 0.05 : 0),
      })
    }
    scored.sort((a, b) => b.score - a.score)
    setHits(scored.slice(0, 8))
  }, [q, indexed])

  // 点击外部收起
  useEffect(() => {
    if (!open) return
    const onDoc = (e: MouseEvent) => {
      if (!boxRef.current?.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [open])

  // `/` 快捷键聚焦（不抢输入框内的按键）
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== '/') return
      const el = document.activeElement
      if (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement) return
      e.preventDefault()
      inputRef.current?.focus()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  const go = (slug: string) => {
    setOpen(false)
    setQ('')
    navigate(`/post/${slug}`)
  }

  return (
    <div className="search-box" ref={boxRef}>
      <input
        ref={inputRef}
        className="search-input"
        type="search"
        placeholder="搜索文章…"
        value={q}
        onFocus={() => setOpen(true)}
        onChange={(e) => {
          setQ(e.target.value)
          setOpen(true)
        }}
        aria-label="搜索文章"
      />
      {open && q.trim() && (
        <div className="search-results" role="listbox">
          {hits.length === 0 ? (
            <div className="search-empty">没有匹配的文章</div>
          ) : (
            hits.map((h) => (
              <button key={h.slug} className="search-hit" onClick={() => go(h.slug)}>
                <span className="search-hit-head">
                  <span className="search-hit-title">{h.title}</span>
                  <span className={`post-category cat-${h.category}`}>
                    {CATEGORY_LABEL[h.category] ?? '—'}
                  </span>
                </span>
                {h.excerpt && <span className="search-hit-excerpt">{h.excerpt}…</span>}
              </button>
            ))
          )}
        </div>
      )}
    </div>
  )
}
