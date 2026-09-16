import { useParams, Link } from 'react-router-dom';
import { getPage } from '../lib/content';
import Markdown from '../components/Markdown';

export default function CustomPage() {
  const { slug } = useParams<{ slug: string }>();
  const page = slug ? getPage(slug) : undefined;

  if (!page) {
    return (
      <div className="text-center py-20">
        <h1 className="text-2xl font-semibold text-slate-900">页面不存在</h1>
        <p className="mt-2 text-slate-500">
          在 <code>src/content/pages/{slug}.md</code> 创建即可。
        </p>
        <Link to="/" className="mt-4 inline-block text-brand hover:underline">
          ← 返回首页
        </Link>
      </div>
    );
  }

  return (
    <div>
      <Markdown content={page.content} />
    </div>
  );
}
