// 환경변수 자동 로드 및 초기화
// window.appReady : 설정 로드 + Supabase 초기화가 끝나면 클라이언트로 resolve 되는 Promise
window.appReady = (async function initializeApp() {
  try {
    // Vercel 배포시 환경변수 가져오기
    if (!window.SUPABASE_URL || window.SUPABASE_URL === 'YOUR_SUPABASE_URL') {
      const response = await fetch('/api/env-config');
      if (response.ok) {
        const config = await response.json();
        window.SUPABASE_URL = config.SUPABASE_URL;
        window.SUPABASE_ANON_KEY = config.SUPABASE_ANON_KEY;
      }
    }

    // Supabase 초기화
    if (window.consultationAPI) {
      window.consultationAPI.init();
      console.log('Supabase initialized successfully');
      return window.consultationAPI.getClient();
    }
  } catch (error) {
    console.error('Failed to initialize app:', error);
  }
  return null;
})();
