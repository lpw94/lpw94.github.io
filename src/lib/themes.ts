/**
 * 3D 背景主题表。
 * 每个主题决定：粒子色相/饱和度/亮度范围、粒子尺寸、以及页面深空兜底底色（canvas 透明处透出）。
 * 内容区玻璃卡（.container）始终保持浅色，因此切换主题只改变背景氛围，不影响正文可读性。
 */
export interface BgTheme {
  id: string
  name: string
  /** 粒子色相范围（THREE.Color.setHSL 的 h，0~1，可超出 1 自动取模，用于跨色相环） */
  hue: [number, number]
  /** 饱和度 0~1 */
  sat: number
  /** 亮度范围 0~1 */
  light: [number, number]
  /** 粒子尺寸 */
  size: number
  /** body 深空兜底渐变（canvas 透明处透出） */
  bodyBg: string
}

export const THEMES: BgTheme[] = [
  {
    id: 'nebula',
    name: '深空星河',
    hue: [0.6, 0.78],
    sat: 0.7,
    light: [0.55, 0.75],
    size: 1.1,
    bodyBg:
      'radial-gradient(1200px 800px at 72% 8%, rgba(56,82,168,0.38), transparent 60%),' +
      'radial-gradient(1000px 720px at 12% 92%, rgba(120,52,160,0.32), transparent 60%),' +
      '#060912',
  },
  {
    id: 'aurora',
    name: '极光流光',
    hue: [0.3, 0.85],
    sat: 0.6,
    light: [0.6, 0.82],
    size: 1.4,
    bodyBg:
      'radial-gradient(1200px 800px at 70% 10%, rgba(46,160,120,0.34), transparent 60%),' +
      'radial-gradient(1000px 720px at 15% 90%, rgba(170,60,160,0.30), transparent 60%),' +
      '#04100c',
  },
  {
    id: 'cyber',
    name: '赛博网格',
    hue: [0.5, 0.55],
    sat: 0.9,
    light: [0.5, 0.72],
    size: 0.9,
    bodyBg:
      'radial-gradient(1200px 800px at 72% 8%, rgba(0,180,200,0.30), transparent 60%),' +
      'radial-gradient(1000px 720px at 12% 92%, rgba(0,90,160,0.28), transparent 60%),' +
      '#031018',
  },
  {
    id: 'sunset',
    name: '黄昏暖色',
    hue: [0.95, 1.08],
    sat: 0.8,
    light: [0.55, 0.74],
    size: 1.1,
    bodyBg:
      'radial-gradient(1200px 800px at 72% 8%, rgba(220,90,60,0.34), transparent 60%),' +
      'radial-gradient(1000px 720px at 12% 92%, rgba(180,40,120,0.30), transparent 60%),' +
      '#0e0710',
  },
]
