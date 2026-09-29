import { useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { CATEGORIES, type Category, type Post } from '../types'
import PostCard from '../components/PostCard'

type Filter = Category | 'all'

export default function Home() {
  const [posts, setPosts] = useState<Post[]>([])
  const [loading, setLoading] = useState(true)
  const [params, setParams] = useSearchParams()

  // 首页文章分页：分页大小可选（每页 5 / 10 / 20 条），切分类或改大小都回到第 1 页
  const PAGE_SIZES = [5, 10, 20]
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(5)

  // 分类状态放在 URL 上（?category=tech），刷新页面和分享链接都能保持
  const raw = params.get('category')
  const active: Filter = CATEGORIES.some((c) => c.value === raw)
    ? (raw as Category)
    : 'all'

  useEffect(() => {
    // 一次性取回全部已发布文章，分类切换在本地完成：
    // 个人博客文章量不大，这样切分类是瞬间的，也不必为每次点击都打一次网络请求
    const load = async () => {
      const { data, error } = await supabase
        .from('posts')
        .select('*')
        .eq('status', 'published')
        .order('published_at', { ascending: false })
      if (!error && data) setPosts(data as Post[])
      setLoading(false)
    }
    load()
  }, [])

  // 各分类的篇数，显示在过滤按钮上。按 CATEGORIES 动态初始化，
  // 以后增删分类只需要改 types.ts，这里不用动。
  const counts = useMemo(() => {
    const base: Record<string, number> = { all: posts.length }
    CATEGORIES.forEach((c) => {
      base[c.value] = 0
    })
    posts.forEach((p) => {
      if (p.category) base[p.category] = (base[p.category] ?? 0) + 1
    })
    return base
  }, [posts])

  const visible = active === 'all' ? posts : posts.filter((p) => p.category === active)

  // 分页：visible 已是分类过滤后的结果，再切片当前页
  const totalPages = Math.max(1, Math.ceil(visible.length / pageSize))
  const safePage = Math.min(page, totalPages)
  const pageStart = (safePage - 1) * pageSize
  const pagePosts = visible.slice(pageStart, pageStart + pageSize)

  // 切分类 / 改分页大小导致总页数变少时，把越界页码回退到最后一页
  useEffect(() => {
    if (page > totalPages) setPage(totalPages)
  }, [totalPages, page])

  if (loading) return <p className="muted">加载中…</p>

  return (
    <>
      <nav className="category-filter">
        <button
          type="button"
          className={active === 'all' ? 'active' : ''}
          onClick={() => {
            setParams({})
            setPage(1)
          }}
        >
          全部<span className="count">{counts.all}</span>
        </button>
        {CATEGORIES.map((c) => (
          <button
            key={c.value}
            type="button"
            className={active === c.value ? 'active' : ''}
            onClick={() => {
              setParams({ category: c.value })
              setPage(1)
            }}
          >
            {c.label}
            <span className="count">{counts[c.value]}</span>
          </button>
        ))}
      </nav>

      {visible.length === 0 ? (
        <p className="muted">
          {posts.length === 0 ? '还没有发布文章。' : '这个分类下还没有文章。'}
        </p>
      ) : (
        <div className="post-list">
          {pagePosts.map((p) => (
            <PostCard key={p.id} post={p} />
          ))}
        </div>
      )}

      {visible.length > 0 && (
        <nav className="home-pager" aria-label="文章分页">
          <div className="home-pager-left">
            <span className="home-pager-info">
              共 {visible.length} 篇 · 第 {safePage}/{totalPages} 页
            </span>
            <label className="page-size-select">
              每页
              <select
                value={pageSize}
                onChange={(e) => {
                  setPageSize(Number(e.target.value))
                  setPage(1)
                }}
              >
                {PAGE_SIZES.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
              条
            </label>
          </div>
          <div className="post-pager-btns">
            <button
              type="button"
              disabled={safePage <= 1}
              onClick={() => setPage(safePage - 1)}
            >
              上一页
            </button>
            {Array.from({ length: totalPages }, (_, i) => i + 1).map((n) => (
              <button
                type="button"
                key={n}
                className={n === safePage ? 'active' : ''}
                onClick={() => setPage(n)}
              >
                {n}
              </button>
            ))}
            <button
              type="button"
              disabled={safePage >= totalPages}
              onClick={() => setPage(safePage + 1)}
            >
              下一页
            </button>
          </div>
        </nav>
      )}
    </>
  )
}
