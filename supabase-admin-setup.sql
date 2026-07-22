-- ============================================================
-- 어드민 페이지용 추가 설정
-- Supabase Dashboard > SQL Editor 에서 실행하세요.
-- (기존 consultations 테이블은 그대로 두고, 아래만 추가 실행)
-- ============================================================

-- ------------------------------------------------------------
-- 1) 방문 기록(트래픽) 테이블
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS page_views (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('Asia/Seoul', NOW()),

  -- 방문 세션 (브라우저별 익명 식별자)
  session_id TEXT,

  -- 페이지 정보
  path TEXT,
  referrer TEXT,

  -- 유입 경로 (UTM)
  utm_source   TEXT,
  utm_medium   TEXT,
  utm_campaign TEXT,

  -- 방문 환경
  device TEXT,          -- mobile | tablet | desktop
  user_agent TEXT
);

CREATE INDEX IF NOT EXISTS idx_page_views_created_at ON page_views(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_page_views_session    ON page_views(session_id);
CREATE INDEX IF NOT EXISTS idx_page_views_utm_source ON page_views(utm_source);

-- RLS: 누구나 방문 기록 남기기(INSERT) 가능, 조회는 로그인한 관리자만
ALTER TABLE page_views ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow public insert pageview" ON page_views;
CREATE POLICY "Allow public insert pageview" ON page_views
  FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "Allow authenticated select pageview" ON page_views;
CREATE POLICY "Allow authenticated select pageview" ON page_views
  FOR SELECT USING (auth.role() = 'authenticated');

-- ------------------------------------------------------------
-- 2) 상담 상태 값 참고 (코드에서 사용하는 status 문자열)
--    NEW        : 신규 접수
--    CONTACTED  : 상담 중 (연락함)
--    BOOKED     : 시공 예약 확정
--    DONE       : 시공 완료
--    CANCELLED  : 취소/보류
-- ------------------------------------------------------------

-- ------------------------------------------------------------
-- 3) 관리자 계정 만들기 (둘 중 하나)
--    (A) Supabase Dashboard > Authentication > Users > "Add user"
--        에서 이메일/비밀번호로 직접 생성  ← 가장 간단, 권장
--    (B) 아래처럼 SQL 로는 만들 수 없으니 대시보드 UI 를 이용하세요.
-- ------------------------------------------------------------
