import { useEffect, useMemo, useRef, useState } from 'react'
import type { User } from '@supabase/supabase-js'
import { createPortal } from 'react-dom'
import { Helmet } from 'react-helmet-async'
import { supabase } from '../lib/supabase'
import LoginModal from '../components/LoginModal'
import { toast } from '../lib/toast'
import { formatDateTime } from '../lib/date'
import type { Note } from '../types'

type NoteForm = {
  id: string | null
  title: string
  content: string
}

const emptyForm = (): NoteForm => ({ id: null, title: '', content: '' })

/** 卡片摘要：折叠空白后截断，避免长文把卡片撑爆 */
function excerptOf(content: string) {
  return content.replace(/\s+/g, ' ').trim().slice(0, 120)
}

export default function Notes() {
  const [user, setUser] = useState<User | null>(null)
  /** 会话恢复中：先不渲染登录墙，避免每次进入都闪一下「请先登录」 */
  const [booting, setBooting] = useState(true)
  const [items, setItems] = useState<Note[]>([])
  const [loading, setLoading] = useState(true)
  const [keyword, setKeyword] = useState('')
  const [form, setForm] = useState<NoteForm>(emptyForm)
  const [open, setOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [showLogin, setShowLogin] = useState(false)
  /** 删除二次确认：自定义模态（与后台书签删除一致，不用原生 window.confirm） */
  const [confirmTarget, setConfirmTarget] = useState<Note | null>(null)

  const textareaRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    // 先用本地已有会话恢复一次（普通刷新 / 魔法链接回调后的场景）
    supabase.auth.getSession().then(({ data }) => {
      setUser(data.session?.user ?? null)
      setBooting(false)
    })

    // 魔法链接回调时 URL 中的 token 由 supabase-js 异步解析，
    // 只查一次会误判为未登录，必须靠事件通知补齐状态
    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null)
    })

    return () => sub.subscription.unsubscribe()
  }, [])

  // 未登录时自动弹出登录弹窗；一旦拿到会话立即收起
  useEffect(() => {
    if (!booting) setShowLogin(!user)
  }, [user, booting])

  const load = async () => {
    const { data } = await supabase
      .from('notes')
      .select('*')
      .order('updated_at', { ascending: false })
    if (data) setItems(data as Note[])
    setLoading(false)
  }

  useEffect(() => {
    if (user) void load()
  }, [user])

  // 本地搜索：标题 / 正文全匹配，输完即时过滤
  const filtered = useMemo(() => {
    const kw = keyword.trim().toLowerCase()
    if (!kw) return items
    return items.filter((n) =>
      [n.title, n.content].join(' ').toLowerCase().includes(kw),
    )
  }, [items, keyword])

  // 弹窗打开期间锁背景滚动
  useEffect(() => {
    if (!open) return
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = prev
    }
  }, [open])

  // 文本框高度随内容自动增高（封顶 420px，超出内部滚动）
  useEffect(() => {
    const el = textareaRef.current
    if (!el || !open) return
    el.style.height = 'auto'
    el.style.height = `${Math.min(el.scrollHeight, 420)}px`
  }, [open, form.content])

  const openCreate = () => {
    setForm(emptyForm())
    setOpen(true)
  }

  const startEdit = (n: Note) => {
    setForm({ id: n.id, title: n.title, content: n.content })
    setOpen(true)
  }

  const submit = async () => {
    if (saving) return
    const title = form.title.trim()
    const content = form.content.trim()
    if (!title && !content) {
      toast('标题和内容不能都为空', 'error')
      return
    }

    setSaving(true)
    // 新建 / 编辑都显式带 updated_at：既保证「最近编辑」排序准确，
    // 也避免两种 payload 形状不同触发 supabase-js 的联合类型报错
    const payload = { title, content, updated_at: new Date().toISOString() }

    const { error } = form.id
      ? await supabase.from('notes').update(payload).eq('id', form.id)
      : await supabase.from('notes').insert(payload)
    setSaving(false)

    if (error) {
      toast(error.message, 'error')
      return
    }
    setOpen(false)
    setForm(emptyForm())
    void load()
    toast(form.id ? '记事已更新' : '记事已保存', 'success')
  }

  const confirmRemove = async () => {
    const n = confirmTarget
    if (!n) return
    setConfirmTarget(null)
    const { error } = await supabase.from('notes').delete().eq('id', n.id)
    if (error) {
      toast(error.message, 'error')
      return
    }
    void load()
    toast(`已删除《${n.title || '无标题'}》`, 'success')
  }

  // 会话恢复完成前展示加载态，不闪登录墙
  if (booting) {
    return (
      <div className="tools-page">
        <Helmet>
          <title>记事本 · 沃哥博客</title>
        </Helmet>
        <p className="muted">加载中…</p>
      </div>
    )
  }

  if (!user) {
    return (
      <div className="login-gate">
        <Helmet>
          <title>记事本 · 沃哥博客</title>
        </Helmet>
        {showLogin && (
          <LoginModal onClose={() => setShowLogin(false)} redirectTo="/notes" />
        )}
        <p className="muted">
          记事本是私密内容，请先登录后查看。
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
    <div className="tools-page">
      <Helmet>
        <title>记事本 · 沃哥博客</title>
      </Helmet>

      <div className="notes-head">
        <div>
          <h1 className="tools-title">记事本</h1>
          <p className="tools-sub">随手记录灵感与待办，仅登录后可见，数据保存在 Supabase</p>
        </div>
        <button type="button" className="btn-primary" onClick={openCreate}>
          新建记事
        </button>
      </div>

      {items.length > 0 && (
        <div className="notes-search">
          <input
            type="search"
            placeholder="搜索记事：标题 / 正文"
            value={keyword}
            onChange={(e) => setKeyword(e.target.value)}
            aria-label="搜索记事"
          />
        </div>
      )}

      {loading ? (
        <p className="muted">加载中…</p>
      ) : items.length === 0 ? (
        <p className="muted">还没有记事，点右上角「新建记事」记录第一条吧。</p>
      ) : filtered.length === 0 ? (
        <p className="muted">没有匹配「{keyword.trim()}」的记事。</p>
      ) : (
        <div className="notes-grid">
          {filtered.map((n) => (
            <div
              key={n.id}
              className="note-card"
              role="button"
              tabIndex={0}
              onClick={() => startEdit(n)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault()
                  startEdit(n)
                }
              }}
            >
              <span className={`note-title${n.title ? '' : ' is-empty'}`}>
                {n.title || '无标题'}
              </span>
              {n.content && <span className="note-excerpt">{excerptOf(n.content)}</span>}
              <span className="note-foot">
                <span className="note-time">{formatDateTime(n.updated_at) || '—'}</span>
                <button
                  type="button"
                  className="note-del"
                  onClick={(e) => {
                    e.stopPropagation()
                    setConfirmTarget(n)
                  }}
                >
                  删除
                </button>
              </span>
            </div>
          ))}
        </div>
      )}

      {open &&
        createPortal(
          <div className="modal-backdrop">
            <div
              className="modal note-modal"
              role="dialog"
              aria-modal="true"
              aria-label={form.id ? '编辑记事' : '新建记事'}
            >
              <div className="modal-head">
                <h2>{form.id ? '编辑记事' : '新建记事'}</h2>
                <button
                  type="button"
                  className="modal-close"
                  onClick={() => setOpen(false)}
                  aria-label="关闭"
                >
                  ×
                </button>
              </div>

              <div className="field">
                <label htmlFor="note-title">标题</label>
                <input
                  id="note-title"
                  placeholder="一句话标题（可留空）"
                  value={form.title}
                  onChange={(e) => setForm((prev) => ({ ...prev, title: e.target.value }))}
                />
              </div>

              <div className="field">
                <label htmlFor="note-content">内容</label>
                <textarea
                  id="note-content"
                  ref={textareaRef}
                  className="note-editor"
                  placeholder="随手记点什么…（Ctrl / ⌘ + Enter 快速保存）"
                  value={form.content}
                  onChange={(e) => setForm((prev) => ({ ...prev, content: e.target.value }))}
                  onKeyDown={(e) => {
                    if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') void submit()
                  }}
                />
              </div>

              <div className="form-actions">
                <button type="button" className="btn-ghost" onClick={() => setOpen(false)}>
                  取消
                </button>
                <button
                  type="button"
                  className="btn-primary"
                  onClick={() => void submit()}
                  disabled={saving}
                >
                  {saving ? '保存中…' : '保存'}
                </button>
              </div>
            </div>
          </div>,
          document.body,
        )}

      {confirmTarget &&
        createPortal(
          <div className="modal-backdrop" onClick={() => setConfirmTarget(null)}>
            <div
              className="modal confirm-modal"
              role="dialog"
              aria-modal="true"
              onClick={(e) => e.stopPropagation()}
            >
              <p className="confirm-text">
                确定删除《{confirmTarget.title || '无标题'}》？删除后无法恢复。
              </p>
              <div className="confirm-actions">
                <button type="button" onClick={() => setConfirmTarget(null)}>
                  取消
                </button>
                <button type="button" className="btn-danger" onClick={() => void confirmRemove()}>
                  删除
                </button>
              </div>
            </div>
          </div>,
          document.body,
        )}
    </div>
  )
}
