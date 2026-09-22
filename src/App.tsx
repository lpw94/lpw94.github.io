import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { Helmet } from 'react-helmet-async'
import Layout from './components/Layout'
import Home from './pages/Home'
import PostDetail from './pages/PostDetail'
import About from './pages/About'
import Login from './pages/Login'
import Admin from './pages/Admin'

export default function App() {
  return (
    <BrowserRouter>
      <Helmet>
        <title>我的博客</title>
        <meta name="description" content="基于 React + Supabase 的个人博客" />
        <meta property="og:site_name" content="我的博客" />
      </Helmet>
      <Layout>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/post/:slug" element={<PostDetail />} />
          <Route path="/about" element={<About />} />
          <Route path="/login" element={<Login />} />
          <Route path="/admin" element={<Admin />} />
        </Routes>
      </Layout>
    </BrowserRouter>
  )
}
