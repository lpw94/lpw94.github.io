import { Link } from 'react-router-dom';

export default function NotFound() {
  return (
    <div className="text-center py-24">
      <p className="text-6xl font-bold text-brand">404</p>
      <h1 className="mt-4 text-2xl font-semibold text-slate-900">页面走丢了</h1>
      <Link to="/" className="mt-6 inline-block text-brand hover:underline">
        ← 回到首页
      </Link>
    </div>
  );
}
