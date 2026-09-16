import { NavLink } from 'react-router-dom';

const links = [
  { to: '/', label: '首页', end: true },
  { to: '/blog', label: '博客', end: false },
  { to: '/resume', label: '简历', end: false },
  { to: '/p/about', label: '关于', end: false },
];

export default function Navbar() {
  return (
    <header className="sticky top-0 z-10 bg-white/80 backdrop-blur border-b border-slate-200">
      <nav className="max-w-5xl mx-auto px-4 h-14 flex items-center justify-between">
        <NavLink to="/" end className="font-bold text-lg text-brand">
          吴八哥
        </NavLink>
        <div className="flex gap-5 text-sm">
          {links.map((l) => (
            <NavLink
              key={l.to}
              to={l.to}
              end={l.end}
              className={({ isActive }) =>
                isActive
                  ? 'text-brand font-medium'
                  : 'text-slate-600 hover:text-brand transition-colors'
              }
            >
              {l.label}
            </NavLink>
          ))}
        </div>
      </nav>
    </header>
  );
}
