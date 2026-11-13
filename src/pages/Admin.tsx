import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { supabase } from '../lib/supabase'
import { uploadImage, uploadPdf, deleteFile } from '../lib/storage'
import { looksLikeHtml, toPlainText } from '../lib/content'
import RichTextEditor from '../components/RichTextEditor'
import LoginModal from '../components/LoginModal'
import { CATEGORIES, CATEGORY_LABEL, type Category, type Post } from '../types'
import { formatDateTime } from '../lib/date'
import { invalidateHomeCache } from '../pages/Home'
import BookmarkAdmin from '../components/BookmarkAdmin'
import { toast } from '../lib/toast'

type FormState = {
  /** 编辑中的文章 id；null 表示新建 */
  id: string | null
  title: string
  slug: string
  content: string
  cover_url: string | null
  /** PDF 附件：Storage 公开地址 + 原始文件名，二者同时有值或同时为 null */
  pdf_url: string | null
  pdf_name: string | null
  category: Category
  status: 'published' | 'draft'
}

// 默认 slug 规则：my-log + 当前时间（精确到秒）。
// 中文标题没法自动转成英文路径，所以用带时间戳的可读路径兜底；用户仍可手动改成更短的地址。
function makeDefaultSlug() {
  const d = new Date()
  const p = (n: number) => String(n).padStart(2, '0')
  return `my-log-${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}`
}

const emptyForm = (): FormState => ({
  id: null,
  title: '',
  slug: makeDefaultSlug(),
  content: '',
  cover_url: null,
  pdf_url: null,
  pdf_name: null,
  category: 'frontend',
  status: 'published',
})

// 文章列表每页条数（客户端切片分页；posts 仍保留全量，供图片清理逻辑计算 keep 集合）
const PAGE_SIZE = 10

// 列表里显示的时间：已发布用发布时间，草稿退回创建时间；统一转本地时区
function formatTime(post: Post) {
  return formatDateTime(post.published_at ?? post.created_at) || '—'
}

// 从 HTML 正文里提取全部 <img> 的 src（用于统计一篇文章引用了哪些图片）
function extractImageUrls(html: string): string[] {
  const urls: string[] = []
  const re = /<img[^>]+src=["']([^"']+)["']/gi
  let m: RegExpExecArray | null
  while ((m = re.exec(html))) urls.push(m[1])
  return urls
}

export default function Admin() {
  const [user, setUser] = useState<unknown>(null)
  const [posts, setPosts] = useState<Post[]>([])
  const [form, setForm] = useState<FormState>(emptyForm)
  /** 新建 / 编辑表单的弹窗开关 */
  const [open, setOpen] = useState(false)
  const [showLogin, setShowLogin] = useState(false)
  /** 正文编辑模式：true = 富文本（存 HTML），false = 纯文本 / Markdown */
  const [richMode, setRichMode] = useState(true)
  const [uploading, setUploading] = useState(false)
  /** PDF 附件上传中（与封面图分开，避免互相禁用） */
  const [uploadingPdf, setUploadingPdf] = useState(false)
  const [saving, setSaving] = useState(false)
  /** 文章列表当前页码（从 1 开始）；列表本身仍由 posts 全量驱动，仅显示切片 */
  const [page, setPage] = useState(1)
  /** 后台一级页签：文章管理 / 书签配置 */
  const [tab, setTab] = useState<'posts' | 'bookmarks'>('posts')

  /** 删除二次确认：用自定义模态替代原生 window.confirm，体验更友好 */
  const [confirmMsg, setConfirmMsg] = useState<string | null>(null)
  const confirmResolver = useRef<(ok: boolean) => void>(() => {})
  const askConfirm = (msg: string) =>
    new Promise<boolean>((resolve) => {
      confirmResolver.current = resolve
      setConfirmMsg(msg)
    })
  const closeConfirm = (ok: boolean) => {
    setConfirmMsg(null)
    const r = confirmResolver.current
    confirmResolver.current = () => {}
    r(ok)
  }

  /** 本次表单会话里新上传的资源公开地址（封面 + 正文图 + PDF）。
      上传即落盘，但只有保存成功后才真正被文章引用；
      被替换/被删掉/放弃编辑的，都要从 Storage 清掉，避免垃圾文件占额度。 */
  const sessionUploads = useRef<Set<string>>(new Set())
  /** 打开表单时文章的原始图片引用（原封面 + 原正文图）。
      编辑已有文章保存成功后，凡是"原来有、现在没了"的旧图都要删。 */
  const originalImages = useRef<{ coverUrl: string | null; images: string[] }>({
    coverUrl: null,
    images: [],
  })
  /** 打开表单时文章原有的 PDF 地址，用于换/删 PDF 后清理旧文件 */
  const originalPdfUrl = useRef<string | null>(null)

  useEffect(() => {
    // 先用本地已有会话恢复一次（普通刷新场景）
    supabase.auth.getSession().then(({ data }) => setUser(data.session?.user ?? null))

    // 魔法链接回调时，URL 中的 token 由 supabase-js 异步解析，
    // 只查一次会误判为未登录，必须靠事件通知补齐状态
    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null)
    })

    return () => sub.subscription.unsubscribe()
  }, [])

  // 未登录时自动弹出登录弹窗；一旦拿到会话立即收起
  useEffect(() => {
    setShowLogin(!user)
  }, [user])

  const load = async () => {
    const { data } = await supabase
      .from('posts')
      .select('*')
      .order('created_at', { ascending: false })
    if (data) setPosts(data as Post[])
  }

  useEffect(() => {
    if (user) load()
  }, [user])

  // 删除 / 新增 / 切换状态后 posts 数量变化，当前页可能越界，自动回退到最后一页
  useEffect(() => {
    const tp = Math.max(1, Math.ceil(posts.length / PAGE_SIZE))
    if (page > tp) setPage(tp)
  }, [posts, page])

  /** 删除不再被引用的资源（图片 + PDF 都走同一个桶）；
      失败只记日志（外链地址会被 deleteFile 自动跳过），
      不阻断保存/关闭流程 —— 清理是锦上添花，不能因为它把发文搞挂。 */
  const cleanupImages = async (urls: Iterable<string>, keep: Set<string>) => {
    for (const url of urls) {
      if (keep.has(url)) continue
      const ok = await deleteFile(url)
      if (!ok) console.warn('资源清理失败（可稍后在 Supabase Storage 手动删除）', url)
    }
  }

  const closeModal = () => {
    setOpen(false)
    setForm(emptyForm())
    // 直接关闭（未保存）：本次会话上传的图片尚未被任何已保存文章引用，全部清掉。
    // 保存成功路径会先清空 sessionUploads 再调 closeModal，所以不会误删已引用的图。
    void cleanupImages(sessionUploads.current, new Set())
    sessionUploads.current = new Set()
  }

  // 弹窗打开期间锁住背景滚动。
  // 只允许通过右上角 × 或底部「取消」按钮关闭：不响应 Esc、也不响应点击遮罩，避免误触丢失已填内容。
  useEffect(() => {
    if (!open) return
    const prevOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = prevOverflow
    }
  }, [open])

  const uploadCover = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setUploading(true)

    try {
      // 路径规范与「Invalid key」相关注意事项见 lib/storage.ts（超 1MB 自动压缩 webp）
      const { url, compressed } = await uploadImage(file, 'covers')
      if (compressed) {
        toast(`封面已自动压缩：${compressed.beforeKB}KB → ${compressed.afterKB}KB（webp）`, 'success')
      }
      sessionUploads.current.add(url)
      setForm((prev) => ({ ...prev, cover_url: url }))
    } catch (err) {
      console.error('封面图上传失败', err)
      toast(`上传失败：${(err as Error).message}`, 'error')
    } finally {
      setUploading(false)
      // 清空 value，否则再次选择同一个文件不会触发 change 事件
      e.target.value = ''
    }
  }

  /** 正文内嵌图片：放在 content/ 子目录，与封面区分开 */
  const uploadContentImage = async (file: File) => {
    const { url, compressed } = await uploadImage(file, 'content')
    if (compressed) {
      toast(`正文图片已自动压缩：${compressed.beforeKB}KB → ${compressed.afterKB}KB（webp）`, 'success')
    }
    sessionUploads.current.add(url)
    return url
  }

  /** PDF 附件：上传到同一公开桶的 pdfs/ 子目录。
      和图片一样纳入 sessionUploads，换文件 / 放弃编辑时会自动清理，不留垃圾。 */
  const uploadPdfFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setUploadingPdf(true)
    try {
      const { url, name, size } = await uploadPdf(file)
      sessionUploads.current.add(url)
      setForm((prev) => ({ ...prev, pdf_url: url, pdf_name: name }))
      toast(`PDF 已上传：${name}（${Math.round(size / 1024)}KB）`, 'success')
    } catch (err) {
      console.error('PDF 上传失败', err)
      toast(`PDF 上传失败：${(err as Error).message}`, 'error')
    } finally {
      setUploadingPdf(false)
      // 清空 value，否则再次选择同一个文件不会触发 change
      e.target.value = ''
    }
  }

  const submit = async (status: FormState['status']) => {
    if (saving) return

    // 保存/发布按钮是 type="button"，不走原生表单提交，所以 required 不会自动拦截；
    // 这里手动兜必填校验（标题、路径、正文）。
    if (!form.title.trim()) {
      toast('标题不能为空', 'error')
      return
    }
    if (!form.slug.trim()) {
      toast('路径 (slug) 不能为空', 'error')
      return
    }
    // 富文本模式下正文是 contentEditable，不是表单控件，HTML 的 required 对它无效，
    // 所以两种模式统一在这里兜一道非空校验。
    // 允许「只发一份 PDF 文档」这种文章：正文与 PDF 至少有一项即可。
    if (!toPlainText(form.content).trim() && !form.pdf_url) {
      toast('正文和 PDF 至少填写一项', 'error')
      return
    }

    setSaving(true)

    // 编辑已发布的文章时沿用原发布时间，否则每次保存都会把它刷成当前时间
    const existing = posts.find((p) => p.id === form.id)
    // PDF 两列只在「用到 PDF」时才写进 payload：
    // 数据库还没执行 post_pdfs.sql 时，普通发文/编辑仍和以前完全一样，
    // 不会因为 PostgREST 报 "column posts.pdf_url does not exist" 而把整个后台发文搞挂。
    // 编辑过带 PDF 的文章（originalPdfUrl 有值）时也要带上，才能把移除操作写成 null。
    type PostPayload = {
      title: string
      slug: string
      content: string
      cover_url: string | null
      category: Category
      status: FormState['status']
      published_at: string | null
      pdf_url?: string | null
      pdf_name?: string | null
    }
    const payload: PostPayload = {
      title: form.title,
      slug: form.slug,
      content: form.content,
      cover_url: form.cover_url,
      category: form.category,
      status,
      published_at:
        status === 'published'
          ? existing?.published_at ?? new Date().toISOString()
          : null,
    }
    if (form.pdf_url || originalPdfUrl.current) {
      payload.pdf_url = form.pdf_url
      payload.pdf_name = form.pdf_name
    }

    const { error } = form.id
      ? await supabase.from('posts').update(payload).eq('id', form.id)
      : await supabase.from('posts').insert(payload)

    setSaving(false)
    if (error) {
      // 没跑 post_pdfs.sql 却挂了 PDF 时，PostgREST 会报 42703，翻成可执行的人话
      const msg = /42703|pdf_url|pdf_name/.test(error.message)
        ? '数据库还没有 PDF 相关列，请先在 Supabase SQL Editor 执行 supabase/post_pdfs.sql'
        : error.message
      toast(msg, 'error')
      // 保存失败：不动已上传的资源，用户改完可直接重试
      return
    }

    // —— 保存成功后清理不再被引用的图片 ——
    // keep：保存后的文章实际引用的图片地址
    const keep = new Set<string>()
    if (payload.cover_url) keep.add(payload.cover_url)
    if (payload.pdf_url) keep.add(payload.pdf_url)
    for (const u of extractImageUrls(payload.content)) keep.add(u)

    // removed：需要从 Storage 删掉的
    const removed = new Set<string>()
    // ① 本次会话上传、最终没被引用的（被替换掉的封面/PDF、编辑器里删掉的图）
    for (const u of sessionUploads.current) removed.add(u)
    // ② 编辑已有文章时被移除的旧资源（换了封面 / 换了 PDF / 删了正文图）
    if (
      originalImages.current.coverUrl &&
      !keep.has(originalImages.current.coverUrl)
    ) {
      removed.add(originalImages.current.coverUrl)
    }
    if (originalPdfUrl.current && !keep.has(originalPdfUrl.current)) {
      removed.add(originalPdfUrl.current)
    }
    for (const u of originalImages.current.images) {
      if (!keep.has(u)) removed.add(u)
    }

    // 会话集合已按引用情况分好类，先清空，避免 closeModal 把仍被引用的图一并清掉
    sessionUploads.current = new Set()
    closeModal()
    load()
    // 发布/修改成功后让首页列表缓存失效，回首页能立即看到新内容（不再被 60s TTL 挡住）
    invalidateHomeCache()
    // 后台静默清理，不阻塞界面
    void cleanupImages(removed, keep)
  }

  // 打开空白弹窗新建，新文章默认走富文本
  const openCreate = () => {
    setForm(emptyForm())
    setRichMode(true)
    sessionUploads.current = new Set()
    originalImages.current = { coverUrl: null, images: [] }
    originalPdfUrl.current = null
    setOpen(true)
  }

  // 载入某篇文章编辑：正文本身是 HTML 的用富文本打开，是 Markdown 的用纯文本打开，
  // 避免把 Markdown 原文丢进富文本里破坏排版
  const startEdit = (post: Post) => {
    setForm({
      id: post.id,
      title: post.title,
      slug: post.slug,
      content: post.content,
      cover_url: post.cover_url,
      pdf_url: post.pdf_url ?? null,
      pdf_name: post.pdf_name ?? null,
      category: post.category ?? 'frontend',
      status: post.status,
    })
    setRichMode(looksLikeHtml(post.content))
    sessionUploads.current = new Set()
    originalImages.current = {
      coverUrl: post.cover_url,
      images: extractImageUrls(post.content),
    }
    originalPdfUrl.current = post.pdf_url ?? null
    setOpen(true)
  }

  // 草稿 <-> 已发布 一键切换
  const togglePublish = async (post: Post) => {
    const nextStatus = post.status === 'published' ? 'draft' : 'published'
    const { error } = await supabase
      .from('posts')
      .update({
        status: nextStatus,
        published_at: nextStatus === 'published' ? new Date().toISOString() : null,
      })
      .eq('id', post.id)

    if (error) {
      toast(error.message, 'error')
      return
    }
    // 正在编辑这篇的话，同步弹窗里的状态，避免显示不一致
    if (form.id === post.id) setForm((prev) => ({ ...prev, status: nextStatus }))
    load()
    // 发布状态切换后让首页列表缓存失效，回首页立即同步
    invalidateHomeCache()
  }

  const removePost = async (post: Post) => {
    const ok = await askConfirm(`确定删除《${post.title}》？删除后无法恢复。`)
    if (!ok) return

    const { error } = await supabase.from('posts').delete().eq('id', post.id)
    if (error) {
      toast(error.message, 'error')
      return
    }
    // 删掉的正是弹窗里这篇，就顺手关掉
    if (form.id === post.id) closeModal()
    load()
    // 删除后让首页列表缓存失效，回首页立即同步（刚删的不再出现）
    invalidateHomeCache()
    toast(`已删除《${post.title}》`, 'success')

    // —— 清理这篇文章的图片：只删"没有其它文章还在引用"的 ——
    // keep：其余文章（含草稿）仍引用的图片地址；万一两张文章用了同一张图，就不会误删
    const keep = new Set<string>()
    for (const p of posts) {
      if (p.id === post.id) continue
      if (p.cover_url) keep.add(p.cover_url)
      if (p.pdf_url) keep.add(p.pdf_url)
      for (const u of extractImageUrls(p.content)) keep.add(u)
    }
    const removed = new Set<string>()
    if (post.cover_url && !keep.has(post.cover_url)) removed.add(post.cover_url)
    if (post.pdf_url && !keep.has(post.pdf_url)) removed.add(post.pdf_url)
    for (const u of extractImageUrls(post.content)) {
      if (!keep.has(u)) removed.add(u)
    }
    void cleanupImages(removed, keep)
  }

  if (!user) {
    return (
      <div className="login-gate">
        {showLogin && <LoginModal onClose={() => setShowLogin(false)} />}
        <p className="muted">
          请先登录后访问后台。
          {!showLogin && (
            <a
              href="#"
              onClick={(e) => {
                e.preventDefault()
                setShowLogin(true)
              }}
            >
              点击登录
            </a>
          )}
        </p>
      </div>
    )
  }

  const totalPages = Math.max(1, Math.ceil(posts.length / PAGE_SIZE))
  const safePage = Math.min(page, totalPages)
  const pageStart = (safePage - 1) * PAGE_SIZE
  const pagePosts = posts.slice(pageStart, pageStart + PAGE_SIZE)

  return (
    <div className="admin">
      {/* 一级页签：文章管理 / 书签配置 */}
      <nav className="admin-tabs" aria-label="后台管理页签">
        <button
          type="button"
          className={tab === 'posts' ? 'active' : ''}
          onClick={() => setTab('posts')}
        >
          文章管理
        </button>
        <button
          type="button"
          className={tab === 'bookmarks' ? 'active' : ''}
          onClick={() => setTab('bookmarks')}
        >
          书签配置
        </button>
      </nav>

      {tab === 'bookmarks' ? (
        <BookmarkAdmin />
      ) : (
      <>
      <div className="admin-head">
        <h2>文章列表</h2>
        <button type="button" onClick={openCreate}>
          添加文章
        </button>
      </div>

      {posts.length === 0 ? (
        <p className="muted">还没有文章。</p>
      ) : (
        <table className="post-table">
          <thead>
            <tr>
              <th>标题</th>
              <th>分类</th>
              <th>时间</th>
              <th>状态</th>
              <th>操作</th>
            </tr>
          </thead>
          <tbody>
            {pagePosts.map((p) => (
              <tr key={p.id}>
                <td className="post-table-title">{p.title}</td>
                <td>
                  <span className={`post-category cat-${p.category}`}>
                    {CATEGORY_LABEL[p.category] ?? '—'}
                  </span>
                </td>
                <td className="muted">{formatTime(p)}</td>
                <td>
                  <span className={`status status-${p.status}`}>
                    {p.status === 'published' ? '已发布' : '草稿'}
                  </span>
                </td>
                <td className="post-table-actions">
                  <button type="button" onClick={() => startEdit(p)}>
                    编辑
                  </button>
                  <button type="button" onClick={() => togglePublish(p)}>
                    {p.status === 'published' ? '撤回' : '发布'}
                  </button>
                  <button
                    type="button"
                    className="danger"
                    onClick={() => removePost(p)}
                  >
                    删除
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {posts.length > 0 && (
        <nav className="post-pager" aria-label="分页导航">
          <span className="post-pager-info">
            共 {posts.length} 篇 · 第 {safePage}/{totalPages} 页
          </span>
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

      {open &&
        createPortal(
          <div className="modal-backdrop">
          <div
            className="modal post-modal"
            role="dialog"
            aria-modal="true"
            aria-label={form.id ? '编辑文章' : '添加文章'}
          >
            <div className="modal-head">
              <h2>{form.id ? '编辑文章' : '添加文章'}</h2>
              <button
                type="button"
                className="modal-close"
                onClick={closeModal}
                aria-label="关闭"
              >
                ×
              </button>
            </div>

            <form onSubmit={(e) => { e.preventDefault(); submit(form.status) }}>
              <div className="field">
                <label htmlFor="post-title">标题</label>
                <input
                  id="post-title"
                  placeholder="请输入文章标题"
                  value={form.title}
                  onChange={(e) => setForm({ ...form, title: e.target.value })}
                  required
                />
              </div>

              <div className="field">
                <label htmlFor="post-slug">路径 (slug)</label>
                <input
                  id="post-slug"
                  placeholder="英文路径，默认 my-log+时间，可修改"
                  value={form.slug}
                  onChange={(e) => setForm({ ...form, slug: e.target.value })}
                  required
                />
              </div>

              <div className="form-row">
                <div className="field">
                  <label htmlFor="post-category">类型</label>
                  <select
                    id="post-category"
                    value={form.category}
                    onChange={(e) =>
                      setForm({ ...form, category: e.target.value as Category })
                    }
                  >
                    {CATEGORIES.map((c) => (
                      <option key={c.value} value={c.value}>
                        {c.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <label className="cover-label">
                封面图
                <input
                  type="file"
                  accept="image/*"
                  onChange={uploadCover}
                  disabled={uploading}
                />
              </label>
              {uploading && <p className="muted">上传中…</p>}
              {form.cover_url && (
                <div className="cover-preview">
                  <img src={form.cover_url} alt="封面预览" />
                  <button
                    type="button"
                    onClick={() => setForm({ ...form, cover_url: null })}
                  >
                    移除封面
                  </button>
                </div>
              )}

              <div className="field pdf-field">
                <label htmlFor="post-pdf">PDF 文档</label>
                <input
                  id="post-pdf"
                  type="file"
                  accept="application/pdf,.pdf"
                  onChange={uploadPdfFile}
                  disabled={uploadingPdf}
                />
              </div>
              <p className="pdf-field-hint muted">
                可选 · 单个 PDF，≤20MB；正文可留空，只发 PDF 也可以
              </p>
              {uploadingPdf && <p className="muted">PDF 上传中…</p>}
              {form.pdf_url && (
                <div className="pdf-attach-preview">
                  <span className="pdf-attach-name" title={form.pdf_name || 'PDF 文档'}>
                    📄 {form.pdf_name || 'PDF 文档'}
                  </span>
                  <a href={form.pdf_url} target="_blank" rel="noreferrer">
                    预览
                  </a>
                  <button
                    type="button"
                    onClick={() =>
                      setForm({ ...form, pdf_url: null, pdf_name: null })
                    }
                  >
                    移除 PDF
                  </button>
                </div>
              )}

              <div className="editor-head">
                <span className="muted">正文</span>
                <div className="editor-modes">
                  <button
                    type="button"
                    className={richMode ? 'active' : ''}
                    onClick={() => setRichMode(true)}
                  >
                    富文本
                  </button>
                  <button
                    type="button"
                    className={richMode ? '' : 'active'}
                    onClick={() => setRichMode(false)}
                  >
                    纯文本
                  </button>
                </div>
              </div>

              {richMode ? (
                <RichTextEditor
                  value={form.content}
                  onChange={(html) => setForm((prev) => ({ ...prev, content: html }))}
                  placeholder="正文 · 可加粗、设标题、插列表、传图"
                  onUploadImage={uploadContentImage}
                />
              ) : (
                <textarea
                  className="editor-textarea"
                  placeholder="正文（支持 Markdown）"
                  value={form.content}
                  onChange={(e) => setForm({ ...form, content: e.target.value })}
                />
              )}

              <div className="form-actions">
                <button
                  type="button"
                  onClick={() => submit('draft')}
                  disabled={saving}
                >
                  {saving ? '保存中…' : form.id ? '存为草稿' : '保存草稿'}
                </button>
                <button
                  type="button"
                  className="btn-primary"
                  onClick={() => submit('published')}
                  disabled={saving}
                >
                  {saving ? '保存中…' : form.id ? '发布更新' : '发布'}
                </button>
                <button type="button" className="btn-ghost" onClick={closeModal}>
                  取消
                </button>
              </div>
            </form>
          </div>
        </div>,
          document.body,
        )}

      {confirmMsg &&
        createPortal(
          <div className="modal-backdrop" onClick={() => closeConfirm(false)}>
            <div
              className="modal confirm-modal"
              role="alertdialog"
              aria-modal="true"
              aria-label="删除确认"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="modal-head">
                <h2>删除确认</h2>
              </div>
              <p className="confirm-text">{confirmMsg}</p>
              <div className="confirm-actions">
                <button type="button" className="btn-ghost" onClick={() => closeConfirm(false)}>
                  取消
                </button>
                <button type="button" className="btn-danger" onClick={() => closeConfirm(true)}>
                  删除
                </button>
              </div>
            </div>
          </div>,
          document.body,
        )}
      </>
      )}
    </div>
  )
}
