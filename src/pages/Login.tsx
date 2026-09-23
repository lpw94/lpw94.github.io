import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'

// 回跳地址：优先用构建时注入的正式域名（VITE_SITE_URL），
// 这样无论在本地(localhost)还是线上生成链接，回跳都指向生产站点，
// 避免误把 redirect_to 写成 http://localhost:3000 导致点链接后又弹回本地。
const SITE_URL = (import.meta.env.VITE_SITE_URL as string) || window.location.origin

type Mode = 'magiclink' | 'password' | 'signup'

export default function Login() {
  const navigate = useNavigate()
  const [mode, setMode] = useState<Mode>('magiclink')
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

  const sendMagicLink = async (e: React.FormEvent) => {
    e.preventDefault()
    resetMsg()
    setLoading(true)
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: `${SITE_URL}/admin` },
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
    // 登录成功，进入后台；Admin 通过 onAuthStateChange 识别会话
    navigate('/admin')
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
      options: { emailRedirectTo: `${SITE_URL}/admin` },
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

  return (
    <div className="auth-form">
      <h2>后台登录</h2>

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
  )
}
