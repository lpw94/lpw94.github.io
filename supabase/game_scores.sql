-- ============================================================
-- 小游戏排行榜：贪吃蛇 / 扫雷 / 2048
-- ============================================================
-- score 语义按游戏不同（前端按游戏排序）：
--   snake       贪吃蛇：吃到的食物数（越大越好）
--   minesweeper 扫雷：通关用时秒数（越小越好，仅胜利时提交）
--   g2048       2048：合成总分（越大越好）
create table if not exists game_scores (
  id bigint generated always as identity primary key,
  game text not null check (game in ('snake', 'minesweeper', 'g2048')),
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
