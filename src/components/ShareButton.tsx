import { useEffect, useRef, useState } from 'react'

// 与返回顶部一致：滚动超过该像素数才出现，避免一进页面就浮按钮
const SHOW_AFTER = 400

/**
 * 分享按钮：挂在 Layout 里，全站可用。点击弹出分享菜单，分享「当前页面」。
 * 移动端优先用系统原生分享（navigator.share，可直接调起微信/QQ 等），
 * 桌面端提供复制链接、微博、X、Facebook 等常用渠道。
 * 位置固定在右下角「返回顶部」按钮正下方。
 */
export default function ShareButton() {
  const [visible, setVisible] = useState(false)
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const onScroll = () => setVisible(window.scrollY > SHOW_AFTER)
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  // 点击菜单外部时关闭弹层
  useEffect(() => {
    if (!open) return
    const onDoc = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [open])

  if (!visible) return null

  const url = window.location.href
  const title = document.title

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(url)
      window.alert('链接已复制到剪贴板')
    } catch {
      // 不支持 clipboard API 时降级为手动选择
      window.prompt('复制链接：', url)
    }
    setOpen(false)
  }

  const nativeShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({ title, url })
      } catch {
        // 用户取消分享，忽略
      }
    } else {
      copyLink()
    }
    setOpen(false)
  }

  const shareTo = (target: 'weibo' | 'twitter' | 'facebook') => {
    const u = encodeURIComponent(url)
    const t = encodeURIComponent(title)
    const map = {
      weibo: `https://service.weibo.com/share/share.php?url=${u}&title=${t}`,
      twitter: `https://twitter.com/intent/tweet?url=${u}&text=${t}`,
      facebook: `https://www.facebook.com/sharer/sharer.php?u=${u}`,
    }
    window.open(map[target], '_blank', 'noopener,noreferrer')
    setOpen(false)
  }

  return (
    <div className="share-fab" ref={ref}>
      {open && (
        <div className="share-menu" role="menu" aria-label="分享到">
          <button type="button" className="share-item" role="menuitem" onClick={nativeShare}>
            <span aria-hidden="true">🔗</span> 系统分享…
          </button>
          <button type="button" className="share-item" role="menuitem" onClick={copyLink}>
            <span aria-hidden="true">📋</span> 复制链接
          </button>
          <button type="button" className="share-item" role="menuitem" onClick={() => shareTo('weibo')}>
            <span aria-hidden="true">🅦</span> 微博
          </button>
          <button type="button" className="share-item" role="menuitem" onClick={() => shareTo('twitter')}>
            <span aria-hidden="true">𝕏</span> X / Twitter
          </button>
          <button type="button" className="share-item" role="menuitem" onClick={() => shareTo('facebook')}>
            <span aria-hidden="true">📘</span> Facebook
          </button>
        </div>
      )}
      <button
        type="button"
        className="share-btn"
        onClick={() => setOpen((v) => !v)}
        aria-label="分享"
        aria-haspopup="menu"
        aria-expanded={open}
        title="分享"
      >
        <svg
          viewBox="0 0 24 24"
          width="20"
          height="20"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <circle cx="18" cy="5" r="3" />
          <circle cx="6" cy="12" r="3" />
          <circle cx="18" cy="19" r="3" />
          <line x1="8.59" y1="13.51" x2="15.42" y2="17.49" />
          <line x1="15.41" y1="6.51" x2="8.59" y2="10.49" />
        </svg>
      </button>
    </div>
  )
}
