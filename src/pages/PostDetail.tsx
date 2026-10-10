import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useLocation, useParams } from 'react-router-dom'
import { Helmet } from 'react-helmet-async'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import rehypeHighlight from 'rehype-highlight'
import hljs from '../lib/highlight'
import type { User } from '@supabase/supabase-js'
import { supabase } from '../lib/supabase'
import { looksLikeHtml, toPlainText, readingTime } from '../lib/content'
import { formatDate } from '../lib/date'
import { CATEGORY_LABEL, type Post, type Comment } from '../types'
import { profile } from '../profile'
import GiscusComments from '../components/GiscusComments'

const SITE_URL = import.meta.env.VITE_SITE_URL || 'https://lpw94.github.io'
const SITE_NAME = '沃哥博客'
// 发布者的 X / Twitter 账号（用于 twitter:site）；没有或想改就改这里
const TWITTER_SITE = '@lpw94'

/** 上一篇 / 下一篇 / 推荐只需要列表字段，不必把正文一起取回来 */
type PostRef = Pick<
  Post,
  'id' | 'slug' | 'title' | 'cover_url' | 'category' | 'published_at' | 'created_at'
>

/** 排序键：优先发布时间，草稿或缺失时退回创建时间 */
const sortKey = (p: PostRef) => new Date(p.published_at ?? p.created_at).getTime()

/** 推荐文章条数 */
const RELATED_LIMIT = 4

/** 把标题转成锚点 id（保留中文） */
function slugify(s: string): string {
  return (
    s
      .trim()
      .toLowerCase()
      .replace(/\s+/g, '-')
      .replace(/[^\w一-龥-]/g, '')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '') || 'section'
  )
}

/**
 * Markdown 代码块：用 div 包一层，右上角放「复制」按钮。
 * 富文本(HTML)路径不走 react-markdown，复制按钮在下方 effect 里单独注入。
 */
function CodePre({ children }: { children?: React.ReactNode }) {
  const ref = useRef<HTMLPreElement>(null)
  const [copied, setCopied] = useState(false)
  const copy = () => {
    const text = ref.current?.textContent || ''
    navigator.clipboard
      ?.writeText(text)
      .then(() => {
        setCopied(true)
        setTimeout(() => setCopied(false), 1500)
      })
      .catch(() => {})
  }
  return (
    <div className="code-block">
      <button type="button" className="code-copy" onClick={copy} aria-label="复制代码">
        {copied ? '已复制' : '复制'}
      </button>
      <pre ref={ref}>{children}</pre>
    </div>
  )
}

export default function PostDetail() {
  const { slug } = useParams<{ slug: string }>()
  const location = useLocation()
  /**
   * 从首页文章卡片点进来时，列表里已经带了全文（Home 是 select('*')），
   * 这里直接把这份数据当初始值，正文立刻渲染，不再白等一次网络请求。
   * 仍会照常发请求刷新，保证浏览数、内容与数据库一致。
   * 仅当带过来的数据确实含正文时才采用（相关文章等只带列表字段，不能当正文用）。
   */
  const seeded = (location.state as { post?: Post } | null)?.post
  const seededPost = seeded && typeof seeded.content === 'string' ? seeded : null
  const [post, setPost] = useState<Post | null>(seededPost)
  const [loading, setLoading] = useState(!seededPost)
  /** 正文容器 ref：富文本（HTML）路径不走 react-markdown，需手动跑 hljs 高亮 */
  const contentRef = useRef<HTMLDivElement>(null)
  /** 文章容器 ref：阅读进度条按它的滚动比例计算 */
  const articleRef = useRef<HTMLElement>(null)
  /** 自建评论（Supabase）相关 state */
  const [comments, setComments] = useState<Comment[]>([])
  const [user, setUser] = useState<User | null>(null)
  const [author, setAuthor] = useState('')
  const [content, setContent] = useState('')
  const [submitting, setSubmitting] = useState(false)
  /** 全站已发布文章（按时间倒序），用于上下篇与推荐 */
  const [allPosts, setAllPosts] = useState<PostRef[]>([])
  /** 已计数的文章 id：防止同一挂载内（如 React StrictMode 双调用）重复 +1 */
  const countedRef = useRef<string | null>(null)
  /** 目录（h2/h3 锚点）与当前高亮节 */
  const [toc, setToc] = useState<{ id: string; text: string; level: number }[]>([])
  const [activeId, setActiveId] = useState('')
  /** 阅读进度（0~1） */
  const [progress, setProgress] = useState(0)
  /** 点赞：计数 / 是否已点 / 请求中 / 功能是否可用 */
  const [likes, setLikes] = useState(0)
  const [liked, setLiked] = useState(false)
  const [likeBusy, setLikeBusy] = useState(false)
  const [likeError, setLikeError] = useState(false)

  useEffect(() => {
    // 切换文章时 React Router 不会重挂载同一路由的组件，这里先把状态对齐到当前 slug：
    // 若这次跳转带上了全文（从首页卡片进入）就直接用，否则回到骨架屏，
    // 避免在新文章到达前短暂显示上一篇的内容。
    const seededForSlug = seededPost && seededPost.slug === slug ? seededPost : null
    setPost(seededForSlug)
    setLoading(!seededForSlug)
    // 切换文章时把目录/进度/点赞等派生状态清空，避免串到新文章
    setToc([])
    setActiveId('')
    setProgress(0)
    setLiked(false)
    setLikeError(false)

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

  // 每次打开文章详情（slug 变化）就调一次接口请求，浏览次数 +1。
  // 用 ref 去重：同一篇在同一挂载内只计一次，避免开发环境 StrictMode 双调用造成多计；
  // 切换文章（新 id）会重新计数，符合「每次打开页面就算一次」。
  useEffect(() => {
    if (!post) return
    if (countedRef.current === post.id) return
    countedRef.current = post.id
    supabase
      .rpc('bump_post_views', { p_post_id: post.id })
      .then(({ data, error }) => {
        if (error) {
          console.warn('浏览计数（Supabase）不可用：', error.message)
          return
        }
        const n = Number(data)
        if (Number.isFinite(n)) {
          setPost((p) => (p ? { ...p, views: n } : p))
        }
      })
  }, [post?.id])

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
    // 依赖用 id 而非整个对象：避免拿到刷新后的新对象导致重复请求
  }, [post?.id])

  // 加载本篇文章的自建评论（Supabase）
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
  }, [post?.id])

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

  // 富文本（HTML）路径不经过 react-markdown 的 rehype-highlight，
  // 这里手动给正文里的代码块跑语法高亮；并给富文本代码块注入「复制」按钮
  // （Markdown 路径由 CodePre 组件负责）。代码块可能是 <pre><code>（Markdown 路径已带 hljs 类，
  // 跳过）或 <pre> 裸文本（后台富文本存出的结构），两种情况都要覆盖。
  useEffect(() => {
    const root = contentRef.current
    if (!root) return
    const isHtml = looksLikeHtml(post?.content || '')
    root.querySelectorAll<HTMLElement>('pre').forEach((pre) => {
      const target = pre.querySelector('code') ?? pre
      if (!target.classList.contains('hljs')) hljs.highlightElement(target)
      // 仅富文本路径在此注入复制按钮，避免改动 react-markdown 管理的 DOM
      if (isHtml && !pre.querySelector('.code-copy')) {
        const btn = document.createElement('button')
        btn.type = 'button'
        btn.className = 'code-copy'
        btn.textContent = '复制'
        btn.addEventListener('click', () => {
          navigator.clipboard
            ?.writeText(pre.textContent || '')
            .then(() => {
              btn.textContent = '已复制'
              setTimeout(() => (btn.textContent = '复制'), 1500)
            })
            .catch(() => {})
        })
        pre.appendChild(btn)
      }
    })
  }, [post?.content])

  // 解析正文标题生成目录锚点，并用 IntersectionObserver 高亮当前节
  useEffect(() => {
    const root = contentRef.current
    if (!root) return
    const heads = Array.from(root.querySelectorAll<HTMLElement>('h2, h3'))
    const items = heads.map((h) => {
      if (!h.id) h.id = slugify(h.textContent || `h${Math.random().toString(36).slice(2)}`)
      return { id: h.id, text: (h.textContent || '').trim(), level: h.tagName === 'H2' ? 2 : 3 }
    })
    setToc(items)
    const obs = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          if (e.isIntersecting) setActiveId((e.target as HTMLElement).id)
        })
      },
      // 顶部留白避开吸顶头部，判定线压到接近视口顶部，让"当前节"更贴近阅读位置
      { rootMargin: '-80px 0px -70% 0px', threshold: 0 }
    )
    heads.forEach((h) => obs.observe(h))
    return () => obs.disconnect()
  }, [post?.content])

  // 阅读进度条：按文章相对视口的滚动比例计算
  useEffect(() => {
    const onScroll = () => {
      const el = articleRef.current
      if (!el) return
      const top = el.getBoundingClientRect().top + window.scrollY
      const total = el.offsetHeight - window.innerHeight
      const scrolled = window.scrollY - top
      const p = total > 0 ? Math.min(1, Math.max(0, scrolled / total)) : 0
      setProgress(p)
    }
    window.addEventListener('scroll', onScroll, { passive: true })
    window.addEventListener('resize', onScroll)
    onScroll()
    return () => {
      window.removeEventListener('scroll', onScroll)
      window.removeEventListener('resize', onScroll)
    }
  }, [post?.id])

  // 点赞计数：从 post_likes 取该文当前赞数；功能不可用（表未建/rpc 缺失）时静默降级隐藏
  useEffect(() => {
    if (!post) return
    let cancelled = false
    supabase
      .from('post_likes')
      .select('count')
      .eq('post_id', post.id)
      .maybeSingle()
      .then(({ data, error }) => {
        if (cancelled) return
        if (error) {
          setLikeError(true)
          return
        }
        setLikes((data as { count: number } | null)?.count ?? 0)
        setLiked(localStorage.getItem(`liked:${post.id}`) === '1')
      })
    return () => {
      cancelled = true
    }
  }, [post?.id])

  const like = async () => {
    if (!post || liked || likeBusy) return
    setLikeBusy(true)
    const { data, error } = await supabase.rpc('bump_post_likes', { p_post_id: post.id })
    setLikeBusy(false)
    if (error) {
      console.warn('点赞失败（可能未建 post_likes 表）：', error.message)
      return
    }
    const n = Number(data)
    if (Number.isFinite(n)) setLikes(n)
    setLiked(true)
    localStorage.setItem(`liked:${post.id}`, '1')
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

  if (loading)
    return (
      <div className="post-skeleton" aria-busy="true" aria-label="文章加载中">
        <div className="sk-line sk-title" />
        <div className="sk-line sk-meta" />
        <div className="sk-line" />
        <div className="sk-line" />
        <div className="sk-line sk-short" />
        <div className="sk-line" />
        <div className="sk-line sk-short" />
      </div>
    )
  if (!post) return <p className="muted">文章不存在。</p>

  // 富文本文章存的是 HTML，先剥掉标签再截取，避免把标签写进 meta 描述
  const description = toPlainText(post.content)
    .replace(/[#>*`_~\-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 120)

  // 阅读时长：纯文本按中英文混合估算
  const readingMins = readingTime(post.content)

  // 社交分享图：优先文章封面，缺省时回退到站点头像，保证 OG / Twitter 图片始终有值
  const ogImage = post.cover_url || `${SITE_URL}/avatar.png`
  const canonicalUrl = `${SITE_URL}/post/${post.slug}`

  // 结构化数据（schema.org / JSON-LD），帮助搜索引擎理解文章并出富媒体结果
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'BlogPosting',
    headline: post.title,
    description,
    image: ogImage,
    datePublished: post.published_at || post.created_at,
    dateModified: post.published_at || post.created_at,
    author: { '@type': 'Person', name: profile.name },
    publisher: {
      '@type': 'Organization',
      name: SITE_NAME,
      logo: { '@type': 'ImageObject', url: `${SITE_URL}/favicon-32.png` },
    },
    mainEntityOfPage: { '@type': 'WebPage', '@id': canonicalUrl },
  }

  const onTocClick = (e: React.MouseEvent, id: string) => {
    e.preventDefault()
    const el = document.getElementById(id)
    if (!el) return
    const y = el.getBoundingClientRect().top + window.scrollY - 80
    window.scrollTo({ top: y, behavior: 'smooth' })
  }

  return (
    <>
      <div
        className="reading-progress"
        style={{ transform: `scaleX(${progress})` }}
        aria-hidden="true"
      />
      <div className="post-layout">
        <article className="post-detail" ref={articleRef}>
          <Helmet>
            <title>{post.title} · {SITE_NAME}</title>
            <meta name="description" content={description} />
            <link rel="canonical" href={canonicalUrl} />

            {/* Open Graph */}
            <meta property="og:type" content="article" />
            <meta property="og:site_name" content={SITE_NAME} />
            <meta property="og:locale" content="zh_CN" />
            <meta property="og:title" content={post.title} />
            <meta property="og:description" content={description} />
            <meta property="og:url" content={canonicalUrl} />
            <meta property="og:image" content={ogImage} />
            <meta property="og:image:alt" content={post.title} />
            <meta property="article:published_time" content={post.published_at || ''} />
            <meta
              property="article:modified_time"
              content={post.published_at || post.created_at || ''}
            />
            <meta
              property="article:section"
              content={CATEGORY_LABEL[post.category] ?? post.category}
            />

            {/* Twitter Card */}
            <meta name="twitter:card" content="summary_large_image" />
            <meta name="twitter:site" content={TWITTER_SITE} />
            <meta name="twitter:title" content={post.title} />
            <meta name="twitter:description" content={description} />
            <meta name="twitter:image" content={ogImage} />

            {/* 结构化数据 */}
            <script type="application/ld+json">{JSON.stringify(jsonLd)}</script>
          </Helmet>

          <h1>{post.title}</h1>
          <div className="post-meta">
            {post.category && (
              <span className={`post-category cat-${post.category}`}>
                {CATEGORY_LABEL[post.category] ?? post.category}
              </span>
            )}
            <time className="muted">{formatDate(post.published_at)}</time>
            <span className="post-views muted" title="浏览次数">
              👁 {(post.views ?? 0).toLocaleString('zh-CN')} 次浏览
            </span>
            <span className="post-views muted" title="预计阅读时长">
              ⏱ {readingMins} 分钟
            </span>
            {!likeError && (
              <button
                type="button"
                className={`post-like${liked ? ' liked' : ''}`}
                onClick={like}
                disabled={liked || likeBusy}
                title={liked ? '已点赞' : '点赞'}
              >
                {liked ? '❤️' : '🤍'} {likes}
              </button>
            )}
          </div>

          {post.cover_url && (
            <img className="cover" src={post.cover_url} alt={post.title} />
          )}

          {/* 富文本文章存 HTML，Markdown 文章存纯文本，按内容自动选择渲染方式。
              两种情况都套 rich-content，让两条渲染路径共用同一套正文排版
              （标题 / 段落 / 列表 / 引用 / 代码 / 表格），否则 Markdown 表格和
              代码块会完全没有样式，看起来像「没有格式」。 */}
          <div className="content rich-content" ref={contentRef}>
            {looksLikeHtml(post.content) ? (
              <div dangerouslySetInnerHTML={{ __html: post.content }} />
            ) : (
              <ReactMarkdown
                remarkPlugins={[remarkGfm]}
                rehypePlugins={[rehypeHighlight]}
                components={{ pre: CodePre }}
              >
                {post.content}
              </ReactMarkdown>
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

          {/* 自建评论（Supabase 后端，无需 GitHub 登录即可留言） */}
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

          {/* Giscus 评论（基于 GitHub Discussions，不便登录 GitHub 的访客可用上方自建评论） */}
          <GiscusComments />
        </article>

        {toc.length > 0 && (
          <aside className="post-toc" aria-label="文章目录">
            <div className="post-toc-title">目录</div>
            <ul>
              {toc.map((t) => (
                <li key={t.id} className={t.level === 3 ? 'sub' : ''}>
                  <a
                    href={`#${t.id}`}
                    className={activeId === t.id ? 'active' : ''}
                    onClick={(e) => onTocClick(e, t.id)}
                  >
                    {t.text}
                  </a>
                </li>
              ))}
            </ul>
          </aside>
        )}
      </div>
    </>
  )
}
