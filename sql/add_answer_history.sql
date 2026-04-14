-- 학생들의 퀴즈 정답 내역을 저장하기 위한 JSONB 컬럼 추가
ALTER TABLE players
ADD COLUMN IF NOT EXISTS answer_history JSONB DEFAULT '[]'::jsonb;

-- 기존 데이터가 있다면 빈 배열 처리 가능성이 있으나 DEFAULT 설정으로 인해 null 방지
-- COMMENT ON COLUMN players.answer_history IS '[{ "questionIndex": 0, "isCorrect": true }] 형태의 정답 내역 저장';
