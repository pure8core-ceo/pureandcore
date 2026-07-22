-- =========================================================
-- 사이트 브랜드 설정 (로고 / 기업명)
--   · 관리자 페이지 "설정" 탭에서 수정
--   · 공개 홈페이지가 읽어서 네비/푸터/파비콘에 반영
-- 안전하게 여러 번 실행 가능 (idempotent)
-- =========================================================

create table if not exists public.site_settings (
  key         text primary key,
  value       text,
  updated_at  timestamptz not null default now()
);

alter table public.site_settings enable row level security;

-- 공개 읽기: 방문자 홈페이지가 브랜드 정보를 읽어야 하므로 누구나 SELECT 허용
drop policy if exists "site_settings public read" on public.site_settings;
create policy "site_settings public read"
  on public.site_settings for select
  using (true);

-- 쓰기: 로그인한 관리자만 (anon 차단)
drop policy if exists "site_settings admin insert" on public.site_settings;
create policy "site_settings admin insert"
  on public.site_settings for insert to authenticated
  with check (true);

drop policy if exists "site_settings admin update" on public.site_settings;
create policy "site_settings admin update"
  on public.site_settings for update to authenticated
  using (true) with check (true);

-- 기본값 시드 (이미 있으면 그대로 둠)
insert into public.site_settings (key, value) values
  ('brand_name', '맑음'),
  ('brand_sub',  'air care'),
  ('logo_url',   ''),
  ('biz_name',   '(주)맑음 에어케어'),
  ('biz_ceo',    '000'),
  ('biz_reg_no', '000-00-00000'),
  ('contact_phone', '1600-0000'),
  ('contact_hours', '평일 09:00 – 19:00'),
  ('kakao_url',     ''),
  ('rating_score',      '4.9'),
  ('review_count',      '3,214'),
  ('hero_review_count', '3,200+')
on conflict (key) do nothing;
