-- ============================================
-- QuizDog developer sample data
-- ============================================
-- 테스트/개발용 문제집과 방 데이터를 생성합니다.
-- full_schema.sql 또는 최신 스키마 적용 후 실행하세요.

BEGIN;

-- ============================================
-- 1. 교사용 문제집 메타데이터
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
  '교사 상식 퀴즈',
  'QuizDog 기능 점검용 쉬운 교사 상식 문제집입니다. 객관식, OX, 주관식, 빈칸 문제를 함께 저장합니다.',
  '기타',
  '기타',
  '["교사", "상식", "테스트", "쉬움", "혼합유형"]'::jsonb
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
-- 2. 교사용 문제 데이터
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
    '수업 시작 전에 가장 먼저 확인하면 좋은 것은?',
    '["출석과 수업 준비", "급식 메뉴", "운동장 모래", "학교 종"]'::jsonb,
    '출석과 수업 준비'
  ),
  (
    'set-integrated-dev-dummy-20260505',
    'CHOICE',
    '학생이 다쳤을 때 가장 먼저 해야 할 일은?',
    '["안전 상태 확인", "숙제 검사", "자리 바꾸기", "칠판 지우기"]'::jsonb,
    '안전 상태 확인'
  ),
  (
    'set-integrated-dev-dummy-20260505',
    'CHOICE',
    '학생 이름과 출결을 기록하는 데 주로 쓰는 것은?',
    '["출석부", "운동화", "우산", "물통"]'::jsonb,
    '출석부'
  ),
  (
    'set-integrated-dev-dummy-20260505',
    'CHOICE',
    '학부모에게 학교 안내 내용을 전달할 때 많이 사용하는 것은?',
    '["가정통신문", "체육복", "분필 상자", "교실 시계"]'::jsonb,
    '가정통신문'
  ),
  (
    'set-integrated-dev-dummy-20260505',
    'OX',
    '교사는 학생의 질문을 끝까지 듣고 답해 주는 것이 좋다.',
    '["O", "X"]'::jsonb,
    'O'
  ),
  (
    'set-integrated-dev-dummy-20260505',
    'OX',
    '복도에서 뛰는 학생을 보면 안전을 위해 천천히 걷도록 안내하는 것이 좋다.',
    '["O", "X"]'::jsonb,
    'O'
  ),
  (
    'set-integrated-dev-dummy-20260505',
    'OX',
    '시험지를 나눠 줄 때 정답지도 함께 나눠 주는 것이 좋다.',
    '["O", "X"]'::jsonb,
    'X'
  ),
  (
    'set-integrated-dev-dummy-20260505',
    'SHORT',
    '학생이 아프다고 할 때 도움을 받을 수 있는 학교 장소는?',
    '[]'::jsonb,
    '보건실'
  ),
  (
    'set-integrated-dev-dummy-20260505',
    'SHORT',
    '수업 시간에 선생님이 설명을 적는 큰 판은?',
    '[]'::jsonb,
    '칠판'
  ),
  (
    'set-integrated-dev-dummy-20260505',
    'BLANK',
    '수업을 시작할 때 학생이 왔는지 확인하는 일을 {{blank}} 확인이라고 합니다.',
    '[]'::jsonb,
    '출석'
  ),
  (
    'set-integrated-dev-dummy-20260505',
    'BLANK',
    '학생이 잘한 일을 발견하면 {{blank}}해 주면 좋습니다.',
    '[]'::jsonb,
    '칭찬'
  ),
  (
    'set-integrated-dev-dummy-20260505',
    'CHOICE',
    '교실에서 불이 났을 때 가장 알맞은 행동은?',
    '["선생님 안내에 따라 대피하기", "혼자 숨어 있기", "창문만 닫기", "책상 정리하기"]'::jsonb,
    '선생님 안내에 따라 대피하기'
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
