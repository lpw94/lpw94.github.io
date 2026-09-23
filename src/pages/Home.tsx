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

  if (loading) return <p className="muted">加载中…</p>

  return (
    <>
      <nav className="category-filter">
        <button
          type="button"
          className={active === 'all' ? 'active' : ''}
          onClick={() => setParams({})}
        >
          全部<span className="count">{counts.all}</span>
        </button>
        {CATEGORIES.map((c) => (
          <button
            key={c.value}
            type="button"
            className={active === c.value ? 'active' : ''}
            onClick={() => setParams({ category: c.value })}
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
          {visible.map((p) => (
            <PostCard key={p.id} post={p} />
          ))}
        </div>
      )}
    </>
  )
}
