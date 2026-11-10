/**
 * 访客地图的「飞线」装饰数据。
 * 坐标均为 GCJ-02（腾讯地图直接使用），只取大陆省级行政中心的公开近似坐标，
 * 用于从博主所在地发散的示意弧线，不代表任何真实行程、也不含敏感位置。
 */

export const HOME = { name: '深圳', lat: 22.54, lng: 114.06 }

export type LngLat = { lng: number; lat: number }

/** 全国主要城市（大陆 31 个省级行政中心 + 几个热点城市） */
export const FLY_CITIES: (LngLat & { name: string })[] = [
  { name: '北京', lat: 39.9, lng: 116.4 },
  { name: '天津', lat: 39.08, lng: 117.2 },
  { name: '上海', lat: 31.23, lng: 121.47 },
  { name: '重庆', lat: 29.56, lng: 106.55 },
  { name: '石家庄', lat: 38.04, lng: 114.51 },
  { name: '太原', lat: 37.87, lng: 112.55 },
  { name: '呼和浩特', lat: 40.84, lng: 111.75 },
  { name: '沈阳', lat: 41.8, lng: 123.43 },
  { name: '长春', lat: 43.9, lng: 125.32 },
  { name: '哈尔滨', lat: 45.76, lng: 126.63 },
  { name: '南京', lat: 32.06, lng: 118.8 },
  { name: '杭州', lat: 30.28, lng: 120.15 },
  { name: '合肥', lat: 31.86, lng: 117.28 },
  { name: '福州', lat: 26.08, lng: 119.3 },
  { name: '南昌', lat: 28.68, lng: 115.86 },
  { name: '济南', lat: 36.65, lng: 117.0 },
  { name: '郑州', lat: 34.75, lng: 113.62 },
  { name: '武汉', lat: 30.59, lng: 114.3 },
  { name: '长沙', lat: 28.23, lng: 112.94 },
  { name: '广州', lat: 23.13, lng: 113.26 },
  { name: '南宁', lat: 22.82, lng: 108.37 },
  { name: '海口', lat: 20.04, lng: 110.2 },
  { name: '成都', lat: 30.67, lng: 104.07 },
  { name: '贵阳', lat: 26.65, lng: 106.63 },
  { name: '昆明', lat: 25.04, lng: 102.71 },
  { name: '拉萨', lat: 29.66, lng: 91.13 },
  { name: '西安', lat: 34.27, lng: 108.95 },
  { name: '兰州', lat: 36.06, lng: 103.83 },
  { name: '西宁', lat: 36.62, lng: 101.78 },
  { name: '银川', lat: 38.47, lng: 106.28 },
  { name: '乌鲁木齐', lat: 43.82, lng: 87.62 },
  { name: '青岛', lat: 36.07, lng: 120.38 },
  { name: '厦门', lat: 24.48, lng: 118.09 },
  { name: '苏州', lat: 31.3, lng: 120.62 },
  { name: '大连', lat: 38.92, lng: 121.62 },
]

/**
 * 二次贝塞尔弧线：起点 → 终点，控制点在中点沿垂直方向偏移，
 * 距离越远弧度越明显。返回 seg+1 个经纬度点，供 MultiPolyline 直接绘制。
 */
export function arcPath(from: LngLat, to: LngLat, seg = 36, bend = 0.16): LngLat[] {
  const dx = to.lng - from.lng
  const dy = to.lat - from.lat
  const cx = (from.lng + to.lng) / 2 - dy * bend
  const cy = (from.lat + to.lat) / 2 + dx * bend
  const pts: LngLat[] = []
  for (let i = 0; i <= seg; i++) {
    const t = i / seg
    const u = 1 - t
    pts.push({
      lng: u * u * from.lng + 2 * u * t * cx + t * t * to.lng,
      lat: u * u * from.lat + 2 * u * t * cy + t * t * to.lat,
    })
  }
  return pts
}
