import { useEffect, useRef, useState } from 'react'
import { supabase } from '../lib/supabase'
import { wgs84ToGcj02 } from '../lib/geo'
import { HOME, FLY_CITIES, arcPath, type LngLat } from '../lib/flylines'

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

const svgIcon = (svg: string) => 'data:image/svg+xml,' + encodeURIComponent(svg)

/** 访客足迹红点（内联 SVG，不依赖外部图片） */
const DOT_ICON = svgIcon(
  '<svg xmlns="http://www.w3.org/2000/svg" width="12" height="12">' +
    '<circle cx="6" cy="6" r="4.5" fill="#ef4444" fill-opacity="0.85" stroke="#ffffff" stroke-width="1.5"/>' +
    '</svg>',
)

/** 飞线落点：城市小圆点 */
const CITY_ICON = svgIcon(
  '<svg xmlns="http://www.w3.org/2000/svg" width="10" height="10">' +
    '<circle cx="5" cy="5" r="3" fill="#38bdf8" fill-opacity="0.9" stroke="#ffffff" stroke-width="1"/>' +
    '</svg>',
)

/** 飞线头部光点：小号半透明冷色点，不用白色实心点 */
const FLY_ICON = svgIcon(
  '<svg xmlns="http://www.w3.org/2000/svg" width="10" height="10">' +
    '<circle cx="5" cy="5" r="3.2" fill="#7dd3fc" fill-opacity="0.7"/>' +
    '</svg>',
)

/** 起飞 / 到达阶段的淡化光点，避免光点在深圳突然冒出来 */
const FLY_ICON_DIM = svgIcon(
  '<svg xmlns="http://www.w3.org/2000/svg" width="10" height="10">' +
    '<circle cx="5" cy="5" r="2.4" fill="#7dd3fc" fill-opacity="0.26"/>' +
    '</svg>',
)

/** 头像读取失败时的兜底 marker */
const ME_FALLBACK_ICON = svgIcon(
  '<svg xmlns="http://www.w3.org/2000/svg" width="44" height="44">' +
    '<circle cx="22" cy="22" r="18" fill="#3b82f6" stroke="#ffffff" stroke-width="3"/>' +
    '<text x="22" y="28" text-anchor="middle" font-size="16" fill="#ffffff">我</text>' +
    '</svg>',
)

/** 尾迹配色：统一冷色系 + 低透明度，避免彩色光点在地图上跳动 */
const TRAIL_COLORS = [
  'rgba(125,211,252,0.42)',
  'rgba(96,165,250,0.36)',
  'rgba(148,163,184,0.32)',
  'rgba(125,211,252,0.34)',
  'rgba(96,165,250,0.38)',
]

/** 把站点头像画成「圆形 + 白边 + 蓝色光晕」的 marker 图标（同域 canvas，不依赖外部图床） */
async function makeAvatarIcon(): Promise<string> {
  try {
    const img = new Image()
    img.src = '/avatar.png'
    await img.decode()
    const size = 88 // 2x 高清，显示时缩放为 44
    const canvas = document.createElement('canvas')
    canvas.width = canvas.height = size
    const ctx = canvas.getContext('2d')
    if (!ctx) return ME_FALLBACK_ICON
    const c = size / 2

    // 外圈光晕
    const glow = ctx.createRadialGradient(c, c, c * 0.62, c, c, c)
    glow.addColorStop(0, 'rgba(59,130,246,0.45)')
    glow.addColorStop(1, 'rgba(59,130,246,0)')
    ctx.fillStyle = glow
    ctx.beginPath()
    ctx.arc(c, c, c, 0, Math.PI * 2)
    ctx.fill()

    // 白色底圈
    ctx.beginPath()
    ctx.arc(c, c, c * 0.8, 0, Math.PI * 2)
    ctx.fillStyle = '#ffffff'
    ctx.fill()

    // 圆形裁剪 + cover 缩放（头像是竖版，取中心区域）
    const r = c * 0.7
    ctx.save()
    ctx.beginPath()
    ctx.arc(c, c, r, 0, Math.PI * 2)
    ctx.clip()
    const scale = Math.max((r * 2) / img.width, (r * 2) / img.height)
    const w = img.width * scale
    const h = img.height * scale
    ctx.drawImage(img, c - w / 2, c - h / 2, w, h)
    ctx.restore()

    // 蓝色描边
    ctx.beginPath()
    ctx.arc(c, c, r, 0, Math.PI * 2)
    ctx.lineWidth = 3
    ctx.strokeStyle = '#3b82f6'
    ctx.stroke()
    return canvas.toDataURL('image/png')
  } catch {
    return ME_FALLBACK_ICON
  }
}

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
 * 访客地图（弹窗内容）：腾讯地图上展示博主所在地头像、飞往全国主要城市的示意飞线，
 * 以及最近访客的城市散点。每次打开弹窗时挂载，关闭即卸载销毁地图与动画。
 * 未配置 VITE_TMAP_KEY 时渲染配置指引，不加载 SDK。
 */
export default function VisitorMap() {
  const mapElRef = useRef<HTMLDivElement>(null)
  const [pointCount, setPointCount] = useState<number | null>(null)
  const [mapFailed, setMapFailed] = useState(false)
  const hasKey = TMAP_KEY !== KEY_PLACEHOLDER

  // 初始化地图 + 飞线 + 头像 + 拉取散点
  useEffect(() => {
    if (!hasKey) return
    let cancelled = false
    let map: TMapMap = null
    let raf = 0
    const layers: any[] = []

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
        const latLng = (p: LngLat) => new TMap.LatLng(p.lat, p.lng)

        // 1) 静态弧线：深圳 → 全国主要城市
        const paths = FLY_CITIES.map((c) => arcPath(HOME, c))
        const staticLines = new TMap.MultiPolyline({
          map,
          styles: {
            line: new TMap.PolylineStyle({
              color: 'rgba(56,189,248,0.16)',
              width: 2,
              borderWidth: 0,
              lineCap: 'round',
            }),
          },
          geometries: paths.map((path, i) => ({
            id: `line-${i}`,
            styleId: 'line',
            paths: path.map(latLng),
          })),
        })
        layers.push(staticLines)

        // 2) 城市落点
        const cityDots = new TMap.MultiMarker({
          map,
          styles: {
            city: new TMap.MarkerStyle({
              width: 10,
              height: 10,
              src: CITY_ICON,
              anchor: { x: 5, y: 5 },
            }),
          },
          geometries: FLY_CITIES.map((c, i) => ({
            id: `city-${i}`,
            styleId: 'city',
            position: latLng(c),
          })),
        })
        layers.push(cityDots)

        // 3) 博主头像（深圳）
        const avatarSrc = await makeAvatarIcon()
        if (cancelled) return
        const meMarker = new TMap.MultiMarker({
          map,
          styles: {
            me: new TMap.MarkerStyle({
              width: 44,
              height: 44,
              src: avatarSrc,
              anchor: { x: 22, y: 22 },
            }),
          },
          geometries: [{ id: 'me', styleId: 'me', position: latLng(HOME) }],
        })
        layers.push(meMarker)

        // 4) 流动尾迹 + 飞行光点（低调模式：慢、淡、短，且同一时刻只有少量线在动）
        const trailStyles: Record<string, any> = {}
        TRAIL_COLORS.forEach((color, i) => {
          trailStyles[`trail-${i}`] = new TMap.PolylineStyle({
            color,
            width: 2,
            borderWidth: 0,
            lineCap: 'round',
          })
        })
        const trailLines = new TMap.MultiPolyline({
          map,
          styles: trailStyles,
          geometries: [],
        })
        const flyDots = new TMap.MultiMarker({
          map,
          styles: {
            fly: new TMap.MarkerStyle({
              width: 10,
              height: 10,
              src: FLY_ICON,
              anchor: { x: 5, y: 5 },
            }),
            'fly-dim': new TMap.MarkerStyle({
              width: 10,
              height: 10,
              src: FLY_ICON_DIM,
              anchor: { x: 5, y: 5 },
            }),
          },
          geometries: [],
        })
        layers.push(trailLines, flyDots)

        // 每条线只在自己周期的前 28% 时间飞行，其余时间休息。
        // 35 条线错开相位后，平均同一时刻约 10 个光点，不会整张地图一起闪。
        const ACTIVE_RATIO = 0.28
        let last = 0
        const tick = (ts: number) => {
          raf = requestAnimationFrame(tick)
          if (ts - last < 50) return // ~20fps
          last = ts
          const dots: any[] = []
          const trails: any[] = []
          paths.forEach((path, i) => {
            const cycle = (ts * (0.00011 + (i % 5) * 0.000012) + i * 0.137) % 1
            if (cycle > ACTIVE_RATIO) return
            const t = cycle / ACTIVE_RATIO
            const head = Math.min(path.length - 1, Math.floor(t * path.length))
            const tail = path.slice(Math.max(0, head - 4), head + 1)
            if (tail.length > 1) {
              trails.push({
                id: `trail-${i}`,
                styleId: `trail-${i % TRAIL_COLORS.length}`,
                paths: tail.map(latLng),
              })
            }
            // 首尾 18% 用淡化样式，光点不会在深圳突然出现 / 在终点突然消失
            const fade = Math.min(1, t / 0.18, (1 - t) / 0.18)
            dots.push({
              id: `fly-${i}`,
              styleId: fade < 0.55 ? 'fly-dim' : 'fly',
              position: latLng(path[head]),
            })
          })
          flyDots.setGeometries(dots)
          trailLines.setGeometries(trails)
        }
        raf = requestAnimationFrame(tick)

        // 5) 真实访客足迹（原有红点散点，保留）
        const { data, error } = await supabase
          .from('visitor_locations')
          .select('lat,lng,city,country')
          .order('created_at', { ascending: false })
          .limit(MAX_POINTS)
        if (cancelled) return
        if (error) {
          console.warn('访客足迹拉取失败（表可能还没建）：', error.message)
          setPointCount(0)
        } else {
          const points = (data ?? []) as VPoint[]
          setPointCount(points.length)
          if (points.length) {
            const visitorDots = new TMap.MultiMarker({
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
            layers.push(visitorDots)
          }
        }
      } catch (e) {
        if (!cancelled) {
          console.warn(e)
          setMapFailed(true)
        }
      }
    })()

    return () => {
      cancelled = true
      cancelAnimationFrame(raf)
      layers.forEach((l) => {
        try {
          l.setMap(null)
        } catch {
          /* 图层可能已随地图销毁 */
        }
      })
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
      <div className="vm-legend">
        <span>
          <i className="vm-lg vm-lg-me" />我 · {HOME.name}
        </span>
        <span>
          <i className="vm-lg vm-lg-city" />城市节点
        </span>
        <span>
          <i className="vm-lg vm-lg-visitor" />访客足迹
        </span>
        <span>飞线为示意，非真实行程</span>
      </div>
      <div className="vm-foot">
        <span>{pointCount === null ? '加载足迹中…' : `已记录 ${pointCount} 条足迹`}</span>
        <span>城市级精度 · 不记录 IP</span>
      </div>
    </>
  )
}
