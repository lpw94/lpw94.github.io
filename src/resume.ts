// 简历页数据：改这个文件即可更新页面，不需要动组件。
// 头像优先用 /head.png，没有该文件时会自动回退到 avatarFallback，再失败则显示 initials 文字。
export type Stat = { label: string; value: number; suffix: string }
export type InfoItem = { label: string; value: string }
export type Skill = { name: string; value: number }
// 项目经验：points 里写「做了什么 + 解决什么问题」，比罗列技术栈更有说服力
export type Project = { name: string; role: string; stack: string[]; points: string[] }

// 技能单独抽出来，好让「掌握技能」这个统计项直接取 skills.length，
// 以后增删技能不用再手动改数字（以前写死 11，加完条目就会对不上）。
const skills: Skill[] = [
  // 前端
  { name: 'HTML5 + CSS3', value: 95 },
  { name: 'JavaScript (ES6+)', value: 92 },
  { name: 'React / React Hooks', value: 92 },
  { name: 'Vue', value: 90 },
  { name: 'TypeScript', value: 88 },
  { name: 'UI 组件库（Ant Design / Element）', value: 86 },
  { name: '状态管理（Redux / dva / Pinia）', value: 85 },
  { name: '数据可视化（ECharts / Three.js）', value: 82 },
  // 跨端 / 桌面端
  { name: 'uni-app 跨端（H5 / 小程序 / App）', value: 78 },
  { name: 'Electron 桌面端（大屏 / 工具类应用）', value: 80 },
  { name: '微信小程序', value: 76 },
  // 服务端 / 全栈
  { name: 'Node.js 服务端（Express / NestJS）', value: 84 },
  { name: 'Python 全栈（FastAPI / Django / 脚本自动化）', value: 78 },
  { name: '数据库（PostgreSQL / Supabase / MySQL）', value: 80 },
  // AI 与工程化
  { name: 'AI 应用开发（大模型 API / Prompt / RAG）', value: 78 },
  { name: '前端工程化（Vite / Webpack / UmiJS）', value: 80 },
  { name: '部署运维（Docker / Nginx / CI-CD）', value: 76 },
  { name: 'Angular', value: 75 },
]

export const resume = {
  name: 'woge',
  /** 顶部打字机逐字显示的职位描述 */
  role: 'Web 全栈研发工程师 · 广东深圳 · 热爱折腾的技术人',
  // 头像加载失败会依次回退到 avatarFallback，再失败则显示 initials 文字
  avatar: '/avatar.png',
  avatarFallback: '/avatar.svg',
  initials: 'WO',

  email: 'lpw9494@gmail.com',
  location: '广东深圳',
  github: 'https://github.com/lpw94',

  stats: [
    { label: '前端经验', value: 20, suffix: '年' },
    { label: '参与项目', value: 20, suffix: '+' },
    { label: '技术文章', value: 30, suffix: '+' },
    { label: '掌握技能', value: skills.length, suffix: '项' },
  ] as Stat[],

  info: [
    { label: '姓名', value: '沃哥' },
    { label: '邮箱', value: 'lpw9494@gmail.com' },
    { label: '电话', value: '13058165962' },
    { label: '地址', value: '广东深圳' },
  ] as InfoItem[],

  intents: [
    { label: '求职类型', value: '全职/日结' },
    { label: '意向岗位', value: '全栈工程师' },
    { label: '意向城市', value: '全国可空降' },
    { label: '薪资要求', value: '3000' },
    { label: '求职状态', value: '随时到岗' },
  ] as InfoItem[],

  traits: ['独立解决问题', '团队协作', '责任心强', '学习能力', '探索精神', '沟通表达'],

  // 由新到旧排列
  projects: [
    {
      name: '富能智慧运维大屏（富士康烟台工厂）',
      role: '前端负责人 · 全栈开发',
      stack: ['React 17', 'UmiJS 3', 'TypeScript', 'Ant Design', 'ECharts', 'Three.js', 'Electron'],
      points: [
        '承担能源与设备监控两条主线，落地首页、楼宇、设备、视频、工单等大屏模块',
        '统一 park（areaIds）与 product（organizationIds）两套数据口径，收敛 meterAttrIds、codeAreaMap 等参数来源，消除维度切换时的数据错位',
        '用 Node.js 定时任务 + Excel 导入打通电量、水量、天然气、热力四类能源数据入库，替代人工统计',
        'Electron 封装桌面端并集成 Three.js 园区三维视图，保障大屏长时间驻留稳定运行',
      ],
    },
    {
      name: '广西科技大学智慧水务大屏 · ChatBot',
      role: '前端开发',
      stack: ['Vue', '语音识别', 'CSS 动画'],
      points: [
        '实现语音输入与可拖拽悬浮入口，用固定尺寸垂直居中布局保证多分辨率下按钮位置一致',
        '弹窗始终定位在悬浮按钮上方、隐藏滚动条，并加入桌面宠物走动与蹦跳动效',
      ],
    },
    {
      name: '个人技术博客（本站）',
      role: '全栈开发 · 独立完成',
      stack: ['React 18', 'Vite', 'TypeScript', 'Supabase', 'GitHub Actions'],
      points: [
        'Supabase 承载文章与业务数据，RLS 区分匿名只读与登录可写，私有记事本仅本人可见',
        '构建期从数据库拉取已发布文章生成 RSS / Sitemap 与 SEO 元信息，推 main 自动部署',
        '自研算术题锁屏、8 套主题背景、3D 展厅与内置小游戏等体验向功能',
      ],
    },
    {
      name: '后台管理系统 · 权限路由',
      role: '前端开发',
      stack: ['React', 'React Router', 'TypeScript'],
      points: [
        '手写请求拦截器与刷新锁，解决 token 过期时并发请求重复刷新的问题',
        '按后端菜单动态生成路由，实现路由级与按钮级权限校验',
      ],
    },
    {
      name: '大屏分辨率适配 Demo',
      role: '前端开发',
      stack: ['React', 'rem 适配', 'React Intl'],
      points: [
        '把 5120×1728 设计稿适配到 1920×1080 等常见分辨率，rem 统一换算落地',
        '从 URL 读取 access_token 实现免密登录，补全中文国际化文案',
      ],
    },
  ] as Project[],

  intro:
    '能独立承担前端、Node.js 与 Python 服务端的完整开发，并把大模型能力（Prompt / RAG）落地到实际业务中；具备独立分析和解决问题的能力；有较好的团队协作和沟通能力，有强烈的责任心；具有良好的沟通表达、团队协作能力，有较强的学习能力和探索精神，责任心强。',

  skills,
}
