-- =========================================================
-- 시공 후기(리뷰) 테이블
--   · 관리자 페이지 "리뷰" 탭에서 작성/수정/삭제
--   · 공개 홈페이지 "실사용 후기" 영역에 게시된 리뷰만 노출
-- 안전하게 여러 번 실행 가능 (idempotent)
-- =========================================================

create table if not exists public.reviews (
  id            bigint generated always as identity primary key,
  name          text not null,
  meta          text,
  tag           text,
  rating        int  not null default 5,
  review_date   text,
  body          text not null,
  photo_url     text,
  is_published  boolean not null default true,
  created_at    timestamptz not null default now()
);

alter table public.reviews enable row level security;

-- 공개 읽기: 게시(is_published=true)된 리뷰만 누구나 SELECT
drop policy if exists "reviews public read" on public.reviews;
create policy "reviews public read"
  on public.reviews for select
  using (is_published = true);

-- 관리자: 전체 읽기 (숨김 포함)
drop policy if exists "reviews admin read" on public.reviews;
create policy "reviews admin read"
  on public.reviews for select to authenticated
  using (true);

-- 관리자: 작성 / 수정 / 삭제
drop policy if exists "reviews admin insert" on public.reviews;
create policy "reviews admin insert"
  on public.reviews for insert to authenticated
  with check (true);

drop policy if exists "reviews admin update" on public.reviews;
create policy "reviews admin update"
  on public.reviews for update to authenticated
  using (true) with check (true);

drop policy if exists "reviews admin delete" on public.reviews;
create policy "reviews admin delete"
  on public.reviews for delete to authenticated
  using (true);

-- 기본 후기 시드 (테이블이 비어 있을 때만 삽입)
insert into public.reviews (name, meta, tag, rating, review_date, body, is_published, created_at)
select v.name, v.meta, v.tag, v.rating, v.review_date, v.body, true, v.created_at
from (values
  ('김O은', '34평 · 서울 마포 · 신축 아파트', '신축',     5, '2026.06', '입주 전 측정에서 포름알데히드가 기준의 3배였는데, 시공 후 재측정 리포트를 직접 보여주셔서 믿음이 갔어요. 새 가구 냄새가 확 줄었습니다.', timestamptz '2026-06-15 09:00:00+09'),
  ('박O호', '24평 · 경기 성남 · 리모델링',   '리모델링', 5, '2026.06', '리모델링 후 페인트 냄새가 너무 심했는데 베이크아웃 하루 만에 코가 편해졌어요. 아이가 재채기하던 게 사라진 게 제일 좋습니다.', timestamptz '2026-06-10 09:00:00+09'),
  ('이O진', '32평 · 인천 송도 · 아파트',     '아파트',   5, '2026.05', '측정부터 시공, 재측정까지 과정 하나하나 설명해주셔서 안심됐어요. 감으로 하는 게 아니라 데이터로 보여주니 확실히 신뢰가 갑니다.', timestamptz '2026-05-20 09:00:00+09'),
  ('최O아', '18평 · 서울 강서 · 신혼집',     '신축',     5, '2026.05', '신혼집이라 더 신경 쓰였는데 친환경 자재만 쓰신다고 해서 선택했어요. 시공 다음 날 바로 입주했는데 냄새가 거의 안 났습니다.', timestamptz '2026-05-10 09:00:00+09'),
  ('정O석', '45평 · 서울 송파 · 아파트',     '아파트',   5, '2026.04', '넓은 평수라 걱정했는데 구역별로 꼼꼼히 시공해주셨어요. 결과 브리핑까지 대면으로 해주셔서 만족도가 높습니다. 추천해요.', timestamptz '2026-04-15 09:00:00+09'),
  ('한O림', '오피스 60평 · 서울 강남',        '오피스',   5, '2026.04', '사무실 인테리어 후 직원들이 두통을 호소해서 의뢰했어요. 시공 후 확실히 공기가 가벼워졌다는 피드백이 많았습니다.', timestamptz '2026-04-05 09:00:00+09'),
  ('윤O우', '28평 · 대전 유성 · 리모델링',   '리모델링', 5, '2026.03', '가격도 투명하게 안내해주시고 추가 비용 없이 견적 그대로 진행됐어요. A/S 보증까지 있어서 더 든든합니다.', timestamptz '2026-03-15 09:00:00+09'),
  ('서O연', '39평 · 부산 해운대 · 신축',     '신축',     5, '2026.03', '반려묘가 있어서 안전성이 제일 걱정이었는데 무독성 자재라 안심했어요. 시공 후 아이(고양이)도 활발해진 것 같아요 :)', timestamptz '2026-03-05 09:00:00+09'),
  ('조O민', '오피스 40평 · 경기 판교',        '오피스',   5, '2026.02', '스타트업 사무실 이전하면서 진행했어요. 주말에 맞춰 시공해주셔서 업무 공백 없이 깔끔하게 끝났습니다.', timestamptz '2026-02-15 09:00:00+09')
) as v(name, meta, tag, rating, review_date, body, created_at)
where not exists (select 1 from public.reviews);
