type Props = {
  /** 广告图片地址，留空则显示占位 */
  src?: string
  /** 点击跳转链接 */
  href?: string
  /** 标题（占位时默认“广告位招租”） */
  title?: string
  /** 描述（占位时默认招租文案） */
  desc?: string
}

/**
 * 广告位组件。默认显示合规占位（明确标注“广告”），
 * 接入真实广告时传入 src / href 即可；保持 rel="sponsored" 标注赞助属性。
 */
export default function AdSlot({ src, href, title, desc }: Props) {
  const inner = (
    <div className="ad-body">
      <span className="ad-badge">广告</span>
      {src ? (
        <img className="ad-img" src={src} alt={title ?? '广告'} />
      ) : (
        <div className="ad-placeholder">
          <div className="ad-emoji">📣</div>
          <div className="ad-title">{title ?? '广告位招租'}</div>
          <div className="ad-desc">{desc ?? '你的品牌可以出现在这里'}</div>
        </div>
      )}
    </div>
  )

  return (
    <section className="widget-card ad-widget" aria-label="广告">
      {href ? (
        <a className="ad-link" href={href} target="_blank" rel="noreferrer sponsored">
          {inner}
        </a>
      ) : (
        inner
      )}
    </section>
  )
}
