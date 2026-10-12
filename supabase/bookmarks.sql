-- ============================================================
-- 个人常用书签（快速入口）
-- 字段：名称 name / 网址 url / 分类 category / 创建时间 created_at / 介绍 description
-- 前台 /bookmarks 公开读，后台 /admin 登录后增删改
-- ============================================================
create table if not exists bookmarks (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,                              -- 名称
  url         text not null,                              -- 网址
  category    text not null default '其他',                -- 分类（自由文本，后台输入时带常用建议）
  description text not null default '',                   -- 介绍
  created_at  timestamptz not null default now()          -- 创建时间
);

create index if not exists bookmarks_category_idx
  on bookmarks (category, created_at desc);

alter table bookmarks enable row level security;

-- 公开可读：书签是给访客看的快速入口，无需登录
drop policy if exists "Public can read bookmarks" on bookmarks;
create policy "Public can read bookmarks"
  on bookmarks for select
  using (true);

-- 登录用户可管理全部（用于后台配置）
drop policy if exists "Authenticated users can manage bookmarks" on bookmarks;
create policy "Authenticated users can manage bookmarks"
  on bookmarks for all
  to authenticated
  using (true)
  with check (true);

-- Data API 授权（与 posts/comments 一致：anon 只读，authenticated 可写）
grant select                                   on public.bookmarks to anon;
grant select, insert, update, delete           on public.bookmarks to authenticated;
grant select, insert, update, delete           on public.bookmarks to service_role;
