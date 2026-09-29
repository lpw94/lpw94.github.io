import { useEffect, useState } from 'react'

// 滚动超过该像素数才显示按钮，避免一进页面就浮个箭头
const SHOW_AFTER = 400

/**
 * 返回顶部：滚动一定距离后出现，点击平滑滚回页面顶部。
 * 挂在 Layout 里，全站（含首页）任意长页面都可用。
 */
export default function BackToTop() {
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    const onScroll = () => setVisible(window.scrollY > SHOW_AFTER)
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  if (!visible) return null

  const toTop = () => {
    const reduce =
      typeof window.matchMedia === 'function' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches
    window.scrollTo({ top: 0, behavior: reduce ? 'auto' : 'smooth' })
  }

  return (
    <button
      type="button"
      className="back-to-top"
      onClick={toTop}
      aria-label="返回顶部"
      title="返回顶部"
    >
      ↑
    </button>
  )
}
