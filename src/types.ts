/** 文章分类：value 存库，label 用于显示 */
export type Category = 'frontend' | 'backend' | 'database' | 'industry' | 'other'

export const CATEGORIES: { value: Category; label: string }[] = [
  { value: 'frontend', label: '前端' },
  { value: 'backend', label: '后端' },
  { value: 'database', label: '数据库' },
  { value: 'industry', label: '行业' },
  { value: 'other', label: '其他' },
]

export const CATEGORY_LABEL: Record<Category, string> = {
  frontend: '前端',
  backend: '后端',
  database: '数据库',
  industry: '行业',
  other: '其他',
}

export interface Post {
  id: string
  slug: string
  title: string
  content: string
  cover_url: string | null
  category: Category
  status: 'draft' | 'published'
  views: number
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

/** 个人常用书签：合并进 /tools 常用导航页展示 + /admin 后台配置 */
export interface Bookmark {
  id: string
  name: string
  url: string
  category: string
  description: string
  created_at: string
}

/** 私有记事本：/notes 登录后可见，RLS 仅 authenticated 可读写（无 anon 授权） */
export interface Note {
  id: string
  title: string
  content: string
  created_at: string
  updated_at: string
}

/** 后台书签分类输入框的常用建议（datalist），可自由输入其它分类 */
export const BOOKMARK_CATEGORY_HINTS = ['开发', '设计', '学习', '工具', '社交', '娱乐', '其他']
