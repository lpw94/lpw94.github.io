export default function Footer() {
  const year = new Date().getFullYear();
  return (
    <footer className="border-t border-slate-200 bg-white">
      <div className="max-w-5xl mx-auto px-4 py-6 text-sm text-slate-500 flex flex-col sm:flex-row items-center justify-between gap-2">
        <span>© {year} 吴八哥 · 用 React + Vite 构建</span>
        <a
          href="https://github.com/lpw94/lpw94.github.io"
          target="_blank"
          rel="noreferrer"
          className="hover:text-brand transition-colors"
        >
          GitHub
        </a>
      </div>
    </footer>
  );
}
