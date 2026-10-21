-- ============================================
-- QuizDog 좀비를 피해라! — 구조 무전기 · 백신 · 피격 후 숨기 (2026-10-21 개편)
-- ============================================
-- 20260910_zombie_server_authority.sql 이후 실행.
--
-- 바뀌는 규칙 (수치는 lib/game/zombie.ts 의 GAME_CONSTANTS 가 p_limits 로 넘긴다)
--   · 구조 무전기: 인간 정답마다 +1, '수리' 행동 +2. 생존자 보정 ×(시작 인간 수 ÷ 지금 인간 수).
--     목표는 게임 1분이 지난 순간 '그때까지 인간이 맞힌 정답 수 × 게임 분 × 계수'로 한 번만 정한다.
--     목표를 넘으면 헬기를 부르고, 헬기가 오면(45초, 게임 끝을 넘지 않음) 생존자가 있을 때 인간 승리.
--     시간이 끝날 때까지 무전기를 못 고치면 좀비 승리.
--   · 좀비 '무전기 방해': −3 ×(시작 좀비 수 ÷ 지금 좀비 수). 헬기를 부른 뒤에는 못 한다.
--   · 백신: 감염된 친구(처음부터 좀비가 아닌)에게 3발 → 인간으로 돌아온다(체력 60). 처음 좀비는 면역.
--   · 피격 후 숨기: 공격을 받으면(방어막으로 막아도) 10초 동안 공격 대상이 될 수 없다.
--   · 방어막: 1장. 공격 한 번을 통째로 막고 사라진다.
--   · 헬기를 부른 뒤 좀비 공격력 ×1.5.
--
-- 상태 저장 위치 (새 컬럼 없음)
--   players.active_item(좀비 메타)에 키를 더한다:
--     radio(가중 수리량, 소수) · radioParts(수리 칸 수, 점수용) · rescues(백신으로 구한 친구 수)
--     sabotage(방해량, 소수) · sabotageCount · vaccine(맞은 백신 수) · hiddenUntil(ISO 시각)
--   무전기 진행도 = Σ radio − Σ sabotage (펭귄 레이드처럼 players 행에서 유도)
--   rooms.settings.zombie 에 radioGoal(정수) · heliAt(ISO 시각)을 한 번만 기록한다.
--
-- 예전 함수와의 공존
--   zombie_attack(5인자)과 _qd_zombie_score 는 그대로 둔다. 배포 직후 예전 화면을 캐시한 학생이
--   부르더라도 깨지지 않게 하기 위해서다. 새 화면은 zombie_strike 를 쓴다.
--   zombie_apply_action 은 인자가 같아 덮어쓴다('repair' 행동이 늘었다).


-- ─────────────────────────────────────────────
-- 점수 (새 규칙). lib/game/zombie.ts 의 zombieScore() 와 같은 식.
--   인간 = 200 + 수리 칸 수 + 20 × 백신으로 구한 친구 수   (체력은 넣지 않는다 — 체력은 '맞은 이력'이다)
--   좀비 = min(199, 10 × 감염 수 + 방해 횟수)              (199 = 생존자 최저점 200 아래 티어 경계)
-- ─────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public._qd_zombie_score_v2(p_role TEXT, p_meta JSONB)
RETURNS INTEGER AS $$
BEGIN
  IF p_role = 'human' THEN
    RETURN 200
      + GREATEST(0, COALESCE((p_meta ->> 'radioParts')::int, 0))
      + 20 * GREATEST(0, COALESCE((p_meta ->> 'rescues')::int, 0));
  END IF;
  RETURN LEAST(199,
    10 * GREATEST(0, COALESCE((p_meta ->> 'infectCount')::int, 0))
    + GREATEST(0, COALESCE((p_meta ->> 'sabotageCount')::int, 0)));
END;
$$ LANGUAGE plpgsql IMMUTABLE;


-- 방의 역할별 인원 (쫓겨난 학생·역할 없는 학생 제외)
CREATE OR REPLACE FUNCTION public._qd_zombie_counts(p_room TEXT)
RETURNS TABLE(humans_total INTEGER, humans_alive INTEGER, zombies_total INTEGER, zombies_now INTEGER) AS $$
  SELECT
    COUNT(*) FILTER (WHERE active_item ->> 'originalRole' = 'human')::int,
    COUNT(*) FILTER (WHERE active_item ->> 'role' = 'human')::int,
    COUNT(*) FILTER (WHERE active_item ->> 'originalRole' = 'zombie')::int,
    COUNT(*) FILTER (WHERE active_item ->> 'role' = 'zombie')::int
  FROM public.players
  WHERE room_code = p_room
    AND NOT COALESCE(is_kicked, false)
    AND active_item ? 'role';
$$ LANGUAGE sql STABLE;


-- 무전기 진행도 = Σ radio − Σ sabotage (0 아래로 내려가지 않음)
CREATE OR REPLACE FUNCTION public._qd_zombie_radio_progress(p_room TEXT)
RETURNS NUMERIC AS $$
  SELECT GREATEST(0,
    COALESCE(SUM(COALESCE((active_item ->> 'radio')::numeric, 0)), 0)
    - COALESCE(SUM(COALESCE((active_item ->> 'sabotage')::numeric, 0)), 0))
  FROM public.players
  WHERE room_code = p_room
    AND NOT COALESCE(is_kicked, false)
    AND active_item ? 'role';
$$ LANGUAGE sql STABLE;


-- 헬기를 불렀는지 (부른 뒤에는 방해 불가 · 좀비 공격력 ×1.5)
CREATE OR REPLACE FUNCTION public._qd_zombie_heli_called(p_room TEXT)
RETURNS BOOLEAN AS $$
  SELECT COALESCE((SELECT (settings -> 'zombie' ->> 'heliAt') IS NOT NULL
                     FROM public.rooms WHERE room_code = p_room), false);
$$ LANGUAGE sql STABLE;


-- ─────────────────────────────────────────────
-- 퀴즈 결과 / 인간 행동 (20260910 판을 대체)
--   p_action: 'correct' | 'wrong' | 'heal' | 'shield' | 'repair'
-- ─────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.zombie_apply_action(
  p_player UUID,
  p_action TEXT,
  p_limits JSONB DEFAULT '{}'::jsonb
)
RETURNS public.players AS $$
DECLARE
  v_meta    JSONB;
  v_room    TEXT;
  v_role    TEXT;
  v_health  INTEGER;
  v_attack  INTEGER;
  v_shield  INTEGER;
  v_streak  INTEGER;
  v_correct INTEGER;
  v_wrong   INTEGER;
  v_radio   NUMERIC;
  v_parts   INTEGER;
  v_gain    INTEGER := 0;
  v_weight  NUMERIC := 1;
  v_counts  RECORD;
  v_row     public.players;

  v_max_health    INTEGER := COALESCE((p_limits ->> 'humanMaxHealth')::int, 150);
  v_max_shield    INTEGER := COALESCE((p_limits ->> 'humanMaxShield')::int, 1);
  v_heal          INTEGER := COALESCE((p_limits ->> 'healAmount')::int, 25);
  v_shield_gain   INTEGER := COALESCE((p_limits ->> 'shieldAmount')::int, 1);
  v_streak_bonus  INTEGER := COALESCE((p_limits ->> 'streakBonus')::int, 10);
  v_attack_bonus  INTEGER := COALESCE((p_limits ->> 'zombieStreakBonus')::int, 5);
  v_max_attack    INTEGER := COALESCE((p_limits ->> 'zombieMaxAttack')::int, 60);
  v_wrong_penalty INTEGER := COALESCE((p_limits ->> 'wrongPenaltyHuman')::int, 0);
  v_threshold     INTEGER := COALESCE((p_limits ->> 'infectionThreshold')::int, 0);
  v_base_attack   INTEGER := COALESCE((p_limits ->> 'zombieBaseAttack')::int, 35);
  v_radio_correct INTEGER := COALESCE((p_limits ->> 'radioPerCorrect')::int, 1);
  v_radio_repair  INTEGER := COALESCE((p_limits ->> 'radioRepairAmount')::int, 2);
BEGIN
  IF p_action NOT IN ('correct', 'wrong', 'heal', 'shield', 'repair') THEN
    RAISE EXCEPTION 'zombie_apply_action: unknown action %', p_action;
  END IF;

  PERFORM 1 FROM public.players WHERE id = p_player FOR UPDATE;

  SELECT COALESCE(active_item, '{}'::jsonb), room_code, COALESCE(health, 100), COALESCE(attack_power, 0)
    INTO v_meta, v_room, v_health, v_attack
    FROM public.players WHERE id = p_player;

  v_role := v_meta ->> 'role';

  -- 역할 미배정(게임 도중 입장자)은 아무 것도 바꾸지 않는다.
  IF v_role IS NULL THEN
    SELECT * INTO v_row FROM public.players WHERE id = p_player;
    RETURN v_row;
  END IF;

  v_shield  := COALESCE((v_meta ->> 'shield')::int, 0);
  v_streak  := COALESCE((v_meta ->> 'correctStreak')::int, 0);
  v_correct := COALESCE((v_meta ->> 'totalCorrect')::int, 0);
  v_wrong   := COALESCE((v_meta ->> 'totalWrong')::int, 0);
  v_radio   := COALESCE((v_meta ->> 'radio')::numeric, 0);
  v_parts   := COALESCE((v_meta ->> 'radioParts')::int, 0);

  IF p_action = 'correct' THEN
    v_streak  := v_streak + 1;
    v_correct := v_correct + 1;
    -- 3연속 정답 보너스 (인간: 체력, 좀비: 공격력)
    IF v_streak % 3 = 0 THEN
      IF v_role = 'human' THEN
        v_health := LEAST(v_max_health, v_health + v_streak_bonus);
      ELSE
        v_attack := LEAST(v_max_attack, v_attack + v_attack_bonus);
      END IF;
    END IF;
    IF v_role = 'human' THEN
      v_gain := v_radio_correct;
    END IF;

  ELSIF p_action = 'wrong' THEN
    v_streak := 0;
    v_wrong  := v_wrong + 1;
    IF v_role = 'human' THEN
      v_health := GREATEST(0, v_health - v_wrong_penalty);
    END IF;

  ELSIF p_action = 'heal' THEN
    IF v_role = 'human' THEN
      v_health := LEAST(v_max_health, v_health + v_heal);
    END IF;

  ELSIF p_action = 'shield' THEN
    IF v_role = 'human' THEN
      v_shield := LEAST(v_max_shield, v_shield + v_shield_gain);
    END IF;

  ELSIF p_action = 'repair' THEN
    IF v_role = 'human' THEN
      v_gain := v_radio_repair;
    END IF;
  END IF;

  -- 무전기 기여. 살아남은 인간이 적을수록 한 칸이 더 크게 들어간다 (생존자 보정).
  IF v_gain > 0 THEN
    SELECT * INTO v_counts FROM public._qd_zombie_counts(v_room);
    v_weight := GREATEST(1, v_counts.humans_total)::numeric / GREATEST(1, v_counts.humans_alive);
    v_radio  := round(v_radio + v_gain * v_weight, 2);
    v_parts  := v_parts + v_gain;
  END IF;

  -- 오답 누적으로 체력이 바닥나면 좀비로 전이 (페널티가 0이면 일어나지 않는다)
  IF v_role = 'human' AND v_health <= v_threshold THEN
    v_role   := 'zombie';
    v_health := 999;
    v_shield := 0;
    v_attack := v_base_attack;
  END IF;

  v_meta := v_meta || jsonb_build_object(
    'role',          v_role,
    'shield',        v_shield,
    'correctStreak', v_streak,
    'totalCorrect',  v_correct,
    'totalWrong',    v_wrong,
    'radio',         v_radio,
    'radioParts',    v_parts
  );

  UPDATE public.players SET
    health       = v_health,
    attack_power = v_attack,
    active_item  = v_meta,
    score        = public._qd_zombie_score_v2(v_role, v_meta)
  WHERE id = p_player
  RETURNING * INTO v_row;

  RETURN v_row;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;


-- ─────────────────────────────────────────────
-- 좀비 공격 (새 규칙). 데미지는 서버가 공격자의 attack_power 로 정한다.
--   outcome:
--     'infected'       — 이번 공격이 감염을 성사시켰다
--     'damaged'        — 데미지만 들어갔다
--     'blocked'        — 방어막이 통째로 막았다
--     'hidden'         — 대상이 숨는 중이라 공격할 수 없다 (아무 변화 없음 · 다른 대상을 고르게 한다)
--     'already_zombie' — 도착했을 때 이미 좀비였다
--     'no_role'        — 역할 미배정 대상
--     'not_zombie'     — 공격자가 좀비가 아니다 (그새 백신으로 돌아왔다)
-- ─────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.zombie_strike(
  p_zombie UUID,
  p_target UUID,
  p_limits JSONB DEFAULT '{}'::jsonb
)
RETURNS JSONB AS $$
DECLARE
  v_first      UUID;
  v_second     UUID;
  v_z_meta     JSONB;
  v_z_attack   INTEGER;
  v_room       TEXT;
  v_t_health   INTEGER;
  v_t_meta     JSONB;
  v_role       TEXT;
  v_shield     INTEGER;
  v_damage     INTEGER;
  v_new_health INTEGER;
  v_outcome    TEXT;
  v_infect     INTEGER;
  v_hidden     TIMESTAMPTZ;

  v_threshold   INTEGER := COALESCE((p_limits ->> 'infectionThreshold')::int, 0);
  v_base_attack INTEGER := COALESCE((p_limits ->> 'zombieBaseAttack')::int, 35);
  v_hide_sec    INTEGER := COALESCE((p_limits ->> 'hideSeconds')::int, 10);
  v_rush        NUMERIC := COALESCE((p_limits ->> 'heliRushMultiplier')::numeric, 1.5);
BEGIN
  IF p_zombie < p_target THEN
    v_first := p_zombie; v_second := p_target;
  ELSE
    v_first := p_target; v_second := p_zombie;
  END IF;
  PERFORM 1 FROM public.players WHERE id = v_first FOR UPDATE;
  PERFORM 1 FROM public.players WHERE id = v_second FOR UPDATE;

  SELECT COALESCE(active_item, '{}'::jsonb), COALESCE(attack_power, v_base_attack), room_code
    INTO v_z_meta, v_z_attack, v_room
    FROM public.players WHERE id = p_zombie;

  SELECT health, COALESCE(active_item, '{}'::jsonb)
    INTO v_t_health, v_t_meta
    FROM public.players WHERE id = p_target;

  v_role := v_t_meta ->> 'role';

  IF v_z_meta ->> 'role' IS DISTINCT FROM 'zombie' THEN
    v_outcome := 'not_zombie';
  ELSIF v_role IS DISTINCT FROM 'human' THEN
    v_outcome := CASE WHEN v_role = 'zombie' THEN 'already_zombie' ELSE 'no_role' END;
  ELSE
    v_hidden := NULLIF(v_t_meta ->> 'hiddenUntil', '')::timestamptz;
    IF v_hidden IS NOT NULL AND v_hidden > now() THEN
      v_outcome := 'hidden';
    END IF;
  END IF;

  IF v_outcome IS NOT NULL THEN
    RETURN jsonb_build_object(
      'outcome', v_outcome,
      'damage', 0,
      'players', (SELECT COALESCE(jsonb_agg(to_jsonb(p)), '[]'::jsonb)
                    FROM public.players p WHERE p.id IN (p_zombie, p_target))
    );
  END IF;

  v_damage := GREATEST(0, v_z_attack);
  IF public._qd_zombie_heli_called(v_room) THEN
    v_damage := round(v_damage * v_rush);
  END IF;

  v_shield := COALESCE((v_t_meta ->> 'shield')::int, 0);
  IF v_shield > 0 THEN
    -- 방어막은 공격 한 번을 통째로 막고 사라진다. 막아도 숨기는 시작한다.
    v_t_meta := v_t_meta || jsonb_build_object(
      'shield', 0,
      'hiddenUntil', to_jsonb(now() + make_interval(secs => v_hide_sec))
    );
    UPDATE public.players SET active_item = v_t_meta WHERE id = p_target;
    v_outcome := 'blocked';
    v_damage := 0;
  ELSE
    v_new_health := GREATEST(0, COALESCE(v_t_health, 100) - v_damage);

    IF v_new_health <= v_threshold THEN
      -- 감염: 좀비로 전이. 백신 수·숨기는 비운다. originalRole 은 그대로라 백신으로 되돌릴 수 있다.
      v_t_meta := v_t_meta || jsonb_build_object(
        'role', 'zombie', 'shield', 0, 'vaccine', 0, 'hiddenUntil', NULL
      );
      UPDATE public.players SET
        health       = 999,
        attack_power = v_base_attack,
        active_item  = v_t_meta,
        score        = public._qd_zombie_score_v2('zombie', v_t_meta)
      WHERE id = p_target;

      v_infect := COALESCE((v_z_meta ->> 'infectCount')::int, 0) + 1;
      v_z_meta := v_z_meta || jsonb_build_object('infectCount', v_infect);
      UPDATE public.players SET
        active_item = v_z_meta,
        score       = public._qd_zombie_score_v2('zombie', v_z_meta)
      WHERE id = p_zombie;

      v_outcome := 'infected';
    ELSE
      v_t_meta := v_t_meta || jsonb_build_object(
        'hiddenUntil', to_jsonb(now() + make_interval(secs => v_hide_sec))
      );
      UPDATE public.players SET
        health      = v_new_health,
        active_item = v_t_meta
      WHERE id = p_target;

      v_outcome := 'damaged';
    END IF;
  END IF;

  RETURN jsonb_build_object(
    'outcome', v_outcome,
    'damage', v_damage,
    'players', (SELECT COALESCE(jsonb_agg(to_jsonb(p)), '[]'::jsonb)
                  FROM public.players p WHERE p.id IN (p_zombie, p_target))
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;


-- ─────────────────────────────────────────────
-- 백신. 인간이 좀비에게 쏜다.
--   outcome:
--     'dosed'      — 한 발 들어갔다 (doses 에 지금 맞은 수)
--     'cured'      — 이번 발로 인간으로 돌아왔다
--     'immune'     — 처음부터 좀비였던 친구라 듣지 않는다
--     'not_zombie' — 대상이 인간이다 (헛방)
--     'not_human'  — 쏜 사람이 그새 좀비가 됐다
-- ─────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.zombie_vaccinate(
  p_human UUID,
  p_target UUID,
  p_limits JSONB DEFAULT '{}'::jsonb
)
RETURNS JSONB AS $$
DECLARE
  v_first   UUID;
  v_second  UUID;
  v_h_meta  JSONB;
  v_t_meta  JSONB;
  v_outcome TEXT;
  v_doses   INTEGER := 0;

  v_need     INTEGER := COALESCE((p_limits ->> 'vaccineDoses')::int, 3);
  v_cure_hp  INTEGER := COALESCE((p_limits ->> 'cureHealth')::int, 60);
  v_hide_sec INTEGER := COALESCE((p_limits ->> 'hideSeconds')::int, 10);
BEGIN
  IF p_human = p_target THEN
    RAISE EXCEPTION 'zombie_vaccinate: cannot target self';
  END IF;
  IF p_human < p_target THEN
    v_first := p_human; v_second := p_target;
  ELSE
    v_first := p_target; v_second := p_human;
  END IF;
  PERFORM 1 FROM public.players WHERE id = v_first FOR UPDATE;
  PERFORM 1 FROM public.players WHERE id = v_second FOR UPDATE;

  SELECT COALESCE(active_item, '{}'::jsonb) INTO v_h_meta FROM public.players WHERE id = p_human;
  SELECT COALESCE(active_item, '{}'::jsonb) INTO v_t_meta FROM public.players WHERE id = p_target;

  IF v_h_meta ->> 'role' IS DISTINCT FROM 'human' THEN
    v_outcome := 'not_human';
  ELSIF v_t_meta ->> 'role' IS DISTINCT FROM 'zombie' THEN
    v_outcome := 'not_zombie';
  ELSIF v_t_meta ->> 'originalRole' = 'zombie' THEN
    v_outcome := 'immune';
  ELSE
    v_doses := COALESCE((v_t_meta ->> 'vaccine')::int, 0) + 1;
    IF v_doses >= v_need THEN
      v_t_meta := v_t_meta || jsonb_build_object(
        'role', 'human',
        'shield', 0,
        'vaccine', 0,
        'correctStreak', 0,
        'hiddenUntil', to_jsonb(now() + make_interval(secs => v_hide_sec))
      );
      UPDATE public.players SET
        health       = v_cure_hp,
        attack_power = 0,
        active_item  = v_t_meta,
        score        = public._qd_zombie_score_v2('human', v_t_meta)
      WHERE id = p_target;

      v_h_meta := v_h_meta || jsonb_build_object(
        'rescues', COALESCE((v_h_meta ->> 'rescues')::int, 0) + 1
      );
      UPDATE public.players SET
        active_item = v_h_meta,
        score       = public._qd_zombie_score_v2('human', v_h_meta)
      WHERE id = p_human;

      v_outcome := 'cured';
    ELSE
      v_t_meta := v_t_meta || jsonb_build_object('vaccine', v_doses);
      UPDATE public.players SET active_item = v_t_meta WHERE id = p_target;
      v_outcome := 'dosed';
    END IF;
  END IF;

  RETURN jsonb_build_object(
    'outcome', v_outcome,
    'doses', v_doses,
    'players', (SELECT COALESCE(jsonb_agg(to_jsonb(p)), '[]'::jsonb)
                  FROM public.players p WHERE p.id IN (p_human, p_target))
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;


-- ─────────────────────────────────────────────
-- 좀비의 무전기 방해. 좀비가 늘수록 한 번의 방해는 작아진다 (×시작 좀비 수 ÷ 지금 좀비 수).
-- 지금 진행도보다 많이 깎지는 않는다 (빈 무전기를 미리 '빚'지게 만들지 않게).
--   outcome: 'sabotaged' | 'locked'(헬기를 이미 불렀다) | 'not_zombie'
-- ─────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.zombie_sabotage(
  p_zombie UUID,
  p_limits JSONB DEFAULT '{}'::jsonb
)
RETURNS JSONB AS $$
DECLARE
  v_meta    JSONB;
  v_room    TEXT;
  v_counts  RECORD;
  v_amount  NUMERIC;
  v_outcome TEXT;
  v_row     public.players;

  v_base NUMERIC := COALESCE((p_limits ->> 'sabotageAmount')::numeric, 3);
BEGIN
  PERFORM 1 FROM public.players WHERE id = p_zombie FOR UPDATE;
  SELECT COALESCE(active_item, '{}'::jsonb), room_code INTO v_meta, v_room
    FROM public.players WHERE id = p_zombie;

  IF v_meta ->> 'role' IS DISTINCT FROM 'zombie' THEN
    v_outcome := 'not_zombie';
    v_amount := 0;
  ELSIF public._qd_zombie_heli_called(v_room) THEN
    v_outcome := 'locked';
    v_amount := 0;
  ELSE
    SELECT * INTO v_counts FROM public._qd_zombie_counts(v_room);
    v_amount := v_base * GREATEST(1, v_counts.zombies_total)::numeric / GREATEST(1, v_counts.zombies_now);
    v_amount := round(LEAST(v_amount, public._qd_zombie_radio_progress(v_room)), 2);
    v_meta := v_meta || jsonb_build_object(
      'sabotage', round(COALESCE((v_meta ->> 'sabotage')::numeric, 0) + v_amount, 2),
      'sabotageCount', COALESCE((v_meta ->> 'sabotageCount')::int, 0) + 1
    );
    UPDATE public.players SET
      active_item = v_meta,
      score       = public._qd_zombie_score_v2('zombie', v_meta)
    WHERE id = p_zombie;
    v_outcome := 'sabotaged';
  END IF;

  SELECT * INTO v_row FROM public.players WHERE id = p_zombie;
  RETURN jsonb_build_object('outcome', v_outcome, 'amount', v_amount, 'player', to_jsonb(v_row));
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;


-- ─────────────────────────────────────────────
-- 무전기 목표를 한 번만 정한다. 누가 불러도(선생님·학생·체험 봇) 같은 값이 나온다.
--   목표 = 지금까지 인간이 맞힌 정답 수 × 게임 분 × 계수, 인간 1명·1분당 2~12칸 범위로 자른다.
--   p_limits: radioGoalMinutes · radioGoalCoefficient · radioGoalMinPerHumanMinute ·
--             radioGoalMaxPerHumanMinute · radioGoalLockSeconds (화면이 1분 지났다고 볼 때 부른다)
--   너무 일찍 부르면(시작 후 lockSeconds−10초 전) 아무 것도 정하지 않는다.
--   반환: rooms.settings (방송용 전체 값)
-- ─────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.zombie_lock_radio_goal(
  p_room TEXT,
  p_limits JSONB DEFAULT '{}'::jsonb
)
RETURNS JSONB AS $$
DECLARE
  v_settings JSONB;
  v_started  TIMESTAMPTZ;
  v_status   TEXT;
  v_counts   RECORD;
  v_correct  INTEGER;
  v_goal     INTEGER;

  v_minutes NUMERIC := COALESCE((p_limits ->> 'radioGoalMinutes')::numeric, 5);
  v_coef    NUMERIC := COALESCE((p_limits ->> 'radioGoalCoefficient')::numeric, 2);
  v_min     NUMERIC := COALESCE((p_limits ->> 'radioGoalMinPerHumanMinute')::numeric, 2);
  v_max     NUMERIC := COALESCE((p_limits ->> 'radioGoalMaxPerHumanMinute')::numeric, 12);
  v_lock    INTEGER := COALESCE((p_limits ->> 'radioGoalLockSeconds')::int, 60);
BEGIN
  SELECT COALESCE(settings, '{}'::jsonb), started_at, status
    INTO v_settings, v_started, v_status
    FROM public.rooms WHERE room_code = p_room FOR UPDATE;

  IF NOT FOUND THEN
    RETURN NULL;
  END IF;

  IF (v_settings -> 'zombie' ->> 'radioGoal') IS NOT NULL
     OR v_status <> 'playing'
     OR v_started IS NULL
     OR now() < v_started + make_interval(secs => GREATEST(0, v_lock - 10)) THEN
    RETURN v_settings;
  END IF;

  SELECT * INTO v_counts FROM public._qd_zombie_counts(p_room);
  SELECT COALESCE(SUM(COALESCE((active_item ->> 'totalCorrect')::int, 0)), 0)::int INTO v_correct
    FROM public.players
    WHERE room_code = p_room
      AND NOT COALESCE(is_kicked, false)
      AND active_item ->> 'originalRole' = 'human';

  v_goal := round(v_correct * v_minutes * v_coef);
  v_goal := GREATEST(v_goal, ceil(GREATEST(1, v_counts.humans_total) * v_minutes * v_min)::int);
  v_goal := LEAST(v_goal, ceil(GREATEST(1, v_counts.humans_total) * v_minutes * v_max)::int);

  v_settings := jsonb_set(
    v_settings,
    '{zombie}',
    COALESCE(v_settings -> 'zombie', '{}'::jsonb) || jsonb_build_object('radioGoal', v_goal),
    true
  );
  UPDATE public.rooms SET settings = v_settings WHERE room_code = p_room;
  RETURN v_settings;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;


-- ─────────────────────────────────────────────
-- 무전기가 목표에 닿았으면 헬기를 부른다 (한 번만). 진행도는 서버가 다시 센다.
--   반환: rooms.settings
-- ─────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.zombie_call_heli(p_room TEXT)
RETURNS JSONB AS $$
DECLARE
  v_settings JSONB;
  v_status   TEXT;
  v_goal     NUMERIC;
BEGIN
  SELECT COALESCE(settings, '{}'::jsonb), status INTO v_settings, v_status
    FROM public.rooms WHERE room_code = p_room FOR UPDATE;

  IF NOT FOUND THEN
    RETURN NULL;
  END IF;

  v_goal := (v_settings -> 'zombie' ->> 'radioGoal')::numeric;
  IF v_status <> 'playing'
     OR v_goal IS NULL
     OR (v_settings -> 'zombie' ->> 'heliAt') IS NOT NULL
     OR public._qd_zombie_radio_progress(p_room) < v_goal THEN
    RETURN v_settings;
  END IF;

  v_settings := jsonb_set(
    v_settings,
    '{zombie}',
    COALESCE(v_settings -> 'zombie', '{}'::jsonb) || jsonb_build_object('heliAt', to_jsonb(now())),
    true
  );
  UPDATE public.rooms SET settings = v_settings WHERE room_code = p_room;
  RETURN v_settings;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;


GRANT EXECUTE ON FUNCTION public._qd_zombie_score_v2(TEXT, JSONB) TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public._qd_zombie_counts(TEXT) TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public._qd_zombie_radio_progress(TEXT) TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public._qd_zombie_heli_called(TEXT) TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.zombie_apply_action(UUID, TEXT, JSONB) TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.zombie_strike(UUID, UUID, JSONB) TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.zombie_vaccinate(UUID, UUID, JSONB) TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.zombie_sabotage(UUID, JSONB) TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.zombie_lock_radio_goal(TEXT, JSONB) TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.zombie_call_heli(TEXT) TO authenticated, anon;
