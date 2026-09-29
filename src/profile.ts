// 侧栏个人信息：只改这个文件即可，不需要动组件和样式。
// 头像默认用的是 public/avatar.svg 占位图，换成自己的照片时把它替换掉，
// 或者把 avatar 改成图片地址（例如 '/me.jpg' 或 https://... ）。
export type ProfileLink = {
  label: string
  href: string
  /** 显示文字，不填则显示 href 原文 */
  text?: string
  /** 社交图标：设置后渲染到头像下方的图标行，不再出现在文字列表里 */
  icon?: 'mail' | 'github' | 'weibo' | 'x'
}

export const profile = {
  name: 'woge',
  avatar: '/avatar.png',
  bio: '前端开发者，喜欢折腾工具链，也随手记录一些踩坑笔记。',
  links: [
    { label: '关于', href: '/about', text: '个人简历' },
    { label: '邮箱', href: 'mailto:lpw9494@gmail.com', icon: 'mail' },
    { label: 'GitHub', href: 'https://github.com/lpw94', icon: 'github' },
    // TODO: 换成你的真实微博 / X 地址
    { label: '微博', href: 'https://weibo.com/lpw945', icon: 'weibo' },
    { label: 'X (Twitter)', href: 'https://x.com/', icon: 'x' },
  ] as ProfileLink[],
}
