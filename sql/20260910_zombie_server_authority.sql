-- ============================================
-- QuizDog 좀비를 피해라! — 서버 권위 전환
-- ============================================
-- 문제: 좀비 모드는 정답/오답/치료/방어막까지 전부 클라이언트가 로컬 스냅샷으로
--   "절대값"을 계산해 players 행을 통째로 덮어썼다(zombiePlayerToPatch).
--   realtime 반영(실측 ~190ms) 전에 피해자가 답을 제출하면 role='human'을 다시 써서
--   방금 성사된 감염이 통째로 취소되고, 받은 데미지와 공격자의 infectCount도 함께 지워졌다.
--
-- 해결: role / health / attack_power / shield / infectCount 를 전부 서버 소유로 옮긴다.
--   클라이언트는 "무슨 일이 있었는지"(정답·오답·치료·방어막)만 보내고, 규칙 적용과
--   역할 전이는 row lock 안에서 서버가 판정한다. 클라이언트는 반환된 권위 있는 행을
--   broadcast 해 모든 화면을 수렴시킨다.
--
-- 20260716_zombie_atomic_attack.sql 을 대체한다 (zombie_attack 재정의 포함).
-- 20260716_atomic_player_mutations.sql 이후 실행.

-- ─────────────────────────────────────────────
-- 점수 규칙 (단일 정의)
--   생존한 인간이 항상 상위, 좀비끼리는 감염시킨 수로 정렬한다.
--   승리 조건("생존자가 남으면 인간 팀 승리")과 같은 기준이라 임의 가중치가 없다.
--     인간 = 200 + 체력            (210 ~ 350 — 살아있는 인간은 체력이 최소 10)
--     좀비 = min(199, 10 × 감염수) (0 ~ 190)
--   좀비 쪽 상한 199는 생존자 최저점(210)을 넘지 못하게 하는 티어 경계다.
--   한 명이 20명 넘게 감염시켜야 상한에 닿으므로 실제 수업에서는 걸리지 않는다.
--   lib/game/zombie.ts 의 zombieScore() 와 반드시 같은 식을 유지할 것.
-- ─────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public._qd_zombie_score(
  p_role TEXT,
  p_health INTEGER,
  p_infect_count INTEGER
)
RETURNS INTEGER AS $$
BEGIN
  IF p_role = 'human' THEN
    RETURN 200 + GREATEST(0, COALESCE(p_health, 0));
  END IF;
  RETURN LEAST(199, 10 * GREATEST(0, COALESCE(p_infect_count, 0)));
END;
$$ LANGUAGE plpgsql IMMUTABLE;


-- ─────────────────────────────────────────────
-- 퀴즈 결과 / 인간 행동을 서버에서 판정한다.
--   p_action: 'correct' | 'wrong' | 'heal' | 'shield'
--   p_limits: lib/game/zombie.ts 의 GAME_CONSTANTS 를 그대로 넘긴다
--             (밸런스는 코드 한 곳에서만 고치면 된다).
--
-- 역할(role)은 클라이언트가 보내지 않는다. 서버가 저장된 값을 읽어 판정하므로
-- 감염된 직후 아직 그 사실을 모르는 클라이언트가 답을 제출해도 감염이 유지된다.
-- ─────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.zombie_apply_action(
  p_player UUID,
  p_action TEXT,
  p_limits JSONB DEFAULT '{}'::jsonb
)
RETURNS public.players AS $$
DECLARE
  v_meta    JSONB;
  v_role    TEXT;
  v_health  INTEGER;
  v_attack  INTEGER;
  v_shield  INTEGER;
  v_streak  INTEGER;
  v_correct INTEGER;
  v_wrong   INTEGER;
  v_infect  INTEGER;
  v_row     public.players;

  v_max_health    INTEGER := COALESCE((p_limits ->> 'humanMaxHealth')::int, 150);
  v_max_shield    INTEGER := COALESCE((p_limits ->> 'humanMaxShield')::int, 50);
  v_heal          INTEGER := COALESCE((p_limits ->> 'healAmount')::int, 20);
  v_shield_gain   INTEGER := COALESCE((p_limits ->> 'shieldAmount')::int, 25);
  v_streak_bonus  INTEGER := COALESCE((p_limits ->> 'streakBonus')::int, 10);
  v_attack_bonus  INTEGER := COALESCE((p_limits ->> 'zombieStreakBonus')::int, 5);
  v_max_attack    INTEGER := COALESCE((p_limits ->> 'zombieMaxAttack')::int, 50);
  v_wrong_penalty INTEGER := COALESCE((p_limits ->> 'wrongPenaltyHuman')::int, 10);
  v_threshold     INTEGER := COALESCE((p_limits ->> 'infectionThreshold')::int, 0);
  v_base_attack   INTEGER := COALESCE((p_limits ->> 'zombieBaseAttack')::int, 25);
BEGIN
  IF p_action NOT IN ('correct', 'wrong', 'heal', 'shield') THEN
    RAISE EXCEPTION 'zombie_apply_action: unknown action %', p_action;
  END IF;

  PERFORM 1 FROM public.players WHERE id = p_player FOR UPDATE;

  SELECT COALESCE(active_item, '{}'::jsonb), COALESCE(health, 100), COALESCE(attack_power, 0)
    INTO v_meta, v_health, v_attack
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
  v_infect  := COALESCE((v_meta ->> 'infectCount')::int, 0);

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
  END IF;

  -- 오답 누적으로 체력이 바닥나면 좀비로 전이 (zombie_attack 의 감염과 같은 규칙)
  IF v_role = 'human' AND v_health <= v_threshold THEN
    v_role   := 'zombie';
    v_health := 999;
    v_shield := 0;
    v_attack := v_base_attack;
  END IF;

  UPDATE public.players SET
    health       = v_health,
    attack_power = v_attack,
    active_item  = COALESCE(active_item, '{}'::jsonb) || jsonb_build_object(
      'role',          v_role,
      'shield',        v_shield,
      'correctStreak', v_streak,
      'totalCorrect',  v_correct,
      'totalWrong',    v_wrong
    ),
    score = public._qd_zombie_score(v_role, v_health, v_infect)
  WHERE id = p_player
  RETURNING * INTO v_row;

  RETURN v_row;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;


-- ─────────────────────────────────────────────
-- 좀비 감염 공격 (20260716 판을 대체)
--   달라진 점: 이번 호출이 실제로 무슨 일을 했는지 outcome 으로 돌려준다.
--   여러 좀비가 같은 인간에게 막타를 노리면 예전에는 전원이 "감염 성공!" 연출을 봤다.
--     'infected'       — 이번 공격이 감염을 성사시켰다
--     'damaged'        — 데미지만 들어갔다
--     'already_zombie' — 도착했을 때 이미 좀비였다 (아무 변화 없음)
--     'no_role'        — 역할 미배정 대상 (아무 변화 없음)
-- ─────────────────────────────────────────────
DROP FUNCTION IF EXISTS public.zombie_attack(UUID, UUID, INTEGER, INTEGER, INTEGER);

CREATE FUNCTION public.zombie_attack(
  p_zombie UUID,
  p_target UUID,
  p_damage INTEGER,
  p_infection_threshold INTEGER,
  p_zombie_base_attack INTEGER
)
RETURNS JSONB AS $$
DECLARE
  v_first      UUID;
  v_second     UUID;
  v_t_health   INTEGER;
  v_t_meta     JSONB;
  v_role       TEXT;
  v_shield     INTEGER;
  v_remaining  INTEGER;
  v_new_health INTEGER;
  v_outcome    TEXT;
  v_infect     INTEGER;
BEGIN
  -- 데드락 방지: 작은 id 먼저 잠근다.
  IF p_zombie < p_target THEN
    v_first := p_zombie; v_second := p_target;
  ELSE
    v_first := p_target; v_second := p_zombie;
  END IF;
  PERFORM 1 FROM public.players WHERE id = v_first FOR UPDATE;
  PERFORM 1 FROM public.players WHERE id = v_second FOR UPDATE;

  SELECT health, COALESCE(active_item, '{}'::jsonb)
    INTO v_t_health, v_t_meta
    FROM public.players WHERE id = p_target;

  v_role := v_t_meta ->> 'role';

  IF v_role IS DISTINCT FROM 'human' THEN
    RETURN jsonb_build_object(
      'outcome', CASE WHEN v_role = 'zombie' THEN 'already_zombie' ELSE 'no_role' END,
      'players', (SELECT COALESCE(jsonb_agg(to_jsonb(p)), '[]'::jsonb)
                    FROM public.players p WHERE p.id IN (p_zombie, p_target))
    );
  END IF;

  -- 방어막 흡수 → 남은 데미지를 체력에서 차감
  v_shield := COALESCE((v_t_meta ->> 'shield')::int, 0);
  v_remaining := GREATEST(0, p_damage);
  IF v_shield > 0 THEN
    IF v_shield >= v_remaining THEN
      v_shield := v_shield - v_remaining;
      v_remaining := 0;
    ELSE
      v_remaining := v_remaining - v_shield;
      v_shield := 0;
    END IF;
  END IF;
  v_new_health := GREATEST(0, COALESCE(v_t_health, 100) - v_remaining);

  IF v_new_health <= p_infection_threshold THEN
    -- 대상 감염: 좀비로 전이 (체력 999, 방어막 0, 공격력 부여)
    UPDATE public.players SET
      health       = 999,
      attack_power = p_zombie_base_attack,
      active_item  = active_item || jsonb_build_object('shield', 0, 'role', 'zombie'),
      score        = public._qd_zombie_score('zombie', 999, COALESCE((active_item ->> 'infectCount')::int, 0))
    WHERE id = p_target;

    -- 공격자 감염 수 +1
    SELECT COALESCE((active_item ->> 'infectCount')::int, 0) + 1 INTO v_infect
      FROM public.players WHERE id = p_zombie;
    UPDATE public.players SET
      active_item = active_item || jsonb_build_object('infectCount', v_infect),
      score       = public._qd_zombie_score(active_item ->> 'role', health, v_infect)
    WHERE id = p_zombie;

    v_outcome := 'infected';
  ELSE
    -- 감염 미달: 체력/방어막만 갱신
    UPDATE public.players SET
      health      = v_new_health,
      active_item = active_item || jsonb_build_object('shield', v_shield),
      score       = public._qd_zombie_score('human', v_new_health, 0)
    WHERE id = p_target;

    v_outcome := 'damaged';
  END IF;

  RETURN jsonb_build_object(
    'outcome', v_outcome,
    'players', (SELECT COALESCE(jsonb_agg(to_jsonb(p)), '[]'::jsonb)
                  FROM public.players p WHERE p.id IN (p_zombie, p_target))
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

GRANT EXECUTE ON FUNCTION public._qd_zombie_score(TEXT, INTEGER, INTEGER) TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.zombie_apply_action(UUID, TEXT, JSONB) TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.zombie_attack(UUID, UUID, INTEGER, INTEGER, INTEGER) TO authenticated, anon;
