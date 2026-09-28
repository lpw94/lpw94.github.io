import { useEffect, useRef, useState } from 'react'
import { supabase } from '../lib/supabase'
import { wgs84ToGcj02 } from '../lib/geo'

// 腾讯地图 Key：请在腾讯位置服务开放平台（https://lbs.qq.com）申请，
// 本地写入 .env 的 VITE_TMAP_KEY，线上写入 GitHub Secrets 的 VITE_TMAP_KEY。
const KEY_PLACEHOLDER =
  'Please apply for your own key at the Tencent Location Service Open Platform and replace this placeholder'
const TMAP_KEY = (import.meta.env.VITE_TMAP_KEY as string | undefined) || KEY_PLACEHOLDER

/** 地图散点数量上限（只展示最近的足迹） */
const MAX_POINTS = 200

// TMap 是 CDN 注入的全局变量，这里只做最简类型声明
/* eslint-disable @typescript-eslint/no-explicit-any */
type TMapMap = any
const getTMap = () => (window as unknown as { TMap?: any }).TMap

/** 动态加载腾讯地图 GL JS SDK（带 key） */
function loadTMapSDK(key: string): Promise<void> {
  return new Promise((resolve, reject) => {
    if (getTMap()) return resolve()
    const s = document.createElement('script')
    s.src = `https://map.qq.com/api/gljs?v=1.exp&key=${encodeURIComponent(key)}`
    s.onload = () => resolve()
    s.onerror = () => reject(new Error('腾讯地图 SDK 加载失败'))
    document.head.appendChild(s)
  })
}

/** 红点 marker 图标（内联 SVG，不依赖外部图片） */
const DOT_ICON =
  'data:image/svg+xml,' +
  encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" width="12" height="12">' +
      '<circle cx="6" cy="6" r="4.5" fill="#ef4444" fill-opacity="0.85" stroke="#ffffff" stroke-width="1.5"/>' +
      '</svg>',
  )

/**
 * 上报一次访客粗略坐标（每天每浏览器最多一次）。
 * 合规：只存 IP 解析的城市级坐标（2 位小数 ≈ 1km），不存 IP、不存精确位置。
 * 所有失败都静默吞掉——这个功能只是彩蛋，绝不能影响主站。
 */
export async function recordVisitorLocation() {
  const today = new Date().toISOString().slice(0, 10)
  if (localStorage.getItem('vm_recorded') === today) return
  // 先落标记再发请求：StrictMode 双跑 / 请求失败都不会重复上报
  localStorage.setItem('vm_recorded', today)

  const res = await fetch('https://ipapi.co/json/')
  if (!res.ok) return
  const data = (await res.json()) as {
    latitude?: number
    longitude?: number
    city?: string
    country_name?: string
  }
  if (typeof data.latitude !== 'number' || typeof data.longitude !== 'number') return

  // WGS-84 → GCJ-02，再四舍五入到 2 位小数（约 1.1km），只保留城市级精度
  const [lng, lat] = wgs84ToGcj02(data.longitude, data.latitude)
  const { error } = await supabase.from('visitor_locations').insert({
    lat: Math.round(lat * 100) / 100,
    lng: Math.round(lng * 100) / 100,
    city: data.city ?? null,
    country: data.country_name ?? null,
  })
  if (error) console.warn('访客坐标上报失败（可忽略）：', error.message)
}

type VPoint = { lat: number; lng: number; city: string | null; country: string | null }

/**
 * 访客地图（弹窗内容）：腾讯地图散点展示最近访客的城市分布。
 * 每次打开弹窗时挂载本组件，关闭即卸载销毁地图。
 * 未配置 VITE_TMAP_KEY 时渲染配置指引，不加载 SDK。
 */
export default function VisitorMap() {
  const mapElRef = useRef<HTMLDivElement>(null)
  const [pointCount, setPointCount] = useState<number | null>(null)
  const [mapFailed, setMapFailed] = useState(false)
  const hasKey = TMAP_KEY !== KEY_PLACEHOLDER

  // 初始化地图 + 拉取散点
  useEffect(() => {
    if (!hasKey) return
    let cancelled = false
    let map: TMapMap = null

    ;(async () => {
      try {
        await loadTMapSDK(TMAP_KEY)
        if (cancelled || !mapElRef.current) return
        const TMap = getTMap()
        map = new TMap.Map(mapElRef.current, {
          center: new TMap.LatLng(35.5, 106),
          zoom: 3,
          viewMode: '2D',
        })

        const { data, error } = await supabase
          .from('visitor_locations')
          .select('lat,lng,city,country')
          .order('created_at', { ascending: false })
          .limit(MAX_POINTS)
        if (cancelled) return
        if (error) {
          console.warn('访客足迹拉取失败（表可能还没建）：', error.message)
          setPointCount(0)
          return
        }
        const points = (data ?? []) as VPoint[]
        setPointCount(points.length)
        if (!points.length) return

        new TMap.MultiMarker({
          map,
          styles: {
            dot: new TMap.MarkerStyle({
              width: 12,
              height: 12,
              src: DOT_ICON,
              anchor: { x: 6, y: 6 },
            }),
          },
          geometries: points.map((p, i) => ({
            id: String(i),
            styleId: 'dot',
            position: new TMap.LatLng(p.lat, p.lng),
          })),
        })
      } catch (e) {
        if (!cancelled) {
          console.warn(e)
          setMapFailed(true)
        }
      }
    })()

    return () => {
      cancelled = true
      map?.destroy()
    }
  }, [hasKey])

  if (!hasKey || mapFailed) {
    return (
      <p className="vm-note">
        {mapFailed
          ? '地图加载失败，请检查腾讯地图 Key 是否有效（Referer 白名单需包含本站域名）。'
          : '在腾讯位置服务开放平台申请 Key 并配置 VITE_TMAP_KEY 后，这里会展示访客城市分布。'}
      </p>
    )
  }

  return (
    <>
      <div className="vm-map" ref={mapElRef} />
      <div className="vm-foot">
        <span>{pointCount === null ? '加载足迹中…' : `已记录 ${pointCount} 条足迹`}</span>
        <span>城市级精度 · 不记录 IP</span>
      </div>
    </>
  )
}
