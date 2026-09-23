/** 文章分类：value 存库，label 用于显示 */
export type Category = 'tech' | 'news' | 'essay'

export const CATEGORIES: { value: Category; label: string }[] = [
  { value: 'tech', label: '技术' },
  { value: 'news', label: '新闻' },
  { value: 'essay', label: '杂文' },
]

export const CATEGORY_LABEL: Record<Category, string> = {
  tech: '技术',
  news: '新闻',
  essay: '杂文',
}

export interface Post {
  id: string
  slug: string
  title: string
  content: string
  cover_url: string | null
  category: Category
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
