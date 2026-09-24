import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

/**
 * 访客次数小组件。每次会话（sessionStorage 去重，避免 SPA 重复挂载 / 开发热重载重复计数）
 * 调一次 Supabase RPC `bump_visitors()` 原子自增全站计数器并返回最新值。
 * 若 RPC 尚未在 Supabase 部署（或网络异常），降级为 localStorage 计数，保证组件始终有数可显示。
 */
export default function VisitorWidget() {
  const [count, setCount] = useState<number | null>(null)

  useEffect(() => {
    const flag = 'v_counted'
    const already = sessionStorage.getItem(flag) === '1'

    // 降级到本地计数（仅在 RPC 不可用或返回异常时）
    const fallbackLocal = () => {
      const n = Number(localStorage.getItem('local_visits') || '0') + 1
      localStorage.setItem('local_visits', String(n))
      setCount(n)
    }

    // supabase.rpc() 返回的是 PromiseLike（只有 then，没有 catch），
    // 所以这里用 async/await + try/catch，而不是 .then().catch()（后者 tsc 会报 TS2339）。
    const fetchOrLocal = async () => {
      try {
        const { data, error } = await supabase.rpc('bump_visitors')
        if (error) {
          console.warn('访客计数（Supabase）不可用，已降级为本地计数：', error.message)
          fallbackLocal()
          return
        }
        const n = Number(data)
        if (!Number.isFinite(n)) {
          fallbackLocal()
          return
        }
        setCount(n)
      } catch {
        fallbackLocal()
      }
    }

    if (already) {
      // 本 session 已自增过：直接复用本地计数显示，避免重挂载闪烁成「—」
      const local = Number(localStorage.getItem('local_visits') || '0')
      if (local > 0) {
        setCount(local)
        return
      }
      // 本地无记录（例如从未走 fallback）仍拉一次真实值，保证有显示而不是「—」
      void fetchOrLocal()
      return
    }

    sessionStorage.setItem(flag, '1')
    void fetchOrLocal()
  }, [])

  return (
    <section className="widget-card visitor-widget" aria-label="访客次数">
      <div className="ww-title">📊 访客次数</div>
      <div className="visitor-num">
        {count === null ? '—' : count.toLocaleString('zh-CN')}
      </div>
      <p className="visitor-tip">感谢每一次的到访 ✨</p>
    </section>
  )
}
