import { Link } from 'react-router-dom';
import { posts } from '../lib/content';

export default function BlogList() {
  return (
    <div>
      <h1 className="text-3xl font-bold text-slate-900 mb-8">技术博客</h1>
      {posts.length === 0 ? (
        <p className="text-slate-500">暂无文章。</p>
      ) : (
        <ul className="divide-y divide-slate-200">
          {posts.map((p) => (
            <li key={p.slug} className="py-6">
              <Link to={`/blog/${p.slug}`} className="group block">
                <div className="flex items-baseline justify-between gap-4">
                  <h2 className="text-xl font-semibold text-slate-900 group-hover:text-brand transition-colors">
                    {p.title}
                  </h2>
                  {p.date && <time className="text-sm text-slate-400 shrink-0">{p.date}</time>}
                </div>
                {p.summary && <p className="mt-2 text-slate-600">{p.summary}</p>}
                {p.tags && p.tags.length > 0 && (
                  <div className="mt-3 flex flex-wrap gap-2">
                    {p.tags.map((t) => (
                      <span
                        key={t}
                        className="text-xs px-2 py-0.5 rounded-full bg-indigo-50 text-brand"
                      >
                        #{t}
                      </span>
                    ))}
                  </div>
                )}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
