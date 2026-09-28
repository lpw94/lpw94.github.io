// 3D 个人展厅的项目数据。
// 想增删项目：直接改这个数组（当前 3D 房间最多展示前 5 个：后墙 3 + 左右墙各 1）。
// colors 是画框占位封面的渐变（起、止）；link / repo 缺省时弹窗会显示"企业内部项目"。
export type GalleryProject = {
  id: string
  title: string
  description: string
  tech: string[]
  /** 在线体验地址（可选） */
  link?: string
  /** 源码仓库地址（可选） */
  repo?: string
  colors: [string, string]
}

export const GALLERY_PROJECTS: GalleryProject[] = [
  {
    id: 'funeng',
    title: '富能智慧运维大屏',
    description:
      '富士康烟台工厂能源与设备监控大屏。负责能源与设备监控模块：首页 3D 地球园区视图、设备告警实时推送、四类能源（电/水/气/热）月度数据导入与趋势分析、楼栋负荷图表等。',
    tech: ['React 17', 'UmiJS 3', 'Three.js', 'ECharts', 'WebSocket'],
    colors: ['#1e3a8a', '#0891b2'],
  },
  {
    id: 'water',
    title: '智慧水务大屏',
    description:
      '广西科技大学智慧水务可视化大屏。Three.js 渲染 3D 地图与 FBX 模型、dva 全局拓扑状态管理，集成 AI 助手 ChatBot（Web Speech 语音输入、可拖拽悬浮按钮、桌面宠物式走跳动效）。',
    tech: ['React', 'Three.js', 'dva', 'Web Speech API'],
    colors: ['#0e7490', '#2563eb'],
  },
  {
    id: 'largscreen-demo',
    title: 'largscreen-demo 大屏',
    description:
      'React + TypeScript 大屏模板工程。完成 5120×1728 → 1920×1080 分辨率自适应（rem 转 px）、跳转链接免密登录（URL access_token 写入登录态）、React Intl 国际化语言包补齐。',
    tech: ['React', 'TypeScript', 'ECharts', 'React Intl'],
    colors: ['#7c3aed', '#db2777'],
  },
  {
    id: 'admin-web',
    title: 'admin-web 管理后台',
    description: '基于 Ant Design 的管理系统：组件库集成、权限路由（RBAC）系统设计。',
    tech: ['React', 'Ant Design', 'RBAC'],
    colors: ['#ea580c', '#eab308'],
  },
  {
    id: 'blog',
    title: '沃哥博客（本站）',
    description:
      'React 18 + Vite + Supabase 全栈个人博客：3D 星空背景多主题、富文本/Markdown 双编辑器、访客与文章浏览计数、悬浮音乐播放器、Konami 彩蛋、桌面宠物。',
    tech: ['React 18', 'Vite', 'Supabase', 'Three.js'],
    link: 'https://lpw94.github.io',
    colors: ['#059669', '#2563eb'],
  },
]
