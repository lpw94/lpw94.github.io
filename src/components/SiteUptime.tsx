import { useEffect, useState } from 'react'

// 网站上线日期（取仓库首个提交日 2026-09-22），要改上线时间只动这里
const LAUNCH_AT = new Date('2026-09-22T00:00:00+08:00').getTime()

function elapsed() {
  const minutes = Math.max(0, Math.floor((Date.now() - LAUNCH_AT) / 60000))
  return {
    days: Math.floor(minutes / 1440),
    hours: Math.floor((minutes % 1440) / 60),
    mins: minutes % 60,
  }
}

/** 页面生命倒计时：显示网站上线至今运行的 天/小时/分钟 */
export default function SiteUptime() {
  const [t, setT] = useState(elapsed)

  useEffect(() => {
    // 分钟级精度，30s 刷一次足够（比 60s 更不容易卡在两分钟边界上）
    const timer = setInterval(() => setT(elapsed()), 30_000)
    return () => clearInterval(timer)
  }, [])

  return (
    <span className="site-uptime" title="上线于 2026-09-22">
      本站已运行 {t.days} 天 {t.hours} 小时 {t.mins} 分钟
    </span>
  )
}
