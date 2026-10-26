-- 단어장 — question_sets.kind 추가 (2026-10-25)
--
-- 단어장은 따로 표를 만들지 않고 문제집 한 종류로 저장한다 (lib/vocab/cards.ts 참고):
--   question_sets.kind   = 'vocab'  (보통 문제집은 'quiz')
--   questions.question_text = 용어, questions.answer = 뜻, questions.type = 'CHOICE'
--   questions.options    = 뜻 + 다른 카드의 뜻 3개 (저장할 때 자동으로 채운다)
-- 그래서 단어장도 모든 게임·공부 모드에서 객관식 문제집처럼 그대로 쓰인다.
-- 학생 공부 화면(/cards/<공유 코드>)과 단어장 편집기(/teacher/vocab/...)만 kind 를 본다.
--
-- 실행 전에는 단어장 저장이 "DB 업데이트가 필요해요" 오류로 막히고, 나머지 기능은 그대로 동작한다.

ALTER TABLE public.question_sets
  ADD COLUMN IF NOT EXISTS kind TEXT NOT NULL DEFAULT 'quiz';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'question_sets_kind_check'
      AND conrelid = 'public.question_sets'::regclass
  ) THEN
    ALTER TABLE public.question_sets
      ADD CONSTRAINT question_sets_kind_check CHECK (kind IN ('quiz', 'vocab'));
  END IF;
END $$;

-- PostgREST 가 새 컬럼을 바로 알아보게 스키마 캐시를 새로 읽힌다.
NOTIFY pgrst, 'reload schema';
