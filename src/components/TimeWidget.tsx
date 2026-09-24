import { useEffect, useState } from 'react'

const WEEK = ['日', '一', '二', '三', '四', '五', '六']

function greeting(h: number) {
  if (h < 5) return '夜深了'
  if (h < 11) return '早上好'
  if (h < 13) return '中午好'
  if (h < 18) return '下午好'
  if (h < 23) return '晚上好'
  return '夜深了'
}

const pad = (n: number) => n.toString().padStart(2, '0')

export default function TimeWidget() {
  const [now, setNow] = useState(() => new Date())

  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000)
    return () => clearInterval(t)
  }, [])

  const h = now.getHours()
  return (
    <section className="widget-card time-widget" aria-label="当前时间">
      <div className="tw-greet">{greeting(h)}</div>
      <div className="tw-clock">{pad(h)}:{pad(now.getMinutes())}:{pad(now.getSeconds())}</div>
      <div className="tw-date">
        {now.getFullYear()} 年 {now.getMonth() + 1} 月 {now.getDate()} 日 · 星期{WEEK[now.getDay()]}
      </div>
    </section>
  )
}
