import { useParams, Link } from 'react-router-dom';
import { getPost } from '../lib/content';
import Markdown from '../components/Markdown';

export default function BlogPost() {
  const { slug } = useParams<{ slug: string }>();
  const post = slug ? getPost(slug) : undefined;

  if (!post) {
    return (
      <div className="text-center py-20">
        <h1 className="text-2xl font-semibold text-slate-900">文章不存在</h1>
        <Link to="/blog" className="mt-4 inline-block text-brand hover:underline">
          ← 返回博客列表
        </Link>
      </div>
    );
  }

  return (
    <article>
      <Link to="/blog" className="text-sm text-slate-500 hover:text-brand">
        ← 返回博客
      </Link>
      <header className="mt-4 mb-8 border-b border-slate-200 pb-6">
        <h1 className="text-3xl font-bold text-slate-900">{post.title}</h1>
        <div className="mt-3 flex items-center gap-3 text-sm text-slate-400">
          {post.date && <time>{post.date}</time>}
          {post.tags?.map((t) => (
            <span key={t} className="px-2 py-0.5 rounded-full bg-indigo-50 text-brand">
              #{t}
            </span>
          ))}
        </div>
      </header>
      <Markdown content={post.content} />
    </article>
  );
}
