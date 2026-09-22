import { useState } from 'react'
import { supabase } from '../lib/supabase'

// 魔法链接回跳地址：优先用构建时注入的正式域名（VITE_SITE_URL），
// 这样无论在本地(localhost)还是线上生成链接，回跳都指向生产站点 /admin，
// 避免误把 redirect_to 写成 http://localhost:3000 导致点链接后又弹回本地。
const SITE_URL = (import.meta.env.VITE_SITE_URL as string) || window.location.origin

export default function Login() {
  const [email, setEmail] = useState('lpw94@qq.com')
  const [msg, setMsg] = useState('')

  const send = async (e: React.FormEvent) => {
    e.preventDefault()
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: `${SITE_URL}/admin` },
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
