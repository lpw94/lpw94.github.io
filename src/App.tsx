import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { Helmet } from 'react-helmet-async'
import Layout from './components/Layout'
import Home from './pages/Home'
import PostDetail from './pages/PostDetail'
import About from './pages/About'
import Gallery from './pages/Gallery'
import Tools from './pages/Tools'
import Toolbox from './pages/Toolbox'
import Notes from './pages/Notes'
import Admin from './pages/Admin'
import ResetPassword from './pages/ResetPassword'
import ToastHost from './components/Toast'

export default function App() {
  return (
    <BrowserRouter>
      <Helmet>
        <title>沃哥博客</title>
        <meta name="description" content="基于 React + Supabase 的个人博客" />
        <meta property="og:site_name" content="沃哥博客" />
      </Helmet>
      <Layout>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/post/:slug" element={<PostDetail />} />
          <Route path="/about" element={<About />} />
          <Route path="/gallery" element={<Gallery />} />
          <Route path="/tools" element={<Tools />} />
          <Route path="/toolbox" element={<Toolbox />} />
          {/* 书签已合并进 /tools 常用导航页，旧链接统一跳转过去 */}
          <Route path="/bookmarks" element={<Navigate to="/tools" replace />} />
          <Route path="/notes" element={<Notes />} />
          <Route path="/admin" element={<Admin />} />
          <Route path="/reset-password" element={<ResetPassword />} />
        </Routes>
      </Layout>
      <ToastHost />
    </BrowserRouter>
  )
}
