import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { supabase } from '../lib/supabase'
import VisitorMap, { recordVisitorLocation } from './VisitorMap'

/**
 * 访客次数小组件。每次会话（sessionStorage 去重，避免 SPA 重复挂载 / 开发热重载重复计数）
 * 调一次 Supabase RPC `bump_visitors()` 原子自增全站计数器并返回最新值。
 * 若 RPC 尚未在 Supabase 部署（或网络异常），降级为 localStorage 计数，保证组件始终有数可显示。
 * 点击数字弹出「访客地图」弹窗，展示访客城市分布散点。
 */
export default function VisitorWidget() {
  const [count, setCount] = useState<number | null>(null)
  const [mapOpen, setMapOpen] = useState(false)

  // 上报访客粗略坐标（每天每浏览器一次，与弹窗是否打开无关，先攒数据）
  useEffect(() => {
    recordVisitorLocation().catch(() => {})
  }, [])

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
        // 真实全局计数同步进 localStorage：本 session 内重挂载时直接显示它，
        // 不会退回 RPC 部署前攒下的本地旧值（曾经出现"7 变 1"的困惑）
        localStorage.setItem('local_visits', String(n))
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

  // 地图弹窗打开期间：锁背景滚动 + Esc 关闭
  useEffect(() => {
    if (!mapOpen) return
    const prevOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setMapOpen(false)
    }
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.body.style.overflow = prevOverflow
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [mapOpen])

  return (
    <section className="widget-card visitor-widget" aria-label="访客次数">
      <div className="ww-title">📊 访客次数</div>
      <button
        type="button"
        className="visitor-num visitor-num-btn"
        onClick={() => setMapOpen(true)}
        title="点击查看访客地图"
        aria-haspopup="dialog"
      >
        {count === null ? '—' : count.toLocaleString('zh-CN')}
      </button>
      <p className="visitor-tip">点击数字查看访客地图 🗺️</p>

      {mapOpen &&
        createPortal(
          <div
            className="modal-backdrop"
            onMouseDown={(e) => {
              // 只有点到遮罩本身才关闭，点弹窗内部不关
              if (e.target === e.currentTarget) setMapOpen(false)
            }}
          >
            <div
              className="modal visitor-map-modal"
              role="dialog"
              aria-modal="true"
              aria-labelledby="visitor-map-title"
            >
              <div className="modal-head">
                <h2 id="visitor-map-title">🗺️ 访客地图</h2>
                <button
                  type="button"
                  className="modal-close"
                  onClick={() => setMapOpen(false)}
                  aria-label="关闭"
                >
                  ×
                </button>
              </div>
              <VisitorMap />
            </div>
          </div>,
          document.body,
        )}
    </section>
  )
}
