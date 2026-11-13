import { Link } from 'react-router-dom'
import { CATEGORY_LABEL, type Post } from '../types'
import { formatDate } from '../lib/date'
import { readingTime } from '../lib/content'

export default function PostCard({ post }: { post: Post }) {
  return (
    // 把列表里已取回的全文随路由带给详情页，点开后正文立即可见（详情页仍会后台刷新）
    <Link to={`/post/${post.slug}`} state={{ post }} className="post-card">
      {post.cover_url && <img src={post.cover_url} alt={post.title} />}
      <div className="post-card-meta">
        {post.category && (
          <span className={`post-category cat-${post.category}`}>
            {CATEGORY_LABEL[post.category] ?? post.category}
          </span>
        )}
        <time className="muted">{formatDate(post.published_at)}</time>
        {/* 纯 PDF 文章没有正文，就不显示「1 分钟」这种无意义的阅读时长 */}
        {post.content?.trim() && (
          <span className="muted">· {readingTime(post.content)} 分钟</span>
        )}
        {post.pdf_url && (
          <span className="post-pdf-badge" title="含 PDF 附件">📄 PDF</span>
        )}
      </div>
      <h2>{post.title}</h2>
    </Link>
  )
}
