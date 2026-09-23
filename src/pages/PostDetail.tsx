import { useEffect, useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { Helmet } from 'react-helmet-async'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import type { User } from '@supabase/supabase-js'
import { supabase } from '../lib/supabase'
import { looksLikeHtml, toPlainText } from '../lib/content'
import { formatDate } from '../lib/date'
import { CATEGORY_LABEL, type Post, type Comment } from '../types'

const SITE_URL = import.meta.env.VITE_SITE_URL || 'https://your-domain.com'

/** 上一篇 / 下一篇 / 推荐只需要列表字段，不必把正文一起取回来 */
type PostRef = Pick<
  Post,
  'id' | 'slug' | 'title' | 'cover_url' | 'category' | 'published_at' | 'created_at'
>

/** 排序键：优先发布时间，草稿或缺失时退回创建时间 */
const sortKey = (p: PostRef) => new Date(p.published_at ?? p.created_at).getTime()

/** 推荐文章条数 */
const RELATED_LIMIT = 4

export default function PostDetail() {
  const { slug } = useParams<{ slug: string }>()
  const [post, setPost] = useState<Post | null>(null)
  const [loading, setLoading] = useState(true)
  const [comments, setComments] = useState<Comment[]>([])
  const [user, setUser] = useState<User | null>(null)
  const [author, setAuthor] = useState('')
  const [content, setContent] = useState('')
  const [submitting, setSubmitting] = useState(false)
  /** 全站已发布文章（按时间倒序），用于上下篇与推荐 */
  const [allPosts, setAllPosts] = useState<PostRef[]>([])

  useEffect(() => {
    const load = async () => {
      const { data, error } = await supabase
        .from('posts')
        .select('*')
        .eq('slug', slug)
        .eq('status', 'published')
        .maybeSingle()
      if (!error) setPost(data as Post | null)
      setLoading(false)
    }
    load()
  }, [slug])

  useEffect(() => {
    if (!post) return
    const loadComments = async () => {
      const { data } = await supabase
        .from('comments')
        .select('*')
        .eq('post_id', post.id)
        .order('created_at', { ascending: true })
      if (data) setComments(data as Comment[])
    }
    loadComments()
  }, [post])

  // 取已发布文章列表，用于底部「上一篇 / 下一篇」和「相关文章」
  useEffect(() => {
    if (!post) return
    const loadNeighbors = async () => {
      const { data } = await supabase
        .from('posts')
        .select('id, slug, title, cover_url, category, published_at, created_at')
        .eq('status', 'published')
        // 少数文章可能只有 created_at（例如发布态被直接改出来），倒序时让它们排在最后
        .order('published_at', { ascending: false, nullsFirst: false })
      if (data) setAllPosts(data as PostRef[])
    }
    loadNeighbors()
  }, [post])

  // 订阅登录状态：登录后评论昵称默认填邮箱
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setUser(data.session?.user ?? null))
    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null)
    })
    return () => sub.subscription.unsubscribe()
  }, [])

  // 用邮箱预填昵称，但不覆盖用户已手动输入的内容（prev || email）
  useEffect(() => {
    if (user?.email) setAuthor((prev) => prev || user.email!)
  }, [user])

  const submitComment = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!post || !author.trim() || !content.trim()) return
    setSubmitting(true)
    const { error } = await supabase.from('comments').insert({
      post_id: post.id,
      author_name: author.trim(),
      content: content.trim(),
    })
    setSubmitting(false)
    if (error) {
      alert(error.message)
      return
    }
    // 提交后清空正文；昵称若为登录用户则回填邮箱
    setAuthor(user?.email ?? '')
    setContent('')
    const { data } = await supabase
      .from('comments')
      .select('*')
      .eq('post_id', post.id)
      .order('created_at', { ascending: true })
    if (data) setComments(data as Comment[])
  }

  // 上下篇按发布时间倒序：上一篇是更新的一篇，下一篇是更早的一篇。
  // 推荐优先同分类，不足时用其他分类的最新文章补齐，并排除已在上下篇出现过的文章。
  const { prevPost, nextPost, related } = useMemo(() => {
    if (!post) return { prevPost: null, nextPost: null, related: [] as PostRef[] }

    const ordered = [...allPosts].sort((a, b) => sortKey(b) - sortKey(a))
    const index = ordered.findIndex((p) => p.id === post.id)

    const prev = index > 0 ? ordered[index - 1] : null
    const next = index >= 0 && index < ordered.length - 1 ? ordered[index + 1] : null

    const excluded = new Set([post.id, prev?.id, next?.id])
    const candidates = ordered.filter((p) => !excluded.has(p.id))
    const sameCategory = candidates.filter((p) => p.category === post.category)
    const others = candidates.filter((p) => p.category !== post.category)

    return {
      prevPost: prev,
      nextPost: next,
      related: [...sameCategory, ...others].slice(0, RELATED_LIMIT),
    }
  }, [post, allPosts])

  if (loading) return <p className="muted">加载中…</p>
  if (!post) return <p className="muted">文章不存在。</p>

  // 富文本文章存的是 HTML，先剥掉标签再截取，避免把标签写进 meta 描述
  const description = toPlainText(post.content)
    .replace(/[#>*`_~\-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 120)

  return (
    <article className="post-detail">
      <Helmet>
        <title>{post.title} · 博客</title>
        <meta name="description" content={description} />
        <meta property="og:type" content="article" />
        <meta property="og:title" content={post.title} />
        <meta property="og:description" content={description} />
        <meta property="og:url" content={`${SITE_URL}/post/${post.slug}`} />
        <meta property="article:published_time" content={post.published_at || ''} />
        <link rel="canonical" href={`${SITE_URL}/post/${post.slug}`} />
      </Helmet>

      <h1>{post.title}</h1>
      <div className="post-meta">
        {post.category && (
          <span className={`post-category cat-${post.category}`}>
            {CATEGORY_LABEL[post.category] ?? post.category}
          </span>
        )}
        <time className="muted">{formatDate(post.published_at)}</time>
      </div>

      {post.cover_url && (
        <img className="cover" src={post.cover_url} alt={post.title} />
      )}

      {/* 富文本文章存 HTML，Markdown 文章存纯文本，按内容自动选择渲染方式。
          两种情况都套 rich-content，让两条渲染路径共用同一套正文排版
          （标题 / 段落 / 列表 / 引用 / 代码 / 表格），否则 Markdown 表格和
          代码块会完全没有样式，看起来像「没有格式」。 */}
      <div className="content rich-content">
        {looksLikeHtml(post.content) ? (
          <div dangerouslySetInnerHTML={{ __html: post.content }} />
        ) : (
          <ReactMarkdown remarkPlugins={[remarkGfm]}>{post.content}</ReactMarkdown>
        )}
      </div>

      {/* 上一篇 / 下一篇：按发布时间倒序，上一篇是更新的，下一篇是更早的 */}
      <nav className="post-nav">
        {prevPost ? (
          <Link to={`/post/${prevPost.slug}`} className="post-nav-item">
            <span className="post-nav-label">← 上一篇</span>
            <span className="post-nav-title">{prevPost.title}</span>
            <time className="muted">{formatDate(prevPost.published_at)}</time>
          </Link>
        ) : (
          <span className="post-nav-item is-empty">
            <span className="post-nav-label">← 上一篇</span>
            <span className="muted">已经是最新一篇</span>
          </span>
        )}

        {nextPost ? (
          <Link to={`/post/${nextPost.slug}`} className="post-nav-item align-right">
            <span className="post-nav-label">下一篇 →</span>
            <span className="post-nav-title">{nextPost.title}</span>
            <time className="muted">{formatDate(nextPost.published_at)}</time>
          </Link>
        ) : (
          <span className="post-nav-item align-right is-empty">
            <span className="post-nav-label">下一篇 →</span>
            <span className="muted">没有更早的文章了</span>
          </span>
        )}
      </nav>

      {related.length > 0 && (
        <section className="related">
          <h2>相关文章</h2>
          <ul className="related-list">
            {related.map((p) => (
              <li key={p.id}>
                <Link to={`/post/${p.slug}`} className="related-card">
                  {p.cover_url ? (
                    <img src={p.cover_url} alt={p.title} />
                  ) : (
                    <span className="related-thumb" aria-hidden="true">
                      {p.title.slice(0, 1)}
                    </span>
                  )}
                  <span className="related-body">
                    <span className="related-title">{p.title}</span>
                    <span className="related-meta">
                      <span className={`post-category cat-${p.category}`}>
                        {CATEGORY_LABEL[p.category] ?? '—'}
                      </span>
                      <time className="muted">{formatDate(p.published_at)}</time>
                    </span>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="comments">
        <h2>评论 ({comments.length})</h2>
        <ul>
          {comments.map((c) => (
            <li key={c.id}>
              <strong>{c.author_name}</strong>
              <span className="muted"> · {formatDate(c.created_at)}</span>
              <p>{c.content}</p>
            </li>
          ))}
        </ul>

        <form onSubmit={submitComment} className="comment-form">
          <input
            placeholder="昵称"
            value={author}
            onChange={(e) => setAuthor(e.target.value)}
            required
          />
          <textarea
            placeholder="写下评论…"
            rows={3}
            value={content}
            onChange={(e) => setContent(e.target.value)}
            required
          />
          <button type="submit" disabled={submitting}>
            {submitting ? '提交中…' : '发表评论'}
          </button>
        </form>
      </section>
    </article>
  )
}
