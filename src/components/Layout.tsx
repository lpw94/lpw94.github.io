import { Link, useLocation } from 'react-router-dom'
import ProfileCard from './ProfileCard'

export default function Layout({ children }: { children: React.ReactNode }) {
  // 简历页本身就是个人信息详情，隐藏左侧栏避免内容重复、布局被挤压
  const { pathname } = useLocation()
  const showProfile = pathname !== '/about'

  return (
    <div className="container">
      <header className="site-header">
        <Link to="/" className="logo">我的博客</Link>
        <nav>
          <Link to="/">首页</Link>
          <Link to="/about">关于</Link>
          <Link to="/admin">后台</Link>
          <Link to="/login">登录</Link>
        </nav>
      </header>
      <div className={`layout${showProfile ? '' : ' no-sidebar'}`}>
        {showProfile && <ProfileCard />}
        <main>{children}</main>
      </div>
      <footer className="muted">© {new Date().getFullYear()} 我的博客</footer>
    </div>
  )
}
