import { Link } from 'react-router-dom'
import { CATEGORY_LABEL, type Post } from '../types'
import { formatDate } from '../lib/date'

export default function PostCard({ post }: { post: Post }) {
  return (
    <Link to={`/post/${post.slug}`} className="post-card">
      {post.cover_url && <img src={post.cover_url} alt={post.title} />}
      <div className="post-card-meta">
        {post.category && (
          <span className={`post-category cat-${post.category}`}>
            {CATEGORY_LABEL[post.category] ?? post.category}
          </span>
        )}
        <time className="muted">{formatDate(post.published_at)}</time>
      </div>
      <h2>{post.title}</h2>
    </Link>
  )
}
