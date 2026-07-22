// 방문 추적 (트래픽 분석용)
// 페이지가 열릴 때 page_views 테이블에 방문 기록을 1건 남긴다.
(function () {
  // 브라우저별 익명 세션 ID (30분 유지) — 순 방문자 계산용
  function getSessionId() {
    const KEY = 'mac_sid';
    const TTL = 30 * 60 * 1000; // 30분
    let raw = null;
    try { raw = localStorage.getItem(KEY); } catch (e) { /* 프라이빗 모드 등 */ }

    let sid, ts;
    if (raw) {
      const parts = raw.split('.');
      sid = parts[0];
      ts = parseInt(parts[1], 10);
    }

    const now = Date.now();
    if (!sid || !ts || now - ts > TTL) {
      // 새 세션 ID 생성
      sid = (crypto && crypto.randomUUID)
        ? crypto.randomUUID()
        : 's-' + now.toString(36) + Math.random().toString(36).slice(2, 10);
    }
    try { localStorage.setItem(KEY, sid + '.' + now); } catch (e) { /* noop */ }
    return sid;
  }

  function getDevice() {
    const ua = navigator.userAgent || '';
    if (/iPad|Tablet/i.test(ua)) return 'tablet';
    if (/Mobi|Android|iPhone/i.test(ua)) return 'mobile';
    return 'desktop';
  }

  async function track() {
    let client = null;
    try {
      client = await window.appReady; // init-config.js 가 설정 로드 후 resolve
    } catch (e) { /* noop */ }
    if (!client) return; // Supabase 미설정 시 조용히 종료

    const params = new URLSearchParams(window.location.search);
    const record = {
      session_id: getSessionId(),
      path: window.location.pathname || '/',
      referrer: document.referrer || 'direct',
      utm_source: params.get('utm_source') || 'direct',
      utm_medium: params.get('utm_medium') || 'none',
      utm_campaign: params.get('utm_campaign') || 'none',
      device: getDevice(),
      user_agent: (navigator.userAgent || '').slice(0, 300)
    };

    try {
      const { error } = await client.from('page_views').insert([record]);
      if (error) console.warn('page_view 기록 실패:', error.message);
    } catch (e) {
      console.warn('page_view 기록 예외:', e);
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', track);
  } else {
    track();
  }
})();
