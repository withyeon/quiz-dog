-- 공부 모드 · 해설 · 재도전 (2026-09-11)
--
-- 공부 모드(game_mode = 'study')는 게임 없이 문제만 차근차근 푸는 모드다.
-- 과제로 내기와 실시간 수업 양쪽에서 쓴다.
--   rooms.game_mode       — 'study'를 허용하도록 체크 제약을 다시 만든다.
--   rooms.settings        — 방 옵션(jsonb). 공부 모드는 settings.study 에
--                           { feedback: 'instant' | 'end', retryWrong, maxAttempts, questionOrder } 를 둔다.
--   players.attempts      — 학생의 시도 기록(jsonb 배열). 재도전을 허용한 과제에서 시도마다 쌓이고,
--                           players.score / answer_history 에는 최고 점수 시도가 복사된다.
--   questions.explanation — 해설(선택). 공부 모드의 정답 확인과 결과 화면의 복습에 보인다.
--
-- 모두 기본값(빈 객체 / NULL)이라 기존 방·문제의 동작은 바뀌지 않는다.

ALTER TABLE public.rooms
  ADD COLUMN IF NOT EXISTS settings jsonb NOT NULL DEFAULT '{}'::jsonb;

ALTER TABLE public.players
  ADD COLUMN IF NOT EXISTS attempts jsonb;

ALTER TABLE public.questions
  ADD COLUMN IF NOT EXISTS explanation text;

COMMENT ON COLUMN public.rooms.settings IS '방 옵션. 공부 모드는 settings.study 에 피드백 시점·다시 풀기·재도전 횟수·문제 순서를 둔다';
COMMENT ON COLUMN public.players.attempts IS '학생의 시도 기록 배열(공부 모드). score / answer_history 에는 최고 점수 시도가 복사된다';
COMMENT ON COLUMN public.questions.explanation IS '해설(선택). 공부 모드 정답 확인과 결과 화면 복습에 보인다';

-- game_mode 체크 제약에 'study'를 넣는다 (기존 제약은 이름으로 찾아 지운 뒤 전체 목록으로 다시 만든다).
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'rooms_game_mode_check'
      AND conrelid = 'public.rooms'::regclass
  ) THEN
    ALTER TABLE public.rooms DROP CONSTRAINT rooms_game_mode_check;
  END IF;
END $$;

ALTER TABLE public.rooms
  ADD CONSTRAINT rooms_game_mode_check
  CHECK (
    game_mode IS NULL OR game_mode::text IN (
      'gold_quest',
      'battle_royale',
      'fishing',
      'factory',
      'cafe',
      'mafia',
      'tower',
      'dontlookdown',
      'zombie',
      'treat_rush',
      'poop_dodge',
      'study'
    )
  );
