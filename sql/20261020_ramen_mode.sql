-- 퀴즈독의 라면가게 — game_mode 'ramen' 추가 (2026-10-20)
--
-- 새 컬럼은 없다. 학생별 상태는 기존 컬럼을 쓴다 (lib/game/ramen.ts 참고):
--   players.score        = 라면을 팔아 번 돈(원) — 순위 기준
--   players.item_effects = 장사 통계 JSON { v, rounds, customers, served, perfect, verdicts, bestRound, tripleCrowns, money }
-- 시작할 때 lib/services/rooms.ts 의 startRoom 이 두 값을 비운다.
-- 같은 날 만든 'bungeoppang' 도 목록에 함께 넣었으므로, 이 파일 하나만 실행해도 두 모드가 모두 열린다.

-- 1) 옛 스키마에서 game_mode 가 enum 타입이면 값을 추가한다.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_type WHERE typname = 'game_mode' AND typnamespace = 'public'::regnamespace) THEN
    IF NOT EXISTS (
      SELECT 1 FROM pg_enum
      WHERE enumlabel = 'bungeoppang' AND enumtypid = 'public.game_mode'::regtype
    ) THEN
      EXECUTE 'ALTER TYPE public.game_mode ADD VALUE ''bungeoppang''';
    END IF;
    IF NOT EXISTS (
      SELECT 1 FROM pg_enum
      WHERE enumlabel = 'ramen' AND enumtypid = 'public.game_mode'::regtype
    ) THEN
      EXECUTE 'ALTER TYPE public.game_mode ADD VALUE ''ramen''';
    END IF;
  END IF;
END $$;

-- 2) 체크 제약에 'ramen' 을 넣는다 (기존 제약은 이름으로 찾아 지운 뒤 전체 목록으로 다시 만든다).
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
      'ramen'
    )
  );
