# 보안 노트

> 2026-06 코드 점검 중 정리. 운영 DB(`mffcnudolyxlsakrvvhv`)에 직접 적용한 변경은 없음.

## 0. 배포 모델 (의도된 결정)

**로그인/회원가입을 일부러 두지 않음** — 누구나 마찰 없이 바로 체험하게 하는 것이 목표. 배포는 **이미 인증된 교사 커뮤니티** 안에 한정해서 뿌림(외부 게이트 역할). 따라서 아래 "DB 공개" 리스크 중 *불특정 외부인의 그리핑/스크래핑*은 실질적으로 크게 완화됨. 인증 도입은 이 목표와 상충하므로 **현 단계에서는 채택하지 않음.**

남는 실질 리스크는 ① 수업 중 학생 부정행위(정답 엿보기/점수 조작) ② anon 키가 번들에 공개되어 URL이 커뮤니티 밖으로 새면 접근 가능, 두 가지. 체험 단계에서는 수용 가능으로 판단.

### 로그인 없이 하는 무마찰 안전장치 (권장 우선순위)
1. **Supabase 자동 백업/PITR 활성화** — 데이터 삭제(실수·장난) 복구 보험. 그리핑의 유일한 비가역 피해 대비. *체험 배포면 최우선.*
2. **비용 알림** — Gemini/OpenAI 콘솔 + Supabase에 사용량/청구 한도 알림. (AI 라우트엔 이미 레이트리밋·횟수상한 적용됨 — 2번 항목.)
3. **(선택) 점수 쓰기·정답 비교를 SECURITY DEFINER RPC로 이전** — 로그인 없이 게임 무결성만 강화. 정답 채점(`check_question_answer`)은 이미 RPC. 체험 단계엔 필수 아님.

아래 1번은 "나중에 본격 서비스로 키울 때"의 근본책으로 보관.

## 1. (참고) 인증 없음 + RLS 비활성 = DB 전면 공개

### 현황
- 앱에 **Supabase Auth(로그인)가 전혀 없습니다.** 교사·학생 모두 브라우저에 배포되는 **공개 anon 키**로 DB에 직접 접근합니다.
- 소유자 식별 컬럼(`teacher_id`/`user_id` 등)이 **없습니다.**
- 핵심 테이블(`questions`, `rooms`, `players`, `question_sets`)의 **RLS가 꺼져 있고**, anon 롤에 `SELECT/INSERT/UPDATE/DELETE`가 전부 부여돼 있습니다. (`sql/full_schema.sql`, `sql/20260505_fix_core_rls.sql`)

### 영향 (브라우저 콘솔에서 누구나 가능)
- `supabase.from('questions').select('answer')` → **전체 정답 조회.** 앱의 정답 숨김(`listQuestionsForGame`이 answer 제외)과 서버 채점 RPC(`check_question_answer`)가 **무력화**됩니다.
- `supabase.from('players').update({ gold: 999999 }).eq('id', ...)` → **점수/골드 임의 조작.**
- `supabase.from('rooms').delete()`, 남의 `question_sets` 수정/삭제 → **데이터 파괴/그리핑.**

### 왜 부분 차단이 안 되는가
인증이 없어 **DB 레이어에서 교사와 학생을 구분할 수 없습니다.** 또한 교사의 정상 기능이 anon 권한에 의존합니다:
- 교사 문제집/문제 삭제: `deleteQuestionSet`, `deleteQuestion` → anon `DELETE` 필요 (`lib/services/questionSets.ts`)
- 교사 편집/분석에서 정답 조회: `listQuestionsForAnalytics` → anon `SELECT answer` 필요
- 점수 기록: 학생이 자기 `players` 행을 `UPDATE` 해야 게임이 동작

따라서 answer 컬럼을 막거나 DELETE를 회수하면 **교사 기능이 깨집니다.** 토큰 수준의 임시방편은 실효성이 낮습니다.

### 권장 해결 (근본책, 별도 작업)
1. **교사 Supabase Auth 도입** (이메일/매직링크 등).
2. `question_sets`, `rooms`에 `owner_id uuid references auth.users` 추가.
3. RLS 활성 + 정책:
   - `question_sets`/`questions`: 공개 SELECT는 게임에 필요한 컬럼만(아래 4 참고), 쓰기/삭제는 `owner_id = auth.uid()`.
   - `rooms`: 생성/수정/삭제는 owner만, 읽기는 게임 진행에 필요한 범위.
   - `players`: 학생은 익명이므로 별도 토큰 전략 필요(예: 입장 시 발급한 player 토큰을 RPC로 검증). 점수 변경은 **서버 RPC(SECURITY DEFINER)** 로만 수행하도록 이전.
4. **정답 컬럼 보호**: 게임용 조회는 answer를 제외한 컬럼만 노출하고, 채점은 이미 있는 `check_question_answer` RPC로만. 교사 편집/분석의 answer 접근은 인증된 경로(서버 라우트 + service_role, 또는 owner RLS)로 이전.

> ⚠️ 위 작업 전까지는 "정답 유출·점수 조작·삭제가 기술적으로 가능한 공개 DB"임을 인지하고 운영하세요. 데이터가 닉네임/점수 위주라 PII 위험은 낮고 수업용으로 휘발성이지만, 부정행위·그리핑 벡터는 실재합니다.

### 배포 전 확인 (대시보드)
- Supabase → **Advisors → Security**: RLS 비활성 테이블 경고 확인.
- Supabase → **Auth → Policies**: 위 4개 테이블 정책 상태 확인.

## 2. 🟠 AI 문제생성 API — ✅ 이번에 완화 적용됨

`app/api/generate-questions/route.ts`:
- **동일 출처(Origin/Referer) 검증** — 외부 사이트/스크립트 호출 차단.
- **IP 레이트리밋** (60초 10회). 단, 서버리스에서는 인스턴스별 메모리라 분산 환경에선 느슨함 → 트래픽이 커지면 Upstash/Redis 등 공유 스토어 기반으로 교체 권장.
- **questionCount 상한 20** — 호출당 AI 비용 상한.

남은 권장: 더 강한 보호가 필요하면 (a) 교사 인증 후 호출 허용, (b) 공유 스토어 레이트리밋, (c) 일일 호출 쿼터.
