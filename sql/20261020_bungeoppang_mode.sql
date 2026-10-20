-- 붕어빵 굽굽! — game_mode 'bungeoppang' 추가 (2026-10-20)
--
-- 새 컬럼은 없다. 학생별 상태는 기존 컬럼을 쓴다 (lib/game/bungeoppang.ts 참고):
--   players.score        = 붕어빵 점수 합 (순위 기준)
--   players.item_effects = 굽기 통계·버프 JSON { v, baked, perfect, golden, grades, fillings, tray, traysDone, buffs … }
-- 시작할 때 lib/services/rooms.ts 의 startRoom 이 두 값을 비운다.

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
  END IF;
END $$;

-- 2) 체크 제약에 'bungeoppang' 을 넣는다 (기존 제약은 이름으로 찾아 지운 뒤 전체 목록으로 다시 만든다).
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
      'bungeoppang'
    )
  );
