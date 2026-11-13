-- 文章 PDF 附件（每篇最多一个）
-- 文件仍放在已有的公开桶 covers 里，只是换到 pdfs/ 子目录：
--   · 不用新建 bucket：上传策略按 bucket_id 判定，覆盖整桶（实测 PDF 上传 200）
--     ⚠️ 现有库缺 DELETE 策略，本脚本末尾会顺带补一条
--   · 对象 key 是「时间戳+随机串」，原始文件名单独存一列，用于前台展示与下载命名
-- 本脚本幂等，可在 SQL Editor 重复执行。

alter table posts add column if not exists pdf_url  text;   -- Supabase Storage 公开地址
alter table posts add column if not exists pdf_name text;   -- 上传时的原始文件名

-- posts 的表级 grant 已在 schema.sql 配好（anon 只读 / authenticated 可写），
-- 新增列自动继承，无需单独授权。

-- ⚠️ 若后台上传报 "mime type application/pdf is not supported"，说明 covers 桶
--    设了 allowed_mime_types 白名单。可在 Dashboard → Storage → covers 里补上
--    application/pdf，或按需执行下面这句（会清掉整个白名单限制）：
-- update storage.buckets set allowed_mime_types = null where id = 'covers';
-- 实测当前库上传 application/pdf 返回 200，无需改 mime 配置。

-- ============================================================
-- 顺带补齐「登录用户可删除 covers 对象」策略
-- schema.sql 里有同名策略，但那份只在手动执行时生效。实测现有库缺这一条：
--   storage.remove() 返回 200 + []，对象仍在 → 被替换的封面/PDF 一直清不掉。
-- 用 drop + create 幂等重建，同时修好已有的图片清理逻辑。
-- ============================================================
drop policy if exists "Auth can delete covers" on storage.objects;
create policy "Auth can delete covers"
  on storage.objects for delete
  to authenticated
  using (bucket_id = 'covers');

-- 功能验证时上传的两个临时探测 PDF（各约 500B，路径 pdfs/__probe-*.pdf）。
-- 缺删除策略时 API 删不掉，这里随本次脚本一并清掉，执行一次即可。
delete from storage.objects
where bucket_id = 'covers' and name like 'pdfs/__probe-%';
