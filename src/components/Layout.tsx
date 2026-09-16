import { Outlet } from 'react-router-dom';
import Navbar from './Navbar';
import Footer from './Footer';

export default function Layout() {
  return (
    <div className="min-h-screen flex flex-col bg-slate-50 text-slate-800">
      <Navbar />
      <main className="flex-1 w-full max-w-5xl mx-auto px-4 py-10">
        <Outlet />
      </main>
      <Footer />
    </div>
  );
}
