# SolveSync

프로그래머스 풀이 기록, 친구, 스터디룸을 연결하는 Next.js 16 + Supabase 애플리케이션입니다.

## 로컬 실행

```bash
npm install
npm run dev
```

브라우저에서 `http://localhost:3000`을 엽니다. 프로덕션 실행은 `npm run build && npm start`를 사용합니다.

## Supabase 설정

1. 새 프로젝트는 Supabase Dashboard의 **SQL Editor**에서 `supabase/schema.sql` 전체를 실행합니다. 기존 프로젝트에는 기능 SQL 적용 후 `supabase/security-hardening.sql`을 마지막으로 실행합니다.
2. **Authentication → Providers → Google**에서 Google 공급자를 활성화하고 Google OAuth Client ID와 Client Secret을 등록합니다.
3. Google Cloud Console의 승인된 리디렉션 URI에 아래 주소를 추가합니다.

```text
https://lfqwhwzinfwnqkahapox.supabase.co/auth/v1/callback
```

4. Supabase Authentication의 Redirect URLs에 아래 로컬 주소를 추가합니다.

```text
http://localhost:3000/auth/callback
https://solve-sync.vercel.app/auth/callback
```

5. `.env.local`에 다음 공개 환경 변수를 설정합니다.

```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project-ref.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=sb_publishable_your-key
```

`SUPABASE_SECRET_KEY`, DB 비밀번호, Google Client Secret은 브라우저에서 사용하는 `NEXT_PUBLIC_*` 변수에 절대 넣지 않습니다.

Vercel에는 확장 프로그램 이벤트 저장용 서버 전용 `SUPABASE_SECRET_KEY`도 등록합니다. 이 값은 클라이언트 코드나 GitHub에 커밋하지 않습니다.

## 주요 구조

- `app/` — Next.js App Router 페이지와 Route Handler
- `utils/supabase/` — 브라우저·서버·Proxy용 Supabase SSR 클라이언트
- `proxy.ts` — 인증 쿠키 갱신 및 보호 페이지 리디렉션
- `supabase/schema.sql` — 프로필, 고유 @핸들, 친구, 스터디 RLS 스키마
- `extension/` — 프로그래머스 풀이 감지 Chrome 확장 프로그램
- `app/api/events/programmers/accepted/` — 확장 프로그램 이벤트 수신 API

## 검증

```bash
npx tsc --noEmit
npm run build
```
