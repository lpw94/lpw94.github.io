// 站点根地址，供 canonical / og:url / 结构化数据使用。
//
// 为什么不「优先」用 .env 里的 VITE_SITE_URL：
// 线上部署环境的 secret 被配成了 Supabase 项目地址（...supabase.co），
// 用它拼出来的 canonical 会把搜索引擎指向 supabase，og:image 也会 404。
// Helmet 是在浏览器里渲染的，window.location.origin 永远是对的，所以优先取它，
// 只有拿不到 window 的场景（构建脚本 / 预渲染）才回落到环境变量与线上域名。
const RUNTIME_ORIGIN =
  typeof window !== 'undefined' && /^https?:/.test(window.location.origin)
    ? window.location.origin
    : ''

export const SITE_URL = RUNTIME_ORIGIN || import.meta.env.VITE_SITE_URL || 'https://lpw94.github.io'

export const SITE_NAME = 'woge博客'
