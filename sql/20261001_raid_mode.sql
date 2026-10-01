-- 황제 펭귄을 막아라! (협동 보스 레이드) — game_mode 'raid' 추가 (2026-10-01)
--
-- 새 컬럼은 없다. 보스 상태는 players 행에서 유도한다 (lib/game/raid.ts 참고):
--   players.score   = 학생이 입힌 데미지 합 (보스 체력 = 최대 체력 − 전원 합)
--   players.gold    = 명중 횟수
--   players.defense = 마지막으로 기여한 방패 번호
--   players.combo_count / player_class = 연속 정답 수 / 역할
--   rooms.settings.raid = { bossCount, playerCount }  (시작 때 선생님 화면이 넣는다)
-- 데미지 누적은 기존 apply_player_delta RPC(원자적 증분)를 그대로 쓴다.

-- 1) 옛 스키마에서 game_mode 가 enum 타입이면 값을 추가한다.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_type WHERE typname = 'game_mode' AND typnamespace = 'public'::regnamespace) THEN
    IF NOT EXISTS (
      SELECT 1 FROM pg_enum
      WHERE enumlabel = 'raid' AND enumtypid = 'public.game_mode'::regtype
    ) THEN
      EXECUTE 'ALTER TYPE public.game_mode ADD VALUE ''raid''';
    END IF;
  END IF;
END $$;

-- 2) 체크 제약에 'raid' 를 넣는다 (기존 제약은 이름으로 찾아 지운 뒤 전체 목록으로 다시 만든다).
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
      'raid'
    )
  );
