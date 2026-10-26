import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { supabase } from '../lib/supabase'
import { SITE_URL } from '../lib/site'

// 回跳地址用当前站点的 origin（见 lib/site.ts）：
// 线上就是 https://lpw94.github.io，本地就是 localhost，
// 不要再用 VITE_SITE_URL —— 部署环境的 secret 指到了 Supabase 项目地址，
// 会把魔法链接的 redirect_to 写成 supabase.co，点开会落到一个不存在的页面。

type Mode = 'magiclink' | 'password' | 'signup'

// 登录弹窗：默认「密码登录」Tab；未登录访问 /admin 时由 Admin 自动弹出。
// 登录成功（密码登录）后调用 onClose 关闭弹窗，Admin 通过 onAuthStateChange 识别会话并展示后台。
// redirectTo：魔法链接 / 注册验证邮件的回跳地址，默认 /admin；
// 记事本等其它登录墙页面传入自身路径，登录后回到原页面而不是跳到后台。
export default function LoginModal({
  onClose,
  redirectTo = '/admin',
}: {
  onClose: () => void
  redirectTo?: string
}) {
  const [mode, setMode] = useState<Mode>('password')
  const [email, setEmail] = useState('lpw94@qq.com')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [msg, setMsg] = useState('')
  const [err, setErr] = useState('')
  const [loading, setLoading] = useState(false)

  const resetMsg = () => {
    setMsg('')
    setErr('')
  }

  // 弹窗打开期间锁住背景滚动
  useEffect(() => {
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = prev
    }
  }, [])

  // Esc 关闭弹窗
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  const sendMagicLink = async (e: React.FormEvent) => {
    e.preventDefault()
    resetMsg()
    setLoading(true)
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: `${SITE_URL}${redirectTo}` },
    })
    setLoading(false)
    if (error) setErr(error.message)
    else setMsg('登录链接已发送到邮箱，请查收。')
  }

  const signInPassword = async (e: React.FormEvent) => {
    e.preventDefault()
    resetMsg()
    setLoading(true)
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    setLoading(false)
    if (error) {
      setErr(error.message)
      return
    }
    // 登录成功：关闭弹窗，Admin 通过 onAuthStateChange 识别会话
    onClose()
  }

  const signUp = async (e: React.FormEvent) => {
    e.preventDefault()
    resetMsg()
    if (password !== confirm) {
      setErr('两次输入的密码不一致')
      return
    }
    setLoading(true)
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: { emailRedirectTo: `${SITE_URL}${redirectTo}` },
    })
    setLoading(false)
    if (error) {
      setErr(error.message)
      return
    }
    setMsg('账号已创建，验证邮件已发送（若开启邮箱验证请先点击验证），之后即可用密码登录。')
  }

  const forgot = async () => {
    resetMsg()
    setLoading(true)
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${SITE_URL}/reset-password`,
    })
    setLoading(false)
    if (error) {
      setErr(error.message)
      return
    }
    setMsg('重置密码邮件已发送，请按邮件中的链接设置新密码。')
  }

  // 同一个弹窗给后台 / 记事本 / 放映厅共用：只有回跳 /admin 时才是「后台登录」
  const title = redirectTo === '/admin' ? '后台登录' : '登录后继续'

  return createPortal(
    <div className="modal-backdrop">
      <div
        className="modal login-modal"
        role="dialog"
        aria-modal="true"
        aria-label={title}
      >
        <div className="modal-head">
          <h2>{title}</h2>
          <button type="button" className="modal-close" onClick={onClose} aria-label="关闭">
            ×
          </button>
        </div>

        <div className="auth-tabs">
          <button
            type="button"
            className={mode === 'magiclink' ? 'active' : ''}
            onClick={() => {
              setMode('magiclink')
              resetMsg()
            }}
          >
            魔法链接
          </button>
          <button
            type="button"
            className={mode === 'password' || mode === 'signup' ? 'active' : ''}
            onClick={() => {
              setMode('password')
              resetMsg()
            }}
          >
            密码登录
          </button>
        </div>

        {mode === 'magiclink' && (
          <form onSubmit={sendMagicLink}>
            <p className="muted">使用邮箱魔法链接登录，无需密码。</p>
            <input
              type="email"
              required
              placeholder="你的邮箱"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
            <button type="submit" disabled={loading}>
              {loading ? '发送中…' : '发送登录链接'}
            </button>
          </form>
        )}

        {mode === 'password' && (
          <form onSubmit={signInPassword}>
            <input
              type="email"
              required
              placeholder="你的邮箱"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
            <input
              type="password"
              required
              placeholder="密码"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
            <button type="submit" disabled={loading}>
              {loading ? '登录中…' : '登录'}
            </button>
            <div className="auth-switch">
              <a
                href="#"
                onClick={(e) => {
                  e.preventDefault()
                  setMode('signup')
                  resetMsg()
                }}
              >
                注册新账号
              </a>
              <a
                href="#"
                className="muted"
                onClick={(e) => {
                  e.preventDefault()
                  forgot()
                }}
              >
                忘记密码？
              </a>
            </div>
          </form>
        )}

        {mode === 'signup' && (
          <form onSubmit={signUp}>
            <p className="muted">创建账号（邮箱 + 密码），之后可用密码登录。</p>
            <input
              type="email"
              required
              placeholder="你的邮箱"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
            <input
              type="password"
              required
              placeholder="设置密码（至少 6 位）"
              minLength={6}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
            <input
              type="password"
              required
              placeholder="确认密码"
              minLength={6}
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
            />
            <button type="submit" disabled={loading}>
              {loading ? '创建中…' : '注册'}
            </button>
            <div className="auth-switch">
              <a
                href="#"
                onClick={(e) => {
                  e.preventDefault()
                  setMode('password')
                  resetMsg()
                }}
              >
                返回密码登录
              </a>
            </div>
          </form>
        )}

        {msg && <p className="muted ok">{msg}</p>}
        {err && <p className="err">{err}</p>}
      </div>
    </div>,
    document.body,
  )
}
