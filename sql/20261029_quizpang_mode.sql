-- 퀴즈팡팡 — game_mode 'quizpang' 추가 + 점수 상한 트리거 (2026-10-29)
--
-- 새 컬럼은 없다. 학생별 상태는 기존 컬럼을 쓴다 (lib/game/quizpang.ts 참고):
--   players.score        = 퍼즐 점수 — 순위 기준
--   players.item_effects = 저장값 JSON { v, score, playMs, quizDueMs, doubleMsLeft, board, inventory, stats }
-- 시작할 때 lib/services/rooms.ts 의 startRoom 이 두 값을 비운다.
-- 실행한 뒤 lib/game/modes.ts 의 HIDDEN_GAME_MODE_IDS 에서 'quizpang' 을 빼면 선생님 화면에 나온다.
-- 여러 번 실행해도 안전하다.

-- 1) 옛 스키마에서 game_mode 가 enum 타입이면 값을 추가한다.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_type WHERE typname = 'game_mode' AND typnamespace = 'public'::regnamespace) THEN
    IF NOT EXISTS (
      SELECT 1 FROM pg_enum
      WHERE enumlabel = 'quizpang' AND enumtypid = 'public.game_mode'::regtype
    ) THEN
      EXECUTE 'ALTER TYPE public.game_mode ADD VALUE ''quizpang''';
    END IF;
  END IF;
END $$;

-- 2) 체크 제약에 'quizpang' 을 넣는다 (기존 제약은 이름으로 찾아 지운 뒤 전체 목록으로 다시 만든다).
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
      'survivor',
      'bone_rush',
      'quizpang'
    )
  );

-- ────────────────────────────────────────────
-- 3) 점수 상한 (서버 검증)
-- ────────────────────────────────────────────
-- 퍼즐은 학생 브라우저에서 계산하고 점수를 players.score 에 직접 쓴다. 조작된 클라이언트가 터무니없는 점수를
-- 보내도 순위가 망가지지 않게, quizpang 방의 점수는 "여유분 + 초당 상한 × 경과 초" 를 넘지 못하게 잘라 낸다.
--   경과 초 = NOW() − (학생의 started_at(과제) 또는 방의 started_at). 일시정지 시간도 경과에 들어가므로 상한은 느슨한 쪽이다.
-- 거절(RAISE)하지 않고 잘라 내는(LEAST) 이유: 거절하면 학생 화면이 재동기화를 반복하며 멈춘다.
-- 두 숫자는 lib/game/quizpang.ts 의 QUIZPANG.SERVER (MAX_SCORE_PER_SECOND·SCORE_GRACE) 와 같아야 한다.
-- 조회 중 다른 오류가 나면 저장을 막지 않는다(수업이 검증 때문에 멈추면 안 된다).

CREATE OR REPLACE FUNCTION public.quizpang_max_score_per_second()
RETURNS INT
LANGUAGE sql
IMMUTABLE
AS $$ SELECT 300 $$;

CREATE OR REPLACE FUNCTION public.quizpang_score_grace()
RETURNS INT
LANGUAGE sql
IMMUTABLE
AS $$ SELECT 3000 $$;

CREATE OR REPLACE FUNCTION public.players_clamp_quizpang_score()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_mode TEXT;
  v_room_started TIMESTAMPTZ;
  v_started TIMESTAMPTZ;
  v_elapsed NUMERIC;
  v_cap BIGINT;
BEGIN
  IF NEW.score IS NULL OR NEW.score <= 0 OR NEW.score IS NOT DISTINCT FROM OLD.score THEN
    RETURN NEW;
  END IF;

  BEGIN
    SELECT game_mode::text, started_at INTO v_mode, v_room_started
    FROM public.rooms WHERE room_code = NEW.room_code;

    IF v_mode IS DISTINCT FROM 'quizpang' THEN
      RETURN NEW;
    END IF;

    v_started := COALESCE(NEW.started_at, v_room_started);
    IF v_started IS NULL THEN
      v_elapsed := 0;
    ELSE
      v_elapsed := GREATEST(0, EXTRACT(EPOCH FROM (NOW() - v_started)));
    END IF;

    v_cap := public.quizpang_score_grace() + FLOOR(public.quizpang_max_score_per_second() * v_elapsed)::BIGINT;
    IF NEW.score > v_cap THEN
      RAISE WARNING 'quizpang score clamped for player %: % -> % (elapsed %s)', NEW.id, NEW.score, v_cap, ROUND(v_elapsed);
      NEW.score := v_cap;
    END IF;
    RETURN NEW;
  EXCEPTION
    WHEN OTHERS THEN
      RAISE WARNING 'players_clamp_quizpang_score skipped for player %: %', NEW.id, SQLERRM;
      RETURN NEW;
  END;
END;
$$;

DROP TRIGGER IF EXISTS players_clamp_quizpang_score_trigger ON public.players;
CREATE TRIGGER players_clamp_quizpang_score_trigger
  BEFORE UPDATE OF score ON public.players
  FOR EACH ROW EXECUTE FUNCTION public.players_clamp_quizpang_score();
