-- ============================================================
-- 小游戏排行榜：贪吃蛇 / 扫雷 / 2048 / 飞机大战
-- ============================================================
-- score 语义按游戏不同（前端按游戏排序）：
--   snake       贪吃蛇：吃到的食物数（越大越好）
--   minesweeper 扫雷：通关用时秒数（越小越好，仅胜利时提交）
--   g2048       2048：合成总分（越大越好）
--   plane       飞机大战：击落敌机得分（越大越好）
create table if not exists game_scores (
  id bigint generated always as identity primary key,
  game text not null check (game in ('snake', 'minesweeper', 'g2048', 'plane')),
  -- 昵称：前端截断到 12 字符，不收集任何账号信息
  player text not null,
  score integer not null,
  created_at timestamptz not null default now()
);

alter table game_scores enable row level security;

-- 排行榜所有人可见
create policy "anyone can read game scores"
  on game_scores for select
  using (true);

-- 任何人都能提交分数（个人博客彩蛋，风险可控）
create policy "anyone can insert game score"
  on game_scores for insert
  with check (true);

-- 排行榜查询：按游戏取 top N
create index if not exists game_scores_game_score_idx
  on game_scores (game, score);

-- ============================================================
-- 已部署实例修复：早期版本的 game 列 CHECK 仅含 snake/minesweeper/g2048，
-- 飞机大战(plane) 提交会被拒绝。下面幂等块先删掉该列所有 CHECK 约束，
-- 再加回含 plane 的版本。可反复执行，不影响已有数据。
-- 在 Supabase SQL Editor 粘贴运行即可。
-- ============================================================
do $$
declare
  c text;
begin
  for c in
    select conname
    from pg_constraint
    where conrelid = 'game_scores'::regclass and contype = 'c'
  loop
    execute format('alter table game_scores drop constraint %I', c);
  end loop;
  alter table game_scores add constraint game_scores_game_check
    check (game in ('snake', 'minesweeper', 'g2048', 'plane'));
end $$;
