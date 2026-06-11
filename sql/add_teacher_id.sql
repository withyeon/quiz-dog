-- question_sets 테이블에 teacher_id 컬럼 추가
-- 기존 데이터는 NULL로 유지 (공개 상태)
-- 신규 생성 문제집에는 로그인한 선생님의 auth.users.id가 저장됨

ALTER TABLE question_sets
  ADD COLUMN IF NOT EXISTS teacher_id UUID REFERENCES auth.users(id) ON DELETE SET NULL;

-- 인덱스 (선생님별 문제집 조회 최적화)
CREATE INDEX IF NOT EXISTS idx_question_sets_teacher_id ON question_sets(teacher_id);
