import { useEffect, useRef, useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import type { User } from '@supabase/supabase-js'
import { supabase } from '../lib/supabase'
import ProfileCard from './ProfileCard'

export default function Layout({ children }: { children: React.ReactNode }) {
  const { pathname } = useLocation()
  const navigate = useNavigate()
  // 顶部栏右侧要显示当前登录邮箱，所以这里也要订阅会话状态
  const [user, setUser] = useState<User | null>(null)
  /** 邮箱下拉菜单是否展开 */
  const [menuOpen, setMenuOpen] = useState(false)
  /** 退出登录的二次确认弹窗 */
  const [confirmOpen, setConfirmOpen] = useState(false)
  // 用于判断点击是否落在下拉外部（点击别处自动收起）
  const menuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    // 先用本地已有会话恢复一次（普通刷新 / 魔法链接回调后的场景）
    supabase.auth.getSession().then(({ data }) => setUser(data.session?.user ?? null))

    // 登录 / 退出时实时同步顶部栏
    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null)
    })

    return () => sub.subscription.unsubscribe()
  }, [])

  // 未登录（含刚退出）时收起下拉与确认框，避免残留
  useEffect(() => {
    if (!user) {
      setMenuOpen(false)
      setConfirmOpen(false)
    }
  }, [user])

  // 下拉展开期间：点击外部 / 按 Esc 收起
  useEffect(() => {
    if (!menuOpen) return
    const onPointerDown = (e: MouseEvent) => {
      if (!menuRef.current?.contains(e.target as Node)) setMenuOpen(false)
    }
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setMenuOpen(false)
    }
    document.addEventListener('mousedown', onPointerDown)
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('mousedown', onPointerDown)
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [menuOpen])

  // 确认弹窗打开期间：锁背景滚动 + Esc 取消
  useEffect(() => {
    if (!confirmOpen) return
    const prevOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setConfirmOpen(false)
    }
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.body.style.overflow = prevOverflow
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [confirmOpen])

  // 真正执行退出：先关掉所有浮层，再清会话
  const confirmLogout = async () => {
    setConfirmOpen(false)
    setMenuOpen(false)
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
        <Link to="/" className="logo">个人博客</Link>
        <nav>
          <Link to="/">首页</Link>
          <Link to="/about">简历</Link>
          <Link to="/admin">后台</Link>
          {user && (
            <div className="nav-user" ref={menuRef}>
              {/* 邮箱本身是下拉触发器，退出登录收进菜单里 */}
              <button
                type="button"
                className={`nav-trigger${menuOpen ? ' open' : ''}`}
                onClick={() => setMenuOpen((v) => !v)}
                aria-haspopup="menu"
                aria-expanded={menuOpen}
                title={user.email ?? ''}
              >
                <span className="nav-email">{user.email}</span>
                <span className="nav-caret" aria-hidden="true">▾</span>
              </button>
              {menuOpen && (
                <div className="nav-menu" role="menu">
                  {/* 触发器里的邮箱可能被截断，菜单里显示完整值 */}
                  <div className="nav-menu-head" title={user.email ?? ''}>
                    {user.email}
                  </div>
                  <button
                    type="button"
                    role="menuitem"
                    className="nav-menu-item danger"
                    onClick={() => {
                      setMenuOpen(false)
                      setConfirmOpen(true)
                    }}
                  >
                    退出登录
                  </button>
                </div>
              )}
            </div>
          )}
        </nav>
      </header>
      <div className={`layout${showProfile ? '' : ' no-sidebar'}`}>
        {showProfile && <ProfileCard />}
        <main>{children}</main>
      </div>
      <footer className="muted">© {new Date().getFullYear()} woge博客</footer>

      {confirmOpen && (
        <div
          className="modal-backdrop"
          onMouseDown={(e) => {
            // 只有点到遮罩本身才关闭，点弹窗内部不关
            if (e.target === e.currentTarget) setConfirmOpen(false)
          }}
        >
          <div
            className="modal confirm-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="logout-confirm-title"
          >
            <div className="modal-head">
              <h2 id="logout-confirm-title">退出登录</h2>
              <button
                type="button"
                className="modal-close"
                onClick={() => setConfirmOpen(false)}
                aria-label="关闭"
              >
                ×
              </button>
            </div>
            <p className="confirm-text">确定要退出当前账号吗？退出后需要重新登录才能进入后台。</p>
            <div className="confirm-actions">
              <button type="button" className="btn-ghost" onClick={() => setConfirmOpen(false)}>
                取消
              </button>
              <button type="button" className="btn-danger" onClick={confirmLogout} autoFocus>
                确定退出
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
