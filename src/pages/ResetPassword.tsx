import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'

// 邮件「重置密码」链接带 #access_token，supabase-js 自动解析并建立会话，
// 本页据此让用户设置新密码（也用于给仅魔法链接登录的账号补设密码）。
export default function ResetPassword() {
  const navigate = useNavigate()
  const [password, setPassword] = useState('')
  const [msg, setMsg] = useState('')
  const [err, setErr] = useState('')
  const [ready, setReady] = useState(false)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setReady(Boolean(data.session?.user)))
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => setReady(Boolean(s?.user)))
    return () => sub.subscription.unsubscribe()
  }, [])

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    const { error } = await supabase.auth.updateUser({ password })
    setLoading(false)
    if (error) {
      setErr(error.message)
      return
    }
    setMsg('密码已设置，正在进入后台…')
    setTimeout(() => navigate('/admin'), 800)
  }

  if (!ready) {
    return (
      <div className="auth-form">
        <p className="muted">请先通过邮件中的「重置密码」链接进入本页面。</p>
      </div>
    )
  }

  return (
    <div className="auth-form">
      <h2>设置新密码</h2>
      <form onSubmit={submit}>
        <input
          type="password"
          required
          placeholder="新密码（至少 6 位）"
          minLength={6}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
        <button type="submit" disabled={loading}>
          {loading ? '保存中…' : '保存新密码'}
        </button>
      </form>
      {msg && <p className="muted ok">{msg}</p>}
      {err && <p className="err">{err}</p>}
    </div>
  )
}
