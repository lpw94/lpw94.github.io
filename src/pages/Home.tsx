import { Link } from 'react-router-dom';
import { posts } from '../lib/content';

export default function Home() {
  const recent = posts.slice(0, 3);
  return (
    <div className="space-y-12">
      <section className="text-center py-12">
        <h1 className="text-4xl sm:text-5xl font-bold text-slate-900">
          你好，我是 <span className="text-brand">吴八哥</span>
        </h1>
        <p className="mt-4 text-lg text-slate-600 max-w-2xl mx-auto">
          前端开发工程师，热爱打磨用户体验与可视化大屏。这里记录我的技术思考、项目经验与一些自定义页面。
        </p>
        <div className="mt-8 flex gap-4 justify-center">
          <Link
            to="/blog"
            className="px-5 py-2.5 rounded-lg bg-brand text-white font-medium hover:bg-brand-dark transition-colors"
          >
            阅读博客
          </Link>
          <Link
            to="/resume"
            className="px-5 py-2.5 rounded-lg border border-slate-300 text-slate-700 font-medium hover:border-brand hover:text-brand transition-colors"
          >
            查看简历
          </Link>
        </div>
      </section>

      <section>
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-semibold text-slate-900">最新文章</h2>
          <Link to="/blog" className="text-sm text-brand hover:underline">
            全部文章 →
          </Link>
        </div>
        {recent.length === 0 ? (
          <p className="text-slate-500">还没有发布文章，去 src/content/posts 添加一篇吧。</p>
        ) : (
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {recent.map((p) => (
              <Link
                key={p.slug}
                to={`/blog/${p.slug}`}
                className="block p-5 rounded-xl bg-white border border-slate-200 hover:shadow-md hover:border-brand/40 transition-all"
              >
                <h3 className="font-semibold text-slate-900 line-clamp-2">{p.title}</h3>
                <p className="mt-2 text-sm text-slate-500 line-clamp-3">{p.summary}</p>
                {p.date && (
                  <span className="mt-3 inline-block text-xs text-slate-400">{p.date}</span>
                )}
              </Link>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
