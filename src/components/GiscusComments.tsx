import { useEffect, useRef } from 'react'
import { useLocation } from 'react-router-dom'

/**
 * Giscus 评论（基于 GitHub Discussions，零后端依赖）。
 *
 * 依赖（已配置完成）：
 *   1) 仓库已开启 Discussions；
 *   2) 已安装 giscus app 并授权本仓库；
 *   3) 下方 repoId / categoryId 取自 giscus 官方接口
 *      https://giscus.app/api/discussions/categories?repo=<owner>/<name> 。
 * 使用分类 Announcements（giscus 官方推荐：仅维护者可发起讨论，避免被当作普通讨论区）；
 * 想改成 General 只需同步替换 category / categoryId 两行。
 * 其余字段已按本博客配好：按 pathname 映射每篇文章独立讨论串、开启表情回应、简体中文。
 */
const GISCUS = {
  repo: 'lpw94/lpw94.github.io',
  repoId: 'MDEwOlJlcG9zaXRvcnk2ODUwNTYwNA==',
  category: 'Announcements',
  categoryId: 'DIC_kwDOBBVQBM4CcDCP',
  mapping: 'pathname',
  strict: '0',
  reactionsEnabled: '1',
  emitMetadata: '0',
  inputPosition: 'bottom',
  theme: 'light',
  lang: 'zh-CN',
  loading: 'lazy',
} as const

export default function GiscusComments() {
  const mountRef = useRef<HTMLDivElement>(null)
  const { pathname } = useLocation()

  useEffect(() => {
    const container = mountRef.current
    if (!container) return

    // 两项 ID 未填：给出配置提示，避免加载出 giscus 的错误 iframe
    if (!GISCUS.repoId || !GISCUS.categoryId) {
      container.innerHTML =
        '<p class="muted">评论区待配置：在 GiscusComments.tsx 填写 repoId / categoryId（见 giscus.app）。</p>'
      return
    }

    // 切换文章（pathname 变）时清掉旧 iframe 再重新挂载，
    // 让 Giscus 按新 pathname 加载对应讨论串（SPA 不刷新页面的关键）
    container.innerHTML = ''
    const script = document.createElement('script')
    script.src = 'https://giscus.app/client.js'
    script.async = true
    script.crossOrigin = 'anonymous'
    Object.entries(GISCUS).forEach(([key, value]) => {
      script.setAttribute(`data-${key.replace(/([A-Z])/g, '-$1').toLowerCase()}`, value)
    })
    container.appendChild(script)
  }, [pathname])

  return (
    <section className="comments">
      <h2>评论</h2>
      <div className="giscus-mount" ref={mountRef} aria-label="Giscus 评论区" />
    </section>
  )
}
