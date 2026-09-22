import { useState } from 'react'
import { supabase } from '../lib/supabase'

export default function Login() {
  const [email, setEmail] = useState('')
  const [msg, setMsg] = useState('')

  const send = async (e: React.FormEvent) => {
    e.preventDefault()
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: window.location.origin + '/admin' },
    })
    setMsg(error ? error.message : '登录链接已发送到邮箱，请查收。')
  }

  return (
    <form className="auth-form" onSubmit={send}>
      <h2>后台登录</h2>
      <p className="muted">使用邮箱魔法链接登录，无需密码。</p>
      <input
        type="email"
        required
        placeholder="你的邮箱"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
      />
      <button type="submit">发送登录链接</button>
      {msg && <p className="muted">{msg}</p>}
    </form>
  )
}
