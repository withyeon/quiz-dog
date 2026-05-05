-- ============================================
-- QuizDog developer sample data
-- ============================================
-- 테스트/개발용 문제집과 방 데이터를 생성합니다.
-- full_schema.sql 또는 최신 스키마 적용 후 실행하세요.

BEGIN;

-- ============================================
-- 1. 개발자용 문제집 메타데이터
-- ============================================

INSERT INTO public.question_sets (
  id,
  title,
  description,
  subject,
  grade,
  tags
)
VALUES (
  'set-integrated-dev-dummy-20260505',
  '개발자 상식 더미 문제집',
  'QuizDog 기능 점검용 개발자 테마 더미 데이터입니다. 객관식, OX, 주관식, 빈칸 문제를 함께 저장합니다.',
  '기타',
  '기타',
  '["개발자", "테스트", "더미데이터", "혼합유형"]'::jsonb
)
ON CONFLICT (id) DO UPDATE
SET
  title = EXCLUDED.title,
  description = EXCLUDED.description,
  subject = EXCLUDED.subject,
  grade = EXCLUDED.grade,
  tags = EXCLUDED.tags,
  updated_at = NOW();

-- 기존 같은 세트 문제는 지우고 다시 적재해 재실행 시에도 동일 상태를 보장합니다.
DELETE FROM public.questions
WHERE set_id = 'set-integrated-dev-dummy-20260505';

-- ============================================
-- 2. 개발자용 문제 데이터
-- ============================================

INSERT INTO public.questions (
  set_id,
  type,
  question_text,
  options,
  answer
)
VALUES
  (
    'set-integrated-dev-dummy-20260505',
    'CHOICE',
    'HTTP 상태 코드 404가 의미하는 것은?',
    '["Bad Request", "Unauthorized", "Not Found", "Internal Server Error"]'::jsonb,
    'Not Found'
  ),
  (
    'set-integrated-dev-dummy-20260505',
    'CHOICE',
    'Git에서 원격 저장소의 최신 변경을 가져오고 현재 브랜치에 병합하는 명령은?',
    '["git push", "git pull", "git reset", "git stash"]'::jsonb,
    'git pull'
  ),
  (
    'set-integrated-dev-dummy-20260505',
    'CHOICE',
    'SQL에서 여러 행을 조건으로 걸러낼 때 주로 사용하는 절은?',
    '["ORDER BY", "GROUP BY", "WHERE", "LIMIT"]'::jsonb,
    'WHERE'
  ),
  (
    'set-integrated-dev-dummy-20260505',
    'CHOICE',
    'React에서 리스트 렌더링 시 각 항목에 안정적으로 넣어야 하는 prop은?',
    '["ref", "name", "key", "value"]'::jsonb,
    'key'
  ),
  (
    'set-integrated-dev-dummy-20260505',
    'OX',
    'TypeScript는 JavaScript의 상위 호환 언어다.',
    '["O", "X"]'::jsonb,
    'O'
  ),
  (
    'set-integrated-dev-dummy-20260505',
    'OX',
    'const로 선언한 객체는 내부 속성도 절대 수정할 수 없다.',
    '["O", "X"]'::jsonb,
    'X'
  ),
  (
    'set-integrated-dev-dummy-20260505',
    'SHORT',
    '분산 버전 관리 시스템으로 가장 널리 쓰이는 도구 이름은?',
    '[]'::jsonb,
    'Git'
  ),
  (
    'set-integrated-dev-dummy-20260505',
    'SHORT',
    '웹 브라우저가 HTML, CSS, JavaScript를 해석해 화면을 그리는 과정을 보통 무엇이라고 부르나요?',
    '[]'::jsonb,
    '렌더링'
  ),
  (
    'set-integrated-dev-dummy-20260505',
    'BLANK',
    'REST API에서 서버 내부 오류를 뜻하는 대표 상태 코드는 {{blank}}입니다.',
    '[]'::jsonb,
    '500'
  ),
  (
    'set-integrated-dev-dummy-20260505',
    'BLANK',
    'SQL에서 모든 컬럼을 조회할 때는 SELECT {{blank}} FROM 테이블; 형태를 사용합니다.',
    '[]'::jsonb,
    '*'
  ),
  (
    'set-integrated-dev-dummy-20260505',
    'CHOICE',
    'JSON에서 배열을 나타내는 기호는?',
    '["{ }", "( )", "[ ]", "< >"]'::jsonb,
    '[ ]'
  ),
  (
    'set-integrated-dev-dummy-20260505',
    'BLANK',
    'Unix 계열 터미널에서 현재 작업 디렉터리를 출력하는 명령은 {{blank}} 입니다.',
    '[]'::jsonb,
    'pwd'
  );

-- ============================================
-- 3. 테스트용 방 생성
-- ============================================

INSERT INTO public.rooms (
  room_code,
  status,
  current_q_index,
  game_mode,
  set_id
)
VALUES
  ('DEV001', 'waiting', 0, 'gold_quest', 'set-integrated-dev-dummy-20260505'),
  ('DEVDOWN', 'waiting', 0, 'dontlookdown', 'set-integrated-dev-dummy-20260505')
ON CONFLICT (room_code) DO UPDATE
SET
  status = EXCLUDED.status,
  current_q_index = EXCLUDED.current_q_index,
  game_mode = EXCLUDED.game_mode,
  set_id = EXCLUDED.set_id,
  updated_at = NOW();

COMMIT;
