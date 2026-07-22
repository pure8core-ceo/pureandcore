-- Supabase Dashboard > SQL Editor에서 실행할 쿼리
-- ※ 여러 번 실행해도 안전하도록 작성됨 (IF NOT EXISTS / DROP POLICY IF EXISTS)

-- 상담 신청 테이블 생성
CREATE TABLE IF NOT EXISTS consultations (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('Asia/Seoul', NOW()),

  -- 고객 정보
  name VARCHAR(100) NOT NULL,
  phone VARCHAR(20) NOT NULL,
  address TEXT,

  -- 상담 상세
  property_type VARCHAR(50) DEFAULT '아파트',
  size VARCHAR(50),
  desired_date VARCHAR(100),
  message TEXT,

  -- 상태 관리
  status VARCHAR(20) DEFAULT 'NEW',
  assigned_to VARCHAR(100),
  notes TEXT,

  -- 마케팅 추적
  utm_source VARCHAR(100),
  utm_medium VARCHAR(100),
  utm_campaign VARCHAR(100),
  referrer TEXT
);

-- 인덱스 추가 (빠른 조회를 위해)
CREATE INDEX IF NOT EXISTS idx_consultations_created_at ON consultations(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_consultations_status ON consultations(status);
CREATE INDEX IF NOT EXISTS idx_consultations_phone ON consultations(phone);

-- RLS (Row Level Security) 활성화 (재실행해도 안전)
ALTER TABLE consultations ENABLE ROW LEVEL SECURITY;

-- 공개 INSERT 정책 (누구나 상담 신청 가능)
DROP POLICY IF EXISTS "Allow public insert" ON consultations;
CREATE POLICY "Allow public insert" ON consultations
  FOR INSERT WITH CHECK (true);

-- 관리자만 조회/수정 가능 (어드민 패널에서 로그인 후 사용)
DROP POLICY IF EXISTS "Allow authenticated select" ON consultations;
CREATE POLICY "Allow authenticated select" ON consultations
  FOR SELECT USING (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Allow authenticated update" ON consultations;
CREATE POLICY "Allow authenticated update" ON consultations
  FOR UPDATE USING (auth.role() = 'authenticated');

-- 실시간 구독을 위한 Publication (옵션, 이미 추가돼 있으면 조용히 건너뜀)
DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE consultations;
EXCEPTION
  WHEN duplicate_object THEN NULL;  -- 이미 등록됨
  WHEN undefined_object THEN NULL;  -- publication 이 없으면 건너뜀
END $$;
