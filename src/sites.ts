// 工具页网站导航数据：只改这个文件即可，不需要动页面和样式。
// 每个分类下的站点会渲染成一张卡片，icon 自动取名字首字符（中英文都行）。
export type SiteItem = {
  name: string
  url: string
  /** 一句话简介，可不填 */
  desc?: string
}

export type SiteCategory = {
  title: string
  sites: SiteItem[]
}

export const SITE_NAV: SiteCategory[] = [
  {
    title: '开发文档',
    sites: [
      { name: 'MDN', url: 'https://developer.mozilla.org/zh-CN/', desc: 'Web 技术权威文档' },
      { name: 'React', url: 'https://react.dev', desc: 'React 官方文档' },
      { name: 'Vue', url: 'https://cn.vuejs.org', desc: 'Vue 官方中文文档' },
      { name: 'TypeScript', url: 'https://www.typescriptlang.org/zh/', desc: 'TS 官方文档' },
      { name: 'Vite', url: 'https://cn.vitejs.dev', desc: '下一代前端构建工具' },
      { name: 'Tailwind CSS', url: 'https://tailwindcss.com', desc: '原子化 CSS 框架' },
    ],
  },
  {
    title: '代码与仓库',
    sites: [
      { name: 'GitHub', url: 'https://github.com', desc: '代码托管与开源社区' },
      { name: 'Gitee', url: 'https://gitee.com', desc: '国内代码托管平台' },
      { name: 'npm', url: 'https://www.npmjs.com', desc: 'Node 包注册中心' },
      { name: 'Stack Overflow', url: 'https://stackoverflow.com', desc: '程序员问答社区' },
      { name: 'CodePen', url: 'https://codepen.io', desc: '前端代码在线试验场' },
      { name: 'Can I Use', url: 'https://caniuse.com', desc: '浏览器兼容性查询' },
    ],
  },
  {
    title: 'AI 工具',
    sites: [
      { name: 'OpenAI', url: 'https://openai.com', desc: '人工智能实验室' },
      { name: '豆包', url: 'https://www.doubao.com', desc: '豆包 AI 助手' },
      { name: 'ChatGPT', url: 'https://chat.openai.com', desc: 'OpenAI 对话助手' },
      { name: 'Claude', url: 'https://claude.ai', desc: 'Anthropic 对话助手' },
      { name: 'DeepSeek', url: 'https://chat.deepseek.com', desc: '深度推理模型' },
      { name: 'Kimi', url: 'https://www.kimi.com', desc: '月之暗面长文本助手' },
      { name: '通义千问', url: 'https://www.tongyi.com', desc: '阿里 AI 助手' },
      { name: '元宝', url: 'https://yuanbao.tencent.com', desc: '腾讯 AI 助手' },
    ],
  },
  {
    title: '设计与资源',
    sites: [
      { name: 'iconfont', url: 'https://www.iconfont.cn', desc: '阿里矢量图标库' },
      { name: 'Figma', url: 'https://www.figma.com', desc: '协作式设计工具' },
      { name: 'Unsplash', url: 'https://unsplash.com', desc: '免费高清图片' },
      { name: 'Coolors', url: 'https://coolors.co', desc: '配色方案生成器' },
    ],
  },
  {
    title: '社区与资讯',
    sites: [
      { name: '掘金', url: 'https://juejin.cn', desc: '前端技术社区' },
      { name: 'SegmentFault', url: 'https://segmentfault.com', desc: '开发者问答社区' },
      { name: 'V2EX', url: 'https://www.v2ex.com', desc: '创意工作者社区' },
      { name: 'InfoQ', url: 'https://www.infoq.cn', desc: '技术资讯与实践' },
      { name: '阮一峰周刊', url: 'https://www.ruanyifeng.com/blog/weekly/', desc: '科技爱好者周刊' },
    ],
  },
  {
    title: '在线工具',
    sites: [
      { name: 'JSON 格式化', url: 'https://www.json.cn', desc: 'JSON 校验与格式化' },
      { name: 'Regex101', url: 'https://regex101.com', desc: '正则表达式在线调试' },
      { name: 'TinyPNG', url: 'https://tinypng.com', desc: '图片在线压缩' },
      { name: '草料二维码', url: 'https://cli.im', desc: '二维码生成器' },
      { name: 'ProcessOn', url: 'https://www.processon.com', desc: '在线流程图/脑图' },
    ],
  },
]
