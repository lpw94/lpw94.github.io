import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { Helmet } from 'react-helmet-async'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import type { User } from '@supabase/supabase-js'
import { supabase } from '../lib/supabase'
import { looksLikeHtml, toPlainText } from '../lib/content'
import { formatDate } from '../lib/date'
import { CATEGORY_LABEL, type Post, type Comment } from '../types'

const SITE_URL = import.meta.env.VITE_SITE_URL || 'https://your-domain.com'

export default function PostDetail() {
  const { slug } = useParams<{ slug: string }>()
  const [post, setPost] = useState<Post | null>(null)
  const [loading, setLoading] = useState(true)
  const [comments, setComments] = useState<Comment[]>([])
  const [user, setUser] = useState<User | null>(null)
  const [author, setAuthor] = useState('')
  const [content, setContent] = useState('')
  const [submitting, setSubmitting] = useState(false)

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

      {/* 富文本文章存 HTML，Markdown 文章存纯文本，按内容自动选择渲染方式 */}
      <div className="content">
        {looksLikeHtml(post.content) ? (
          <div
            className="rich-content"
            dangerouslySetInnerHTML={{ __html: post.content }}
          />
        ) : (
          <ReactMarkdown remarkPlugins={[remarkGfm]}>{post.content}</ReactMarkdown>
        )}
      </div>

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
