// Vercel Serverless Function — 클라이언트에 Supabase 공개 설정 주입
// (anon 키는 원래 브라우저에 공개되는 값이라 노출돼도 안전; 접근 제어는 RLS가 담당)

export default function handler(req, res) {
  // 이름 두 가지 규칙 모두 허용 (NEXT_PUBLIC_ 접두사 유무)
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || '';
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY || '';

  // 진단용: /api/env-config?debug=1
  //  → 값은 절대 노출하지 않고, "SUPABASE"가 포함된 환경변수 '이름'만 보여줌
  const isDebug = (req.query && req.query.debug === '1') || /[?&]debug=1(?:&|$)/.test(req.url || '');
  if (isDebug) {
    const matchingEnvNames = Object.keys(process.env).filter((k) => /SUPABASE/i.test(k));
    res.status(200).json({
      matchingEnvNames,   // 예: ["NEXT_PUBLIC_SUPABASE_URL", "NEXT_PUBLIC_SUPABASE_ANON_KEY"]
      hasUrl: !!url,
      hasKey: !!key
    });
    return;
  }

  res.status(200).json({
    SUPABASE_URL: url,
    SUPABASE_ANON_KEY: key
  });
}
