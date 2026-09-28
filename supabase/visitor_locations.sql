-- ============================================================
-- 访客地图：记录访客的城市级粗略坐标
-- ============================================================
-- 合规说明（个人信息保护法）：
--   - 只存 IP 解析出的「城市级」坐标（前端已四舍五入到 2 位小数，约 1km 精度）
--   - 不存 IP 地址、不存精确 GPS、不存任何可识别个人的信息
--   - 页面仅展示聚合散点，无法回溯到具体访客
create table if not exists visitor_locations (
  id bigint generated always as identity primary key,
  -- GCJ-02（火星坐标系），前端写入前已转换，腾讯地图直接可用
  lat double precision not null,
  lng double precision not null,
  city text,
  country text,
  created_at timestamptz not null default now()
);

alter table visitor_locations enable row level security;

-- 匿名访客可读（地图拉取散点）
create policy "anyone can read visitor locations"
  on visitor_locations for select
  using (true);

-- 匿名访客可写（上报自己的粗略坐标）；字段少且无个人信息，风险可控
create policy "anyone can insert visitor location"
  on visitor_locations for insert
  with check (true);

-- 常用查询：最近的足迹（地图组件用）
create index if not exists visitor_locations_created_at_idx
  on visitor_locations (created_at desc);
