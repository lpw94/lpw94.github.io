-- ============================================================
-- 私有记事本（/notes，登录后可见）
-- 字段：标题 title / 正文 content / 创建时间 created_at / 更新时间 updated_at
-- 与 posts/bookmarks 的区别：内容私密，anon 不授权任何读写，
-- 仅 authenticated（博主本人登录）可查、可增、改、删；RLS 兜底。
-- ============================================================
create table if not exists notes (
  id          uuid primary key default gen_random_uuid(),
  title       text not null default '',                   -- 标题（可留空，展示时回退「无标题」）
  content     text not null default '',                   -- 正文（纯文本，保留换行）
  created_at  timestamptz not null default now(),         -- 创建时间
  updated_at  timestamptz not null default now()          -- 更新时间（保存时由前端刷新）
);

-- 列表按最近编辑倒序拉取
create index if not exists notes_updated_at_idx
  on notes (updated_at desc);

alter table notes enable row level security;

-- 仅登录用户可管理全部记事（个人博客场景即博主本人；
-- 如需多用户私有，可再按 auth.uid() 加 user_id 列并改策略）
drop policy if exists "Authenticated users can manage notes" on notes;
create policy "Authenticated users can manage notes"
  on notes for all
  to authenticated
  using (true)
  with check (true);

-- Data API 授权：注意没有 anon —— 未登录访客连列表都拉不到，
-- 与 bookmarks（公开读）刻意区分，保证记事内容私密
grant select, insert, update, delete on public.notes to authenticated;
grant select, insert, update, delete on public.notes to service_role;
