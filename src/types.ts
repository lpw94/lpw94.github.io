export interface Post {
  id: string
  slug: string
  title: string
  content: string
  cover_url: string | null
  status: 'draft' | 'published'
  created_at: string
  published_at: string | null
}

export interface Comment {
  id: string
  post_id: string
  author_name: string
  content: string
  created_at: string
}
