-- ============================================
-- QuizDog zombie atomic attack
-- ============================================
-- 좀비 감염전은 체력 + 방어막(active_item JSON) + 역할 전이가 얽혀 있어
-- 일반 숫자 delta로는 표현할 수 없다. 이 전용 RPC가 두 행을 잠그고
-- 방어막 흡수 → 체력 감소 → 감염(역할 전이)까지 원자적으로 처리한다.
--
-- active_item(jsonb) 메타 구조: { role, originalRole, shield, infectCount,
--   correctStreak, totalCorrect, totalWrong, scanCooldown }
-- score 규칙: 인간이면 health, 좀비면 infectCount (zombiePlayerToPatch와 동일)
--
-- 20260716_atomic_player_mutations.sql 이후 실행.

CREATE OR REPLACE FUNCTION public.zombie_attack(
  p_zombie UUID,
  p_target UUID,
  p_damage INTEGER,
  p_infection_threshold INTEGER,
  p_zombie_base_attack INTEGER
)
RETURNS SETOF public.players AS $$
DECLARE
  v_first UUID;
  v_second UUID;
  v_t_health INTEGER;
  v_t_meta JSONB;
  v_role TEXT;
  v_shield INTEGER;
  v_remaining INTEGER;
  v_new_health INTEGER;
  v_infected BOOLEAN;
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

  -- 이미 좀비이거나 대상이 없으면 아무 변화 없이 두 행 반환
  IF v_role IS DISTINCT FROM 'human' THEN
    RETURN QUERY SELECT * FROM public.players WHERE id IN (p_zombie, p_target);
    RETURN;
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
  v_infected := v_new_health <= p_infection_threshold;

  IF v_infected THEN
    -- 대상 감염: 좀비로 전이 (체력 999, 방어막 0, 공격력 부여)
    UPDATE public.players SET
      health = 999,
      attack_power = p_zombie_base_attack,
      active_item = active_item || jsonb_build_object('shield', 0, 'role', 'zombie'),
      score = COALESCE((active_item ->> 'infectCount')::int, 0)
    WHERE id = p_target;

    -- 공격자 감염 수 +1 (좀비 점수 = infectCount)
    UPDATE public.players SET
      active_item = active_item || jsonb_build_object('infectCount', COALESCE((active_item ->> 'infectCount')::int, 0) + 1),
      score = COALESCE((active_item ->> 'infectCount')::int, 0) + 1
    WHERE id = p_zombie;
  ELSE
    -- 감염 미달: 체력/방어막만 갱신 (인간 점수 = health)
    UPDATE public.players SET
      health = v_new_health,
      active_item = active_item || jsonb_build_object('shield', v_shield),
      score = v_new_health
    WHERE id = p_target;
  END IF;

  RETURN QUERY SELECT * FROM public.players WHERE id IN (p_zombie, p_target);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

GRANT EXECUTE ON FUNCTION public.zombie_attack(UUID, UUID, INTEGER, INTEGER, INTEGER) TO authenticated, anon;
