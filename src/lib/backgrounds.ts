/**
 * 站点背景主题。
 *
 * 设计原则：全部是**静态 CSS 渐变**（无 canvas / 3D / 粒子动效），
 * 基调统一偏深——中间内容是玻璃拟态白卡 + 深色文字，浅背景会糊掉可读性。
 * 每个主题给两份值：
 * - `preview`：切换面板里 22px 小色块的渐变（尺寸小，可以更艳一点）
 * - `bg`：直接内联到 `.site-bg` 的完整 background 值
 */
export interface BgTheme {
  id: string
  name: string
  /** 切换面板预览色块 */
  preview: string
  /** `.site-bg` 的完整 background 值 */
  bg: string
}

/** 默认主题（原来的「午夜蓝」，也是老用户升级后的观感） */
export const DEFAULT_BG_ID = 'midnight'

export const BG_THEMES: BgTheme[] = [
  {
    id: 'midnight',
    name: '午夜蓝',
    preview: 'linear-gradient(135deg, #1d4ed8, #db2777)',
    bg: `radial-gradient(1200px 800px at 20% 20%, rgba(37, 99, 235, 0.42), transparent 60%),
      radial-gradient(1000px 700px at 85% 75%, rgba(236, 72, 153, 0.38), transparent 60%),
      linear-gradient(135deg, #0f172a 0%, #1e293b 45%, #0b1020 100%)`,
  },
  {
    id: 'ocean',
    name: '深海',
    preview: 'linear-gradient(135deg, #0e7490, #1e3a8a)',
    bg: `radial-gradient(1100px 760px at 15% 15%, rgba(6, 182, 212, 0.32), transparent 60%),
      radial-gradient(900px 700px at 88% 80%, rgba(30, 64, 175, 0.46), transparent 62%),
      linear-gradient(160deg, #041019 0%, #082032 52%, #030a12 100%)`,
  },
  {
    id: 'aurora',
    name: '极光',
    preview: 'linear-gradient(135deg, #10b981, #6366f1 55%, #38bdf8)',
    bg: `radial-gradient(900px 700px at 18% 18%, rgba(16, 185, 129, 0.30), transparent 60%),
      radial-gradient(900px 700px at 78% 26%, rgba(99, 102, 241, 0.34), transparent 60%),
      radial-gradient(820px 640px at 58% 88%, rgba(56, 189, 248, 0.24), transparent 62%),
      linear-gradient(150deg, #06110f 0%, #0a1a24 55%, #04080d 100%)`,
  },
  {
    id: 'sunset',
    name: '暮色',
    preview: 'linear-gradient(135deg, #f97316, #be123c 60%, #7c3aed)',
    bg: `radial-gradient(1000px 720px at 22% 16%, rgba(249, 115, 22, 0.28), transparent 60%),
      radial-gradient(1000px 720px at 82% 78%, rgba(190, 24, 93, 0.34), transparent 62%),
      linear-gradient(150deg, #150c14 0%, #241322 50%, #0b060f 100%)`,
  },
  {
    id: 'forest',
    name: '深林',
    preview: 'linear-gradient(135deg, #22c55e, #0f766e)',
    bg: `radial-gradient(1000px 720px at 16% 22%, rgba(34, 197, 94, 0.20), transparent 62%),
      radial-gradient(940px 700px at 84% 76%, rgba(20, 184, 166, 0.22), transparent 62%),
      linear-gradient(155deg, #07120e 0%, #0e2018 52%, #040a08 100%)`,
  },
  {
    id: 'sakura',
    name: '樱雾',
    preview: 'linear-gradient(135deg, #f472b6, #8b5cf6)',
    bg: `radial-gradient(1000px 720px at 24% 18%, rgba(244, 114, 182, 0.26), transparent 62%),
      radial-gradient(940px 700px at 80% 80%, rgba(139, 92, 246, 0.30), transparent 62%),
      linear-gradient(150deg, #130d18 0%, #221428 52%, #0a0710 100%)`,
  },
  {
    id: 'cyber',
    name: '赛博',
    preview: 'linear-gradient(135deg, #a855f7, #22d3ee)',
    bg: `radial-gradient(900px 700px at 12% 80%, rgba(168, 85, 247, 0.30), transparent 60%),
      radial-gradient(900px 700px at 88% 18%, rgba(34, 211, 238, 0.24), transparent 60%),
      linear-gradient(140deg, #0a0714 0%, #14102a 52%, #05040c 100%)`,
  },
  {
    id: 'graphite',
    name: '石墨',
    preview: 'linear-gradient(135deg, #64748b, #1e293b)',
    bg: `radial-gradient(1200px 800px at 30% 10%, rgba(148, 163, 184, 0.14), transparent 62%),
      radial-gradient(900px 700px at 80% 88%, rgba(100, 116, 139, 0.16), transparent 62%),
      linear-gradient(165deg, #121417 0%, #1b1f25 55%, #0a0c0f 100%)`,
  },
]
