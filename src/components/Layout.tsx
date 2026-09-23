import { useEffect, useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import type { User } from '@supabase/supabase-js'
import { supabase } from '../lib/supabase'
import ProfileCard from './ProfileCard'

export default function Layout({ children }: { children: React.ReactNode }) {
  const { pathname } = useLocation()
  const navigate = useNavigate()
  // 顶部栏右侧要显示当前登录邮箱，所以这里也要订阅会话状态
  const [user, setUser] = useState<User | null>(null)

  useEffect(() => {
    // 先用本地已有会话恢复一次（普通刷新 / 魔法链接回调后的场景）
    supabase.auth.getSession().then(({ data }) => setUser(data.session?.user ?? null))

    // 登录 / 退出时实时同步顶部栏
    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null)
    })

    return () => sub.subscription.unsubscribe()
  }, [])

  const logout = async () => {
    await supabase.auth.signOut()
    // 退出后如果正在后台页，回到首页，避免立刻又弹出登录窗
    if (pathname === '/admin') navigate('/')
  }

  // 简历页本身就是个人信息详情；文章详情页需要更宽的正文空间（代码块、图片、表格），
  // 信息栏也没有意义 —— 这几种页面都隐藏左侧栏
  const showProfile =
    pathname !== '/about' && !pathname.startsWith('/post/')

  return (
    <div className="container">
      <header className="site-header">
        <Link to="/" className="logo">WO的网络世界</Link>
        <nav>
          <Link to="/">首页</Link>
          <Link to="/about">简历</Link>
          <Link to="/admin">后台</Link>
          {user && (
            <span className="nav-user">
              <span className="nav-email" title={user.email ?? ''}>
                {user.email}
              </span>
              <button type="button" className="nav-logout" onClick={logout}>
                退出登录
              </button>
            </span>
          )}
        </nav>
      </header>
      <div className={`layout${showProfile ? '' : ' no-sidebar'}`}>
        {showProfile && <ProfileCard />}
        <main>{children}</main>
      </div>
      <footer className="muted">© {new Date().getFullYear()} woge博客</footer>
    </div>
  )
}
