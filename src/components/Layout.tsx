import { Link, useLocation } from 'react-router-dom'
import ProfileCard from './ProfileCard'

export default function Layout({ children }: { children: React.ReactNode }) {
  // 简历页本身就是个人信息详情；文章详情页需要更宽的正文空间（代码块、图片、表格），
  // 登录页是纯表单，信息栏也没有意义 —— 这几种页面都隐藏左侧栏
  const { pathname } = useLocation()
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
          <Link to="/login">登录</Link>
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
