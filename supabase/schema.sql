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

-- 分类约束显式对齐前端 CATEGORIES。
-- 表若在早期版本创建过，可能残留一套旧的 posts_category_check（缺少 other/industry 等），
-- 而 create table if not exists 不会更新它 —— 这里 drop + add 保证重复执行也能修正。
-- 注意：若已有数据的 category 不在下列集合内，add 会失败，需先 UPDATE 规范历史数据。
alter table posts drop constraint if exists posts_category_check;
alter table posts add constraint posts_category_check
  check (category in ('frontend', 'backend', 'database', 'industry', 'other'));

create index if not exists posts_published_idx
  on posts (status, published_at desc);

-- 首页按分类筛选
create index if not exists posts_category_idx
  on posts (category, published_at desc);

-- 浏览次数：每打开一次文章详情页面 +1（由 bump_post_views RPC 自增）。
-- if not exists 保证对已有库重复执行时不会报错。
alter table posts add column if not exists views bigint not null default 0;

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
-- Data API 授权（Supabase 2025-10-30 起，public 新建表需显式 GRANT 才能经 Data API 访问）
-- 此处对所有表统一授权，保证 supabase db reset / 新建分支 / 新项目重跑 schema 后仍可从
-- supabase-js / PostgREST 访问。已存在表的旧授权不受影响；重复执行仅为幂等重授权。
-- 授权范围与上方 RLS 策略对齐：anon 仅公开读/写，authenticated 可管理，service_role 全权。
-- ============================================================

-- posts
grant select                                   on public.posts to anon;
grant select, insert, update, delete           on public.posts to authenticated;
grant select, insert, update, delete           on public.posts to service_role;

-- comments
grant select, insert                            on public.comments to anon;
grant select, insert, update, delete           on public.comments to authenticated;
grant select, insert, update, delete           on public.comments to service_role;

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

-- 登录用户可删除：用于自动清理被替换的旧封面、编辑器里删掉的正文图。
-- 注意：schema.sql 只在手动执行时生效，已有库需在 SQL Editor 单独跑这一段。
drop policy if exists "Auth can delete covers" on storage.objects;
create policy "Auth can delete covers"
  on storage.objects for delete
  to authenticated
  using (bucket_id = 'covers');

-- ============================================================
-- 全站访客计数（单行走全局计数器，RPC 原子自增）
-- ============================================================
create table if not exists site_stats (
  key        text primary key,
  visitors   bigint not null default 0,
  updated_at timestamptz not null default now()
);

-- 初始化全局计数行（重复执行幂等）
insert into site_stats (key, visitors) values ('global', 0)
on conflict (key) do nothing;

-- 原子自增并返回最新值：security definer 让匿名访客也能调用，无需为表开写策略。
-- 表启用 RLS 且不给 anon 直接访问策略，访客只能经由本函数自增，不能直接读写整张表。
create or replace function bump_visitors()
returns bigint
language plpgsql
security definer
set search_path = public
as $$
declare
  v bigint;
begin
  update site_stats set visitors = visitors + 1, updated_at = now()
   where key = 'global'
   returning visitors into v;
  return v;
end;
$$;

alter table site_stats enable row level security;
grant execute on function public.bump_visitors() to anon, authenticated, service_role;

-- ============================================================
-- 文章浏览次数：每打开一次文章详情页面 +1
-- ============================================================
-- 原子自增指定文章的 views 并返回最新值：security definer 让匿名访客也能调用，
-- 无需为 posts 表给 anon 开更新策略（anon 仍只能经本函数自增，不能直接改整张表）。
create or replace function bump_post_views(p_post_id uuid)
returns bigint
language plpgsql
security definer
set search_path = public
as $$
declare
  v bigint;
begin
  update posts set views = views + 1
   where id = p_post_id
   returning views into v;
  return v;
end;
$$;

grant execute on function public.bump_post_views(uuid) to anon, authenticated, service_role;
