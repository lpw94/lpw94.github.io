import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import type { Post } from '../types'
import PostCard from '../components/PostCard'

export default function Home() {
  const [posts, setPosts] = useState<Post[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
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

  if (loading) return <p className="muted">加载中…</p>
  if (posts.length === 0) return <p className="muted">还没有发布文章。</p>

  return (
    <div className="post-list">
      {posts.map((p) => (
        <PostCard key={p.id} post={p} />
      ))}
    </div>
  )
}
