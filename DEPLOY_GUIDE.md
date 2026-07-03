# 🚀 배포 가이드

## 1. Supabase 설정 (5분)

### 1.1 프로젝트 생성
1. [Supabase](https://supabase.com) 가입/로그인
2. "New Project" 클릭
3. 프로젝트 이름: `pureandcore`
4. 비밀번호 설정 (잘 기억해두세요)
5. Region: `Northeast Asia (Seoul)` 선택

### 1.2 테이블 생성
1. 좌측 메뉴 > SQL Editor
2. `supabase-setup.sql` 내용 전체 복사
3. 붙여넣고 "Run" 클릭

### 1.3 API 키 확인
1. 좌측 메뉴 > Settings > API
2. 복사 필요:
   - `Project URL` (예: https://xxxxx.supabase.co)
   - `anon public` 키

## 2. Vercel 배포 (5분)

### 2.1 GitHub 업로드
```bash
git init
git add .
git commit -m "Initial commit"
git branch -M main
git remote add origin https://github.com/YOUR_USERNAME/pureandcore.git
git push -u origin main
```

### 2.2 Vercel 연동
1. [Vercel](https://vercel.com) 가입/로그인
2. "Import Project" > GitHub 연동
3. Repository 선택: `pureandcore`

### 2.3 환경변수 설정
Vercel 프로젝트 > Settings > Environment Variables 추가:

```
NEXT_PUBLIC_SUPABASE_URL = [Supabase Project URL]
NEXT_PUBLIC_SUPABASE_ANON_KEY = [Supabase anon key]
```

### 2.4 배포
1. "Deploy" 클릭
2. 1-2분 후 완료
3. 도메인 확인: `https://pureandcore.vercel.app`

## 3. 커스텀 도메인 연결 (옵션)

### 가비아/카페24 등에서 구매한 도메인
1. Vercel > Settings > Domains
2. 도메인 입력: `pureandcore.kr`
3. DNS 설정:
   - A 레코드: `76.76.21.21`
   - CNAME: `cname.vercel-dns.com`

## 4. 모니터링 설정

### 4.1 Supabase 대시보드
- Table Editor에서 실시간 데이터 확인
- Authentication > Logs에서 접속 로그

### 4.2 Vercel Analytics (무료)
- 자동 활성화
- 방문자 통계, 페이지 성능 확인

## 5. 알림 설정 (옵션)

### 이메일 알림
Supabase > Database > Functions에서 트리거 생성 가능

### Slack 알림
1. Slack Webhook URL 생성
2. Vercel 환경변수에 추가
3. Edge Function으로 알림 전송

## 🎉 완료!

배포 완료 후:
1. 폼 제출 테스트
2. Supabase Dashboard에서 데이터 확인
3. 실제 도메인으로 접속 테스트

문제 발생시:
- Supabase Logs 확인
- Vercel Functions 로그 확인
- 브라우저 콘솔 에러 체크