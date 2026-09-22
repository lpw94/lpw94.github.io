import { Link } from 'react-router-dom'
import type { Post } from '../types'

export default function PostCard({ post }: { post: Post }) {
  return (
    <Link to={`/post/${post.slug}`} className="post-card">
      {post.cover_url && <img src={post.cover_url} alt={post.title} />}
      <h2>{post.title}</h2>
      <time className="muted">{post.published_at?.slice(0, 10)}</time>
    </Link>
  )
}
