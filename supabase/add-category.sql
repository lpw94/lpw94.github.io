-- ============================================================
-- 文章分类字段（技术 / 新闻 / 杂文）
-- 在 Supabase Dashboard -> SQL Editor 里执行一次即可。
-- 已有文章会被归到默认分类 tech（技术），之后可在后台逐篇修改。
-- ============================================================

alter table posts
  add column if not exists category text not null default 'tech';

-- 限定取值范围，避免写入未知分类
alter table posts drop constraint if exists posts_category_check;
alter table posts
  add constraint posts_category_check
  check (category in ('tech', 'news', 'essay'));

-- 首页按「分类 + 发布时间」筛选
create index if not exists posts_category_idx
  on posts (category, published_at desc);
