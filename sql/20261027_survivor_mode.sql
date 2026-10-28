-- 멍멍 서바이벌 — game_mode 'survivor' 추가 (2026-10-27)
--
-- 새 컬럼은 없다. 학생별 상태는 기존 컬럼을 쓴다 (lib/game/survivor.ts 참고):
--   players.score        = 몬스터를 물리쳐 얻은 점수 — 순위 기준
--   players.item_effects = 저장값 JSON { v, score, level, xp, battleMs, diffMs, skills, stats }
-- 시작할 때 lib/services/rooms.ts 의 startRoom 이 두 값을 비운다.
-- 실행한 뒤 lib/game/modes.ts 의 HIDDEN_GAME_MODE_IDS 에서 'survivor' 를 빼면 선생님 화면에 나온다.

-- 1) 옛 스키마에서 game_mode 가 enum 타입이면 값을 추가한다.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_type WHERE typname = 'game_mode' AND typnamespace = 'public'::regnamespace) THEN
    IF NOT EXISTS (
      SELECT 1 FROM pg_enum
      WHERE enumlabel = 'survivor' AND enumtypid = 'public.game_mode'::regtype
    ) THEN
      EXECUTE 'ALTER TYPE public.game_mode ADD VALUE ''survivor''';
    END IF;
  END IF;
END $$;

-- 2) 체크 제약에 'survivor' 를 넣는다 (기존 제약은 이름으로 찾아 지운 뒤 전체 목록으로 다시 만든다).
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
      'study',
      'raid',
      'bungeoppang',
      'ramen',
      'garden',
      'survivor'
    )
  );
