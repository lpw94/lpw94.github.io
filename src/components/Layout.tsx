import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import type { User } from '@supabase/supabase-js'
import { supabase } from '../lib/supabase'
import ProfileCard from './ProfileCard'
import CursorFX from './CursorFX'
import TimeWidget from './TimeWidget'
import FortuneWidget from './FortuneWidget'
import GameCenter from './GameCenter'
import AdSlot from './AdSlot'
import DonateWidget from './DonateWidget'
// import KonamiCode from './KonamiCode'
import VisitorWidget from './VisitorWidget'
import SiteUptime from './SiteUptime'
import MusicPlayer from './MusicPlayer'
import BackToTop from './BackToTop'
import ShareButton from './ShareButton'
import SearchBox from './SearchBox'
import LockScreen from './LockScreen'
import { BG_THEMES, DEFAULT_BG_ID } from '../lib/backgrounds'

export default function Layout({ children }: { children: React.ReactNode }) {
  const { pathname } = useLocation()
  const navigate = useNavigate()
  // 顶部栏右侧要显示当前登录邮箱，所以这里也要订阅会话状态
  const [user, setUser] = useState<User | null>(null)
  /** 邮箱下拉菜单是否展开 */
  const [menuOpen, setMenuOpen] = useState(false)
  /** 退出登录的二次确认弹窗 */
  const [confirmOpen, setConfirmOpen] = useState(false)
  /** 首页锁屏遮罩是否显示 */
  const [locked, setLocked] = useState(false)
  /** 背景风格：从 localStorage 恢复，非法值（主题被删/篡改）回落到默认 */
  const [bgId, setBgId] = useState<string>(() => {
    const saved = localStorage.getItem('bg-theme')
    return BG_THEMES.some((t) => t.id === saved) ? (saved as string) : DEFAULT_BG_ID
  })
  /** 背景风格面板是否展开 */
  const [bgOpen, setBgOpen] = useState(false)
  // 用于判断点击是否落在下拉外部（点击别处自动收起）
  const menuRef = useRef<HTMLDivElement>(null)
  const bgRef = useRef<HTMLDivElement>(null)

  const bgTheme = BG_THEMES.find((t) => t.id === bgId) ?? BG_THEMES[0]

  // 其它标签页切换主题时同步过来（避免同一个站两个标签观感不一致）
  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key !== 'bg-theme' || !e.newValue) return
      if (BG_THEMES.some((t) => t.id === e.newValue)) setBgId(e.newValue)
    }
    window.addEventListener('storage', onStorage)
    return () => window.removeEventListener('storage', onStorage)
  }, [])

  // 背景面板展开期间：点击外部 / 按 Esc 收起
  useEffect(() => {
    if (!bgOpen) return
    const onPointerDown = (e: MouseEvent) => {
      if (!bgRef.current?.contains(e.target as Node)) setBgOpen(false)
    }
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setBgOpen(false)
    }
    document.addEventListener('mousedown', onPointerDown)
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('mousedown', onPointerDown)
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [bgOpen])

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

  // 首页首次进入（按会话）自动弹一次锁屏遮罩；顶部按钮可随时再次唤起
  useEffect(() => {
    if (pathname === '/' && !sessionStorage.getItem('lock-screen-seen')) {
      setLocked(true)
      sessionStorage.setItem('lock-screen-seen', '1')
    }
  }, [pathname])

  // 首页 2 分钟无操作（鼠标 / 键盘 / 滚动 / 触摸）自动锁屏；解锁后重新计时
  useEffect(() => {
    if (pathname !== '/') return
    const IDLE_MS = 2 * 60 * 1000
    let timer: number
    const arm = () => {
      clearTimeout(timer)
      // 已锁屏时不再重复挂定时器（避免解锁前反复触发）
      if (!locked) timer = window.setTimeout(() => setLocked(true), IDLE_MS)
    }
    const events = ['mousemove', 'mousedown', 'keydown', 'scroll', 'touchstart', 'wheel']
    events.forEach((e) => window.addEventListener(e, arm, { passive: true }))
    arm()
    return () => {
      clearTimeout(timer)
      events.forEach((e) => window.removeEventListener(e, arm))
    }
  }, [pathname, locked])

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
    <>
      {/* 静态渐变背景层：风格由顶栏 🎨 切换，key 变化触发淡入过渡 */}
      <div className="site-bg" key={bgId} style={{ background: bgTheme.bg }} aria-hidden="true" />
      <CursorFX />
      <MusicPlayer />
      <BackToTop />
      <ShareButton />
      <header className="site-header">
        <Link to="/" className="logo">个人博客</Link>
        <SearchBox />
        <nav>
          <Link to="/">首页</Link>
          <Link to="/gallery">展厅</Link>
          <Link to="/toolbox">工具箱</Link>
          {/* 书签已合并进「导航」（/tools）：静态工具 + DB 书签同一个页面、同一套功能 */}
          <Link to="/tools">导航</Link>
          {/* 记事本是私密内容：入口仅登录后可见，未登录直接访问 /notes 也会被登录墙拦住 */}
          {user && <Link to="/notes">记事本</Link>}
          {/* <Link to="/tools">工具</Link> */}
          {/* <Link to="/about">简历</Link> */}
          <Link to="/admin">后台</Link>
          <div className="bg-picker" ref={bgRef}>
            <button
              type="button"
              className={`lock-btn bg-btn${bgOpen ? ' active' : ''}`}
              onClick={() => setBgOpen((v) => !v)}
              title="切换背景风格"
              aria-label="切换背景风格"
              aria-haspopup="menu"
              aria-expanded={bgOpen}
            >
              🎨
            </button>
            {bgOpen && (
              <div className="bg-panel" role="menu" aria-label="背景风格">
                <div className="bg-panel-head">背景风格</div>
                <div className="bg-grid">
                  {BG_THEMES.map((t) => (
                    <button
                      key={t.id}
                      type="button"
                      role="menuitemradio"
                      aria-checked={t.id === bgId}
                      className={`bg-opt${t.id === bgId ? ' active' : ''}`}
                      title={t.name}
                      onClick={() => {
                        setBgId(t.id)
                        localStorage.setItem('bg-theme', t.id)
                        setBgOpen(false)
                      }}
                    >
                      <span className="bg-swatch" style={{ background: t.preview }} aria-hidden="true" />
                      <span className="bg-name">{t.name}</span>
                    </button>
                  ))}
                </div>
                <div className="bg-panel-foot">
                  <span>选择会记住，全站生效</span>
                  <button
                    type="button"
                    className="bg-shuffle"
                    onClick={() => {
                      // 随机换一套：排除当前这套，避免「点了没变化」
                      const pool = BG_THEMES.filter((t) => t.id !== bgId)
                      const next = pool[Math.floor(Math.random() * pool.length)]
                      setBgId(next.id)
                      localStorage.setItem('bg-theme', next.id)
                    }}
                  >
                    🎲 随机
                  </button>
                </div>
              </div>
            )}
          </div>
          <button
            type="button"
            className="lock-btn"
            onClick={() => {
              if (pathname !== '/') navigate('/')
              setLocked(true)
            }}
            title="锁屏遮罩：显示首页锁屏"
            aria-label="显示锁屏遮罩"
          >
            🔒
          </button>
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
      <div className="page-shell">
      {showProfile && (
        <aside className="sidebar sidebar-left">
          <ProfileCard />
          {/* <KonamiCode /> */}
          <DonateWidget />
          {/* <AdSlot /> */}
        </aside>
      )}
      <div className={`container${showProfile ? ' has-sidebars' : ''}`}>
      <div className="layout">
        <main>{children}</main>
      </div>
      <footer className="muted">
        <div>© {new Date().getFullYear()} woge博客</div>
        <SiteUptime />
      </footer>

      {confirmOpen &&
        createPortal(
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
        </div>,
          document.body,
        )}
    </div>
      {showProfile && (
        <aside className="sidebar sidebar-right">
          <TimeWidget />
          <VisitorWidget />
          <FortuneWidget />
          <GameCenter />
        </aside>
      )}
      </div>
      {/* 首页锁屏遮罩：答对随机算术题才解锁；顶部 🔒 按钮可再次唤起 */}
      {locked && pathname === '/' && <LockScreen onUnlock={() => setLocked(false)} />}
    </>
  )
}
