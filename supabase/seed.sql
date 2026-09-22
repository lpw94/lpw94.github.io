-- 个人博客示例数据：插入 2 篇已发布文章
-- 在 Supabase SQL Editor 执行即可（重复执行安全，用 on conflict 去重）
-- 正文用 $$ 美元引号包裹；注意：正文内不要出现三个反引号 ```，否则会干扰编辑器解析
insert into posts (slug, title, content, status, published_at)
values
  (
    'hello-world',
    '你好，世界：我的第一篇博客',
    $$# 你好，世界

这是用 **React + Supabase** 搭的个人博客的第一篇文章。

## 它能做什么
- 文章列表与详情页（按 slug 路由）
- 后台登录发稿（Supabase Auth 邮箱魔法链接）
- Markdown 渲染、每页 SEO、评论、RSS / Sitemap

> 一段引用示例：写博客最好的时间是十年前，其次是现在。

代码块示例（缩进式，避免反引号）：

    // 代码块示例
    console.log('Hello, Supabase!')

祝写作愉快 🎉$$,
    'published',
    now()
  ),
  (
    'supabase-free-tier',
    '为什么选 Supabase 做免费数据库',
    $$# 为什么选 Supabase

免费档就能拿到一整套后端能力：

## 免费额度
| 能力 | 免费额度 |
|------|---------|
| Postgres 存储 | 500 MB |
| 认证用户(MAU) | 5 万 |
| 实时 / Storage | 包含 |

## 核心优势
1. **标准 Postgres**，随时 pg_dump 导出，无锁定风险
2. 自带 Auth、Storage、实时订阅
3. Row Level Security 一行策略搞定权限$$,
    'published',
    now()
  )
on conflict (slug) do nothing;
