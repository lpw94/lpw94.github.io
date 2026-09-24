// 简历页数据：改这个文件即可更新页面，不需要动组件。
// 头像优先用 /head.png，没有该文件时会自动回退到 avatarFallback，再失败则显示 initials 文字。
export type Stat = { label: string; value: number; suffix: string }
export type InfoItem = { label: string; value: string }
export type Skill = { name: string; value: number }

export const resume = {
  name: 'woge',
  /** 顶部打字机逐字显示的职位描述 */
  role: 'Web 前端研发工程师 · 广东深圳 · 热爱折腾的技术人',
  // 头像加载失败会依次回退到 avatarFallback，再失败则显示 initials 文字
  avatar: '/avatar.png',
  avatarFallback: '/avatar.svg',
  initials: 'WO',

  email: 'lpw9494@gmail.com',
  location: '广东深圳',
  github: 'https://github.com/lpw94',

  stats: [
    { label: '前端经验', value: 5, suffix: '年' },
    { label: '参与项目', value: 20, suffix: '+' },
    { label: '技术文章', value: 30, suffix: '+' },
    { label: '掌握技能', value: 11, suffix: '项' },
  ] as Stat[],

  info: [
    { label: '姓名', value: '沃哥' },
    { label: '邮箱', value: 'lpw9494@gmail.com' },
    { label: '电话', value: '13058165962' },
    { label: '地址', value: '广东深圳' },
  ] as InfoItem[],

  intents: [
    { label: '求职类型', value: '全职' },
    { label: '意向岗位', value: 'Web 前端研发工程师' },
    { label: '意向城市', value: '广东深圳' },
    { label: '薪资要求', value: '20K' },
    { label: '求职状态', value: '随时到岗' },
  ] as InfoItem[],

  traits: ['独立解决问题', '团队协作', '责任心强', '学习能力', '探索精神', '沟通表达'],

  intro:
    '具备独立分析和解决问题的能力；有较好的团队协作和沟通能力，有强烈的责任心；具有良好的沟通表达、团队协作能力，有较强的学习能力和探索精神，责任心强。',

  skills: [
    { name: 'HTML5 + CSS3', value: 95 },
    { name: 'JavaScript (ES6+)', value: 92 },
    { name: 'React / React Hooks', value: 92 },
    { name: 'Vue', value: 90 },
    { name: 'TypeScript', value: 88 },
    { name: 'UI 组件库（Ant Design / Element）', value: 86 },
    { name: '状态管理（Redux / dva / Pinia）', value: 85 },
    { name: '数据可视化（ECharts / Three.js）', value: 82 },
    { name: '前端工程化（Vite / Webpack / UmiJS）', value: 80 },
    { name: 'Angular', value: 75 },
    { name: 'Node.js / 微信小程序', value: 70 },
  ] as Skill[],
}
