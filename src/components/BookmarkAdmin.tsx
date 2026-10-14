import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { supabase } from '../lib/supabase'
import { toast } from '../lib/toast'
import { invalidateToolsCache } from '../pages/Tools'
import {
  BOOKMARK_CATEGORY_HINTS,
  type Bookmark,
} from '../types'

type BmForm = {
  id: string | null
  name: string
  url: string
  category: string
  description: string
}

const emptyForm = (): BmForm => ({
  id: null,
  name: '',
  url: '',
  category: '开发',
  description: '',
})

/** 网址规范化：没带协议的自动补 https://，否则 <a href="xx.com"> 会被当成相对路径 */
function normalizeUrl(raw: string) {
  const s = raw.trim()
  if (!s) return s
  return /^https?:\/\//i.test(s) ? s : `https://${s}`
}

export default function BookmarkAdmin() {
  const [items, setItems] = useState<Bookmark[]>([])
  const [form, setForm] = useState<BmForm>(emptyForm)
  const [open, setOpen] = useState(false)
  const [saving, setSaving] = useState(false)

  /** 删除二次确认：自定义模态（与 Admin 文章删除一致，不用原生 window.confirm） */
  const [confirmTarget, setConfirmTarget] = useState<Bookmark | null>(null)

  const load = async () => {
    const { data } = await supabase
      .from('bookmarks')
      .select('*')
      .order('created_at', { ascending: false })
    if (data) setItems(data as Bookmark[])
  }

  useEffect(() => {
    void load()
  }, [])

  // 弹窗打开期间锁住背景滚动（与文章弹窗 / 记事弹窗一致）
  useEffect(() => {
    if (!open) return
    const prevOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = prevOverflow
    }
  }, [open])

  const submit = async () => {
    if (saving) return
    if (!form.name.trim()) {
      toast('名称不能为空', 'error')
      return
    }
    if (!form.url.trim()) {
      toast('网址不能为空', 'error')
      return
    }
    const payload = {
      name: form.name.trim(),
      url: normalizeUrl(form.url),
      category: form.category.trim() || '其他',
      description: form.description.trim(),
    }
    setSaving(true)
    const { error } = form.id
      ? await supabase.from('bookmarks').update(payload).eq('id', form.id)
      : await supabase.from('bookmarks').insert(payload)
    setSaving(false)
    if (error) {
      toast(error.message, 'error')
      return
    }
    setOpen(false)
    setForm(emptyForm())
    void load()
    // 让前台 /tools 缓存失效，下次进入立即看到最新书签
    invalidateToolsCache()
    toast(form.id ? '书签已更新' : '书签已添加', 'success')
  }

  const remove = (b: Bookmark) => {
    setConfirmTarget(b)
  }

  const confirmRemove = async () => {
    const b = confirmTarget
    if (!b) return
    setConfirmTarget(null)
    const { error } = await supabase.from('bookmarks').delete().eq('id', b.id)
    if (error) {
      toast(error.message, 'error')
      return
    }
    void load()
    invalidateToolsCache()
    toast(`已删除《${b.name}》`, 'success')
  }

  return (
    <>
      <div className="admin-head">
        <h2>书签配置</h2>
        <button type="button" onClick={() => { setForm(emptyForm()); setOpen(true) }}>
          添加书签
        </button>
      </div>

      {items.length === 0 ? (
        <p className="muted">还没有书签，点右上角「添加书签」配置第一个快速入口。</p>
      ) : (
        <table className="post-table">
          <thead>
            <tr>
              <th>名称</th>
              <th>网址</th>
              <th>分类</th>
              <th>介绍</th>
              <th>创建时间</th>
              <th>操作</th>
            </tr>
          </thead>
          <tbody>
            {items.map((b) => (
              <tr key={b.id}>
                <td className="post-table-title">{b.name}</td>
                <td className="bm-url-cell">
                  <a href={b.url} target="_blank" rel="noreferrer">
                    {b.url}
                  </a>
                </td>
                <td>
                  <span className="bm-cat-tag">{b.category}</span>
                </td>
                <td className="muted bm-desc-cell">{b.description || '—'}</td>
                <td className="muted">
                  {b.created_at ? new Date(b.created_at).toLocaleString('zh-CN', { hour12: false }) : '—'}
                </td>
                <td className="post-table-actions">
                  <button
                    type="button"
                    onClick={() => {
                      setForm({
                        id: b.id,
                        name: b.name,
                        url: b.url,
                        category: b.category,
                        description: b.description,
                      })
                      setOpen(true)
                    }}
                  >
                    编辑
                  </button>
                  <button type="button" className="danger" onClick={() => remove(b)}>
                    删除
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {/* 必须挂 body：.container 带 backdrop-filter，行内渲染的 position:fixed 会相对
          容器定位，书签多时容器超高，弹窗被挤到首屏外要滚动才看得到 */}
      {open &&
        createPortal(
          <div className="modal-backdrop">
          <div className="modal" role="dialog" aria-modal="true" aria-label="书签表单">
            <div className="modal-head">
              <h2>{form.id ? '编辑书签' : '添加书签'}</h2>
              <button
                type="button"
                className="modal-close"
                onClick={() => setOpen(false)}
                aria-label="关闭"
              >
                ×
              </button>
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault()
                void submit()
              }}
            >
              <div className="field">
                <label htmlFor="bm-name">名称</label>
                <input
                  id="bm-name"
                  placeholder="如：GitHub"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  required
                />
              </div>

              <div className="field">
                <label htmlFor="bm-url">网址</label>
                <input
                  id="bm-url"
                  placeholder="如：https://github.com（没写协议会自动补 https://）"
                  value={form.url}
                  onChange={(e) => setForm({ ...form, url: e.target.value })}
                  required
                />
              </div>

              <div className="field">
                <label htmlFor="bm-category">分类</label>
                <input
                  id="bm-category"
                  list="bm-category-hints"
                  placeholder="输入或选择分类"
                  value={form.category}
                  onChange={(e) => setForm({ ...form, category: e.target.value })}
                />
                <datalist id="bm-category-hints">
                  {BOOKMARK_CATEGORY_HINTS.map((c) => (
                    <option key={c} value={c} />
                  ))}
                </datalist>
              </div>

              <div className="field">
                <label htmlFor="bm-desc">介绍</label>
                <input
                  id="bm-desc"
                  placeholder="一句话说明这个网站是干嘛的（可留空）"
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                />
              </div>

              <div className="form-actions">
                <button type="button" className="btn-ghost" onClick={() => setOpen(false)}>
                  取消
                </button>
                <button type="submit" className="btn-primary" disabled={saving}>
                  {saving ? '保存中…' : '保存'}
                </button>
              </div>
            </form>
          </div>
          </div>,
          document.body,
        )}

      {/* 删除二次确认：挂 body 的模态，复用项目既有 .confirm-modal 样式 */}
      {confirmTarget &&
        createPortal(
          <div
            className="modal-backdrop"
            onClick={() => setConfirmTarget(null)}
          >
            <div
              className="modal confirm-modal"
              role="dialog"
              aria-modal="true"
              onClick={(e) => e.stopPropagation()}
            >
              <p className="confirm-text">
                确定删除书签《{confirmTarget.name}》？删除后无法恢复。
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
    </>
  )
}
