-- ============================================================
-- 分类体系调整 → 最终状态：前端 / 后端 / 数据库 / 行业 / 其他
-- 在 Supabase Dashboard -> SQL Editor 里执行。
--
-- 脚本是幂等的，可重复执行：无论你之前执行到哪一步（还是只跑过 add-category.sql），
-- 跑完这一遍都会到达上面的最终状态。
-- ============================================================

-- 1) 先摘掉旧约束，否则下面的数据修改会被 check 拦住
alter table posts drop constraint if exists posts_category_check;

-- 2) 迁移历史取值
update posts set category = 'frontend' where category = 'tech';    -- 技术   → 前端
update posts set category = 'industry' where category = 'news';    -- 新闻   → 行业
update posts set category = 'other'    where category = 'essay';   -- 杂文   → 其他

-- 3) 兜底：仍不在新取值范围内的，先落到「其他」，
--    避免第 4 步加约束时因表里存在非法值而失败
update posts
   set category = 'other'
 where category not in ('frontend', 'backend', 'database', 'industry', 'other');

-- 4) 换上新约束并更新默认值
alter table posts
  add constraint posts_category_check
  check (category in ('frontend', 'backend', 'database', 'industry', 'other'));

alter table posts alter column category set default 'frontend';

-- 5) 确认结果（可选）
-- select category, count(*) from posts group by category order by category;
