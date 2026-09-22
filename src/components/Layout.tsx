import { Link } from 'react-router-dom'

export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <div className="container">
      <header className="site-header">
        <Link to="/" className="logo">我的博客</Link>
        <nav>
          <Link to="/">首页</Link>
          <Link to="/admin">后台</Link>
          <Link to="/login">登录</Link>
        </nav>
      </header>
      <main>{children}</main>
      <footer className="muted">© {new Date().getFullYear()} 我的博客</footer>
    </div>
  )
}
