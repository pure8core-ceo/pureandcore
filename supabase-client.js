// Supabase 클라이언트 초기화
// CDN 버전 사용 (별도 패키지 설치 없이 바로 사용)
// 주의: CDN 전역이 window.supabase 이므로, 내부 변수는 sbClient 로 둔다(이름 충돌 방지).

let sbClient = null;

// Supabase 초기화 함수
function initSupabase() {
  if (!window.supabase) {
    console.error('Supabase SDK not loaded');
    return null;
  }

  // 환경변수 또는 직접 입력 (배포시 환경변수 사용 권장)
  const SUPABASE_URL = window.SUPABASE_URL || 'YOUR_SUPABASE_URL';
  const SUPABASE_ANON_KEY = window.SUPABASE_ANON_KEY || 'YOUR_SUPABASE_ANON_KEY';

  sbClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  return sbClient;
}

// 상담 신청 저장
async function saveConsultation(data) {
  if (!sbClient) {
    sbClient = initSupabase();
  }

  try {
    // UTM 파라미터 수집
    const urlParams = new URLSearchParams(window.location.search);
    const utmData = {
      utm_source: urlParams.get('utm_source') || 'direct',
      utm_medium: urlParams.get('utm_medium') || 'none',
      utm_campaign: urlParams.get('utm_campaign') || 'none',
      referrer: document.referrer || 'direct'
    };

    // 실제 테이블 컬럼만 담는다.
    // (폼 필드명 area/movein/type/date 는 컬럼이 아니므로 spread 하지 않고 매핑만)
    const consultationData = {
      name: data.name,
      phone: data.phone,
      address: data.address || null,
      property_type: data.type || '아파트',
      size: data.area || data.size || null,
      desired_date: data.movein || data.date || null,
      message: data.message || null,
      status: 'NEW',
      ...utmData
    };

    // Supabase에 저장
    // 주의: anon 권한으로 .select()를 붙이면 SELECT RLS(인증 사용자만)에 걸리므로
    //       반환값 없이 INSERT만 수행한다.
    const { error } = await sbClient
      .from('consultations')
      .insert([consultationData]);

    if (error) {
      console.error('Supabase error:', error);
      return { success: false, error: error.message };
    }

    // 성공시 알림 (옵션: Webhook 호출)
    sendNotification(consultationData);

    return { success: true };
  } catch (error) {
    console.error('Error saving consultation:', error);
    return { success: false, error: error.message };
  }
}

// 알림 전송 (옵션)
async function sendNotification(consultation) {
  // Slack, Email, 카카오톡 등 알림 구현
  // Vercel Functions 또는 Supabase Edge Functions 활용
  console.log('New consultation:', consultation);

  // 예시: 간단한 웹훅 호출
  if (window.SLACK_WEBHOOK_URL) {
    fetch(window.SLACK_WEBHOOK_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        text: `🔔 새로운 상담 신청\n이름: ${consultation.name}\n연락처: ${consultation.phone}\n주소: ${consultation.address}`
      })
    }).catch(console.error);
  }
}

// 전역 객체로 내보내기
window.consultationAPI = {
  init: initSupabase,
  save: saveConsultation,
  // 초기화된 클라이언트 재사용 (analytics.js 등에서 사용)
  getClient: () => sbClient || initSupabase()
};