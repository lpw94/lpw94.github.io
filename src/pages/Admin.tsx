import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import type { Post } from '../types'

type FormState = {
  title: string
  slug: string
  content: string
  cover_url: string | null
  status: 'draft' | 'published'
}

export default function Admin() {
  const [user, setUser] = useState<unknown>(null)
  const [posts, setPosts] = useState<Post[]>([])
  const [form, setForm] = useState<FormState>({
    title: '',
    slug: '',
    content: '',
    cover_url: null,
    status: 'draft',
  })
  const [uploading, setUploading] = useState(false)

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

  const uploadCover = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setUploading(true)

    // 不要把原始文件名拼进存储路径：中文、空格、#、? 等字符会让对象 key 非法，
    // Storage 会直接以 "Invalid key" 拒绝。统一改用「时间戳 + 随机串 + 扩展名」。
    const rawExt = file.name.includes('.') ? file.name.split('.').pop()! : ''
    const ext = rawExt.toLowerCase().replace(/[^a-z0-9]/g, '') || 'png'
    const path = `covers/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`

    const { error } = await supabase.storage
      .from('covers')
      .upload(path, file, { contentType: file.type || undefined })

    setUploading(false)
    if (error) {
      console.error('封面图上传失败', error)
      alert(`上传失败：${error.message}`)
      return
    }

    const { data } = supabase.storage.from('covers').getPublicUrl(path)
    setForm({ ...form, cover_url: data.publicUrl })
  }

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    const { error } = await supabase.from('posts').insert({
      title: form.title,
      slug: form.slug,
      content: form.content,
      cover_url: form.cover_url,
      status: form.status,
      published_at: form.status === 'published' ? new Date().toISOString() : null,
    })
    if (error) {
      alert(error.message)
      return
    }
    setForm({ title: '', slug: '', content: '', cover_url: null, status: 'draft' })
    load()
  }

  if (!user) {
    return (
      <p className="muted">
        请先 <a href="/login">登录</a> 后访问后台。
      </p>
    )
  }

  return (
    <div className="admin">
      <h2>写文章</h2>
      <form onSubmit={submit}>
        <input
          placeholder="标题"
          value={form.title}
          onChange={(e) => setForm({ ...form, title: e.target.value })}
          required
        />
        <input
          placeholder="slug（英文路径，如 my-first-post）"
          value={form.slug}
          onChange={(e) => setForm({ ...form, slug: e.target.value })}
          required
        />
        <textarea
          placeholder="正文（支持 Markdown）"
          rows={8}
          value={form.content}
          onChange={(e) => setForm({ ...form, content: e.target.value })}
          required
        />

        <label className="cover-label">
          封面图
          <input type="file" accept="image/*" onChange={uploadCover} disabled={uploading} />
        </label>
        {uploading && <p className="muted">上传中…</p>}
        {form.cover_url && (
          <div className="cover-preview">
            <img src={form.cover_url} alt="封面预览" />
            <button type="button" onClick={() => setForm({ ...form, cover_url: null })}>
              移除封面
            </button>
          </div>
        )}

        <select
          value={form.status}
          onChange={(e) =>
            setForm({ ...form, status: e.target.value as FormState['status'] })
          }
        >
          <option value="draft">草稿</option>
          <option value="published">发布</option>
        </select>
        <button type="submit">保存</button>
      </form>

      <h2>已有文章</h2>
      <ul>
        {posts.map((p) => (
          <li key={p.id}>
            {p.title} <span className="muted">[{p.status}]</span>
          </li>
        ))}
      </ul>
    </div>
  )
}
