import { useEffect, useRef, useState } from 'react'
import { supabase } from '../lib/supabase'
import { uploadImage, deleteImage } from '../lib/storage'
import { looksLikeHtml, toPlainText } from '../lib/content'
import RichTextEditor from '../components/RichTextEditor'
import LoginModal from '../components/LoginModal'
import { CATEGORIES, CATEGORY_LABEL, type Category, type Post } from '../types'
import { formatDateTime } from '../lib/date'

type FormState = {
  /** 编辑中的文章 id；null 表示新建 */
  id: string | null
  title: string
  slug: string
  content: string
  cover_url: string | null
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
  category: 'frontend',
  status: 'published',
})

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
  const [saving, setSaving] = useState(false)

  /** 本次表单会话里新上传的图片公开地址（封面 + 正文图）。
      上传即落盘，但只有保存成功后才真正被文章引用；
      被替换/被删掉/放弃编辑的，都要从 Storage 清掉，避免垃圾文件占额度。 */
  const sessionUploads = useRef<Set<string>>(new Set())
  /** 打开表单时文章的原始图片引用（原封面 + 原正文图）。
      编辑已有文章保存成功后，凡是"原来有、现在没了"的旧图都要删。 */
  const originalImages = useRef<{ coverUrl: string | null; images: string[] }>({
    coverUrl: null,
    images: [],
  })

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

  /** 删除不再被引用的图片；失败只记日志（外链地址会被 deleteImage 自动跳过），
      不阻断保存/关闭流程 —— 图片清理是锦上添花，不能因为它把发文搞挂。 */
  const cleanupImages = async (urls: Iterable<string>, keep: Set<string>) => {
    for (const url of urls) {
      if (keep.has(url)) continue
      const ok = await deleteImage(url)
      if (!ok) console.warn('图片清理失败（可稍后在 Supabase Storage 手动删除）', url)
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
      // 路径规范与「Invalid key」相关注意事项见 lib/storage.ts
      const url = await uploadImage(file, 'covers')
      sessionUploads.current.add(url)
      setForm((prev) => ({ ...prev, cover_url: url }))
    } catch (err) {
      console.error('封面图上传失败', err)
      alert(`上传失败：${(err as Error).message}`)
    } finally {
      setUploading(false)
      // 清空 value，否则再次选择同一个文件不会触发 change 事件
      e.target.value = ''
    }
  }

  /** 正文内嵌图片：放在 content/ 子目录，与封面区分开 */
  const uploadContentImage = async (file: File) => {
    const url = await uploadImage(file, 'content')
    sessionUploads.current.add(url)
    return url
  }

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (saving) return

    // 富文本模式下正文是 contentEditable，不是表单控件，HTML 的 required 对它无效，
    // 所以两种模式统一在这里兜一道非空校验
    if (!toPlainText(form.content).trim()) {
      alert('正文不能为空')
      return
    }

    setSaving(true)

    // 编辑已发布的文章时沿用原发布时间，否则每次保存都会把它刷成当前时间
    const existing = posts.find((p) => p.id === form.id)
    const payload = {
      title: form.title,
      slug: form.slug,
      content: form.content,
      cover_url: form.cover_url,
      category: form.category,
      status: form.status,
      published_at:
        form.status === 'published'
          ? existing?.published_at ?? new Date().toISOString()
          : null,
    }

    const { error } = form.id
      ? await supabase.from('posts').update(payload).eq('id', form.id)
      : await supabase.from('posts').insert(payload)

    setSaving(false)
    if (error) {
      alert(error.message)
      // 保存失败：不动已上传的图片，用户改完可直接重试
      return
    }

    // —— 保存成功后清理不再被引用的图片 ——
    // keep：保存后的文章实际引用的图片地址
    const keep = new Set<string>()
    if (payload.cover_url) keep.add(payload.cover_url)
    for (const u of extractImageUrls(payload.content)) keep.add(u)

    // removed：需要从 Storage 删掉的
    const removed = new Set<string>()
    // ① 本次会话上传、最终没被引用的（被替换掉的封面、编辑器里删掉的图）
    for (const u of sessionUploads.current) removed.add(u)
    // ② 编辑已有文章时被移除的旧资源（换了封面 / 删了正文图）
    if (
      originalImages.current.coverUrl &&
      !keep.has(originalImages.current.coverUrl)
    ) {
      removed.add(originalImages.current.coverUrl)
    }
    for (const u of originalImages.current.images) {
      if (!keep.has(u)) removed.add(u)
    }

    // 会话集合已按引用情况分好类，先清空，避免 closeModal 把仍被引用的图一并清掉
    sessionUploads.current = new Set()
    closeModal()
    load()
    // 后台静默清理，不阻塞界面
    void cleanupImages(removed, keep)
  }

  // 打开空白弹窗新建，新文章默认走富文本
  const openCreate = () => {
    setForm(emptyForm())
    setRichMode(true)
    sessionUploads.current = new Set()
    originalImages.current = { coverUrl: null, images: [] }
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
      category: post.category ?? 'frontend',
      status: post.status,
    })
    setRichMode(looksLikeHtml(post.content))
    sessionUploads.current = new Set()
    originalImages.current = {
      coverUrl: post.cover_url,
      images: extractImageUrls(post.content),
    }
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
      alert(error.message)
      return
    }
    // 正在编辑这篇的话，同步弹窗里的状态，避免显示不一致
    if (form.id === post.id) setForm((prev) => ({ ...prev, status: nextStatus }))
    load()
  }

  const removePost = async (post: Post) => {
    if (!window.confirm(`确定删除《${post.title}》？删除后无法恢复。`)) return

    const { error } = await supabase.from('posts').delete().eq('id', post.id)
    if (error) {
      alert(error.message)
      return
    }
    // 删掉的正是弹窗里这篇，就顺手关掉
    if (form.id === post.id) closeModal()
    load()

    // —— 清理这篇文章的图片：只删"没有其它文章还在引用"的 ——
    // keep：其余文章（含草稿）仍引用的图片地址；万一两张文章用了同一张图，就不会误删
    const keep = new Set<string>()
    for (const p of posts) {
      if (p.id === post.id) continue
      if (p.cover_url) keep.add(p.cover_url)
      for (const u of extractImageUrls(p.content)) keep.add(u)
    }
    const removed = new Set<string>()
    if (post.cover_url && !keep.has(post.cover_url)) removed.add(post.cover_url)
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

  return (
    <div className="admin">
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
            {posts.map((p) => (
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

      {open && (
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

            <form onSubmit={submit}>
              <input
                placeholder="标题"
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
                required
              />
              <input
                placeholder="slug（英文路径，默认 my-log+时间，可修改）"
                value={form.slug}
                onChange={(e) => setForm({ ...form, slug: e.target.value })}
                required
              />
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
                  placeholder="正文（支持 Markdown）"
                  rows={8}
                  value={form.content}
                  onChange={(e) => setForm({ ...form, content: e.target.value })}
                />
              )}

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

              <select
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

              <select
                value={form.status}
                onChange={(e) =>
                  setForm({ ...form, status: e.target.value as FormState['status'] })
                }
              >
                <option value="draft">草稿</option>
                <option value="published">发布</option>
              </select>

              <div className="form-actions">
                <button type="submit" disabled={saving}>
                  {saving ? '保存中…' : form.id ? '保存修改' : '保存'}
                </button>
                <button type="button" onClick={closeModal}>
                  取消
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
