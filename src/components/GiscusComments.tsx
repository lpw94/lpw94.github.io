import { useEffect, useRef } from 'react'
import { useLocation } from 'react-router-dom'

/**
 * Giscus 评论（基于 GitHub Discussions，零后端依赖）。
 *
 * 上线前需补齐两项 GitHub 节点 ID（公开仓库也拿不到，必须到 https://giscus.app 生成）：
 *   1) 仓库 Settings → 开启 Discussions；
 *   2) 安装 giscus app：https://github.com/apps/giscus ；
 *   3) 打开 https://giscus.app ，填好仓库与「评论」分类，复制生成的
 *      data-repo-id（R_xxx）与 data-category-id（DIC_xxx）填到下方。
 * 其余字段已按本博客配好：按 pathname 映射每篇文章独立讨论串、开启表情回应、简体中文。
 */
const GISCUS = {
  repo: 'lpw94/lpw94.github.io',
  repoId: '', // TODO: 填 giscus.app 生成的 repo-id
  category: 'Comments', // Discussions 里用于评论的分类名（需先建好）
  categoryId: '', // TODO: 填 giscus.app 生成的 category-id
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
