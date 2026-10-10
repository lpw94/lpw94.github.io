-- ============================================================
-- 文章点赞计数（每篇文章一行）
-- ============================================================
-- 与浏览数（bump_post_views）不同，点赞用「一行一文章 + 计数」的方式，
-- 配合前端 localStorage 去重（每浏览器每篇只计一次），避免无限刷赞。
create table if not exists post_likes (
  post_id uuid primary key references posts (id) on delete cascade,
  count integer not null default 0
);

alter table post_likes enable row level security;

-- 点赞数所有人可见
create policy "anyone can read post likes"
  on post_likes for select
  using (true);

-- 允许插入/更新（前端通过 rpc 自增，匿名访客也可点赞）
create policy "anyone can insert post like"
  on post_likes for insert
  with check (true);

create policy "anyone can update post like"
  on post_likes for update
  using (true);

-- 自增点赞数：没有就建一行，有就 +1，返回最新值
create or replace function bump_post_likes(p_post_id uuid)
returns integer
language plpgsql
as $$
declare
  new_count integer;
begin
  insert into post_likes (post_id, count)
  values (p_post_id, 1)
  on conflict (post_id) do update set count = post_likes.count + 1
  returning count into new_count;
  return new_count;
end;
$$;
