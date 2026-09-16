import matter from 'gray-matter';

export interface DocMeta {
  slug: string;
  title: string;
  date?: string;
  tags?: string[];
  summary?: string;
}

export interface Doc extends DocMeta {
  content: string;
}

// 构建时把 Markdown 源文件打包进站点（纯静态，无需后端）
const postModules = import.meta.glob('../content/posts/*.md', {
  query: '?raw',
  import: 'default',
  eager: true,
}) as Record<string, string>;

const pageModules = import.meta.glob('../content/pages/*.md', {
  query: '?raw',
  import: 'default',
  eager: true,
}) as Record<string, string>;

function slugFromPath(path: string): string {
  const file = path.split('/').pop() || path.split('\\').pop() || '';
  return file.replace(/\.md$/, '');
}

function parse(modules: Record<string, string>): Doc[] {
  return Object.entries(modules).map(([path, raw]) => {
    const { data, content } = matter(raw);
    return {
      slug: slugFromPath(path),
      title: (data.title as string) || slugFromPath(path),
      date: data.date as string | undefined,
      tags: (data.tags as string[]) || [],
      summary: data.summary as string | undefined,
      content,
    };
  });
}

export const posts: Doc[] = parse(postModules).sort((a, b) =>
  (b.date || '').localeCompare(a.date || ''),
);

export const pages: Doc[] = parse(pageModules);

export function getPost(slug: string): Doc | undefined {
  return posts.find((p) => p.slug === slug);
}

export function getPage(slug: string): Doc | undefined {
  return pages.find((p) => p.slug === slug);
}
