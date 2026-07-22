-- =========================================================
-- 이미지 저장소 (Supabase Storage)
--   · 로고 / 히어로 배경 / 시공현장(CASE) 사진 / 리뷰 사진
--   · 관리자(로그인)만 업로드·수정·삭제, 누구나 읽기(public 버킷)
--   · 이미지를 base64 로 DB에 넣지 않고 Storage URL 만 저장
-- 안전하게 여러 번 실행 가능 (idempotent)
-- =========================================================

-- 1) 공개 버킷 생성
insert into storage.buckets (id, name, public)
values ('site-assets', 'site-assets', true)
on conflict (id) do update set public = true;

-- 2) storage.objects RLS 정책 (site-assets 버킷 한정)
--    공개 읽기
drop policy if exists "site-assets public read" on storage.objects;
create policy "site-assets public read"
  on storage.objects for select
  using (bucket_id = 'site-assets');

--    관리자 업로드
drop policy if exists "site-assets admin insert" on storage.objects;
create policy "site-assets admin insert"
  on storage.objects for insert to authenticated
  with check (bucket_id = 'site-assets');

--    관리자 수정(덮어쓰기)
drop policy if exists "site-assets admin update" on storage.objects;
create policy "site-assets admin update"
  on storage.objects for update to authenticated
  using (bucket_id = 'site-assets')
  with check (bucket_id = 'site-assets');

--    관리자 삭제
drop policy if exists "site-assets admin delete" on storage.objects;
create policy "site-assets admin delete"
  on storage.objects for delete to authenticated
  using (bucket_id = 'site-assets');
