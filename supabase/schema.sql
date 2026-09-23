-- 个人博客数据表
create table if not exists posts (
  id           uuid primary key default gen_random_uuid(),
  slug         text unique not null,                       -- 路由路径，如 /post/hello-world
  title        text not null,
  content      text not null,                              -- Markdown / HTML 正文
  cover_url    text,                                       -- 封面图（存 Supabase Storage）
  category     text not null default 'frontend'            -- frontend | backend | database | industry | other
               check (category in ('frontend', 'backend', 'database', 'industry', 'other')),
  status       text not null default 'draft',              -- draft | published
  created_at   timestamptz not null default now(),
  published_at timestamptz                                  -- 发布时间
);

create index if not exists posts_published_idx
  on posts (status, published_at desc);

-- 首页按分类筛选
create index if not exists posts_category_idx
  on posts (category, published_at desc);

-- 开启行级安全（RLS）
alter table posts enable row level security;

-- 公开可读：仅已发布文章
drop policy if exists "Public can read published posts" on posts;
create policy "Public can read published posts"
  on posts for select
  using (status = 'published');

-- 登录用户可读写全部（用于后台发稿）
drop policy if exists "Authenticated users can manage posts" on posts;
create policy "Authenticated users can manage posts"
  on posts for all
  to authenticated
  using (true)
  with check (true);

-- ============================================================
-- 评论表
-- ============================================================
create table if not exists comments (
  id           uuid primary key default gen_random_uuid(),
  post_id      uuid not null references posts(id) on delete cascade,
  author_name  text not null,
  content      text not null,
  created_at   timestamptz not null default now()
);

create index if not exists comments_post_idx
  on comments (post_id, created_at desc);

alter table comments enable row level security;

-- 评论公开可读
drop policy if exists "Public can read comments" on comments;
create policy "Public can read comments"
  on comments for select
  using (true);

-- 评论公开可写（个人博客，读者无需登录即可留言）
drop policy if exists "Public can insert comments" on comments;
create policy "Public can insert comments"
  on comments for insert
  with check (true);

-- ============================================================
-- 封面图存储桶（公开读、登录用户可上传）
-- ============================================================
insert into storage.buckets (id, name, public)
values ('covers', 'covers', true)
on conflict (id) do nothing;

drop policy if exists "Public can read covers" on storage.objects;
create policy "Public can read covers"
  on storage.objects for select
  using (bucket_id = 'covers');

drop policy if exists "Auth can upload covers" on storage.objects;
create policy "Auth can upload covers"
  on storage.objects for insert
  to authenticated
  with check (bucket_id = 'covers');
