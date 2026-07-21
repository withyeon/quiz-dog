-- ============================================================
-- QuizDog 동시성(원자적 플레이어 변경) 일괄 적용 스크립트
-- ============================================================
-- Supabase 대시보드 → SQL Editor 에 이 파일 전체를 붙여넣고 Run 하세요.
-- (dev 브랜치에서 먼저 실행 후 검증 → main 병합 권장)
-- 모든 함수는 CREATE OR REPLACE 라 재실행해도 안전(idempotent)합니다.
-- 원본: 20260716_atomic_player_mutations.sql + 20260716_zombie_atomic_attack.sql
-- ============================================================

-- ===== 1) 범용 원자 변경 함수 (delta / delta_pair / steal / swap) =====

-- ============================================
-- QuizDog atomic player mutations
-- ============================================
-- 동시성(Lost Update) 방지를 위한 서버측 원자 연산 모음.
--
-- 문제: 지금까지 점수/골드/체력 변경은 클라이언트가 로컬 복제본을 읽어
--   "절대값"을 계산해 덮어썼다. 두 클라이언트가 같은 행을 동시에 수정하면
--   한쪽 write가 통째로 사라진다(공격 증발, 골드 복제 등).
--
-- 해결: 아래 함수들은 Postgres row-level lock 안에서 "증분(delta)"으로
--   갱신하고, 갱신된 권위 있는 값을 반환한다. 클라이언트는 이 반환값을
--   broadcast 해 모든 화면을 정합적으로 수렴시킨다.
--
-- 대상 컬럼은 화이트리스트로 고정한다 (임의 컬럼 주입 방지).
-- setup.sql / 20260504_game_runtime_integrity.sql 이후에 실행.

-- 증분 가능한 숫자 컬럼 화이트리스트
CREATE OR REPLACE FUNCTION public._qd_is_delta_column(p_col TEXT)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN p_col = ANY (ARRAY[
    'health',
    'gold',
    'score',
    'cash',
    'mafia_cash',
    'mafia_diamonds',
    'cafe_cash',
    'cafe_customers_served',
    'factory_money',
    'convenience_money',
    'claw_points',
    'fishing_points',
    'revival_streak',
    'position',
    'attack_power',
    'defense'
  ]);
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- 한 행에 여러 컬럼을 원자적으로 증분한다.
--   p_deltas: {"health": -20, "score": 5}
--   p_max:    {"health": 130}  (선택) 컬럼별 상한. 없으면 int 최대값.
-- 모든 컬럼은 0 미만으로 내려가지 않도록 clamp 된다.
CREATE OR REPLACE FUNCTION public.apply_player_delta(
  p_player_id UUID,
  p_deltas JSONB,
  p_max JSONB DEFAULT '{}'::jsonb
)
RETURNS public.players AS $$
DECLARE
  v_key TEXT;
  v_set TEXT := '';
  v_max_expr TEXT;
  v_row public.players;
BEGIN
  FOR v_key IN SELECT jsonb_object_keys(p_deltas) LOOP
    IF NOT public._qd_is_delta_column(v_key) THEN
      RAISE EXCEPTION 'apply_player_delta: column % is not allowed', v_key;
    END IF;

    v_max_expr := COALESCE(p_max ->> v_key, '2147483647');

    IF v_set <> '' THEN
      v_set := v_set || ', ';
    END IF;

    -- least(max, greatest(0, coalesce(col,0) + delta))
    v_set := v_set || format(
      '%1$I = LEAST(%3$L::numeric, GREATEST(0, COALESCE(%1$I, 0) + (%2$L)::numeric))::int',
      v_key,
      (p_deltas ->> v_key),
      v_max_expr
    );
  END LOOP;

  IF v_set = '' THEN
    SELECT * INTO v_row FROM public.players WHERE id = p_player_id;
    RETURN v_row;
  END IF;

  EXECUTE format(
    'UPDATE public.players SET %s WHERE id = %L RETURNING *',
    v_set,
    p_player_id
  ) INTO v_row;

  RETURN v_row;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- 두 행에 각각 독립적인 증분을 한 트랜잭션(양쪽 row lock) 안에서 적용한다.
-- 데드락 방지를 위해 항상 id 정렬 순서로 잠근다.
-- 반환: 두 플레이어 행 (순서 보장 없음 — 클라이언트가 id로 매칭).
CREATE OR REPLACE FUNCTION public.apply_player_delta_pair(
  p_player_a UUID,
  p_deltas_a JSONB,
  p_player_b UUID,
  p_deltas_b JSONB,
  p_max JSONB DEFAULT '{}'::jsonb
)
RETURNS SETOF public.players AS $$
DECLARE
  v_first UUID;
  v_second UUID;
BEGIN
  -- 데드락 방지: 항상 작은 id 먼저 잠근다.
  IF p_player_a < p_player_b THEN
    v_first := p_player_a; v_second := p_player_b;
  ELSE
    v_first := p_player_b; v_second := p_player_a;
  END IF;

  PERFORM 1 FROM public.players WHERE id = v_first FOR UPDATE;
  PERFORM 1 FROM public.players WHERE id = v_second FOR UPDATE;

  RETURN QUERY SELECT * FROM public.apply_player_delta(p_player_a, p_deltas_a, p_max);
  RETURN QUERY SELECT * FROM public.apply_player_delta(p_player_b, p_deltas_b, p_max);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- 자원 훔치기: 피해자가 실제 보유한 양까지만 이동시켜 자원 총량을 보존한다.
--   p_columns[1] 을 clamp 기준으로 삼는다 (예: gold). 나머지 컬럼도 같은 실제이동량으로 조정.
--   골드 훔치기: p_columns = ['gold','score'] → gold 보유량 기준으로 gold/score 동시 이동
--   점수 훔치기: p_columns = ['score']
CREATE OR REPLACE FUNCTION public.steal_player_resource(
  p_victim UUID,
  p_thief UUID,
  p_amount NUMERIC,
  p_columns TEXT[]
)
RETURNS SETOF public.players AS $$
DECLARE
  v_first UUID;
  v_second UUID;
  v_basis_col TEXT;
  v_basis NUMERIC;
  v_actual NUMERIC;
  v_col TEXT;
  v_victim_set TEXT := '';
  v_thief_set TEXT := '';
BEGIN
  IF array_length(p_columns, 1) IS NULL THEN
    RAISE EXCEPTION 'steal_player_resource: p_columns is empty';
  END IF;

  FOREACH v_col IN ARRAY p_columns LOOP
    IF NOT public._qd_is_delta_column(v_col) THEN
      RAISE EXCEPTION 'steal_player_resource: column % is not allowed', v_col;
    END IF;
  END LOOP;

  -- 데드락 방지: 작은 id 먼저 잠근다.
  IF p_victim < p_thief THEN
    v_first := p_victim; v_second := p_thief;
  ELSE
    v_first := p_thief; v_second := p_victim;
  END IF;
  PERFORM 1 FROM public.players WHERE id = v_first FOR UPDATE;
  PERFORM 1 FROM public.players WHERE id = v_second FOR UPDATE;

  -- 실제 이동량 = min(요청량, 피해자의 기준 컬럼 보유량)
  v_basis_col := p_columns[1];
  EXECUTE format('SELECT COALESCE(%I, 0) FROM public.players WHERE id = %L', v_basis_col, p_victim)
    INTO v_basis;
  v_actual := GREATEST(0, LEAST(p_amount, COALESCE(v_basis, 0)));

  IF v_actual <= 0 THEN
    RETURN QUERY SELECT * FROM public.players WHERE id IN (p_victim, p_thief);
    RETURN;
  END IF;

  FOREACH v_col IN ARRAY p_columns LOOP
    IF v_victim_set <> '' THEN v_victim_set := v_victim_set || ', '; END IF;
    IF v_thief_set <> '' THEN v_thief_set := v_thief_set || ', '; END IF;
    v_victim_set := v_victim_set || format('%1$I = GREATEST(0, COALESCE(%1$I,0) - (%2$L)::numeric)::int', v_col, v_actual);
    v_thief_set := v_thief_set || format('%1$I = (COALESCE(%1$I,0) + (%2$L)::numeric)::int', v_col, v_actual);
  END LOOP;

  EXECUTE format('UPDATE public.players SET %s WHERE id = %L', v_victim_set, p_victim);
  EXECUTE format('UPDATE public.players SET %s WHERE id = %L', v_thief_set, p_thief);

  RETURN QUERY SELECT * FROM public.players WHERE id IN (p_victim, p_thief);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- 두 플레이어의 지정 컬럼 값을 원자적으로 맞교환한다 (골드퀘스트 KING).
CREATE OR REPLACE FUNCTION public.swap_player_columns(
  p_player_a UUID,
  p_player_b UUID,
  p_columns TEXT[]
)
RETURNS SETOF public.players AS $$
DECLARE
  v_first UUID;
  v_second UUID;
  v_col TEXT;
  v_a_set TEXT := '';
  v_b_set TEXT := '';
  v_a_val NUMERIC;
  v_b_val NUMERIC;
BEGIN
  IF array_length(p_columns, 1) IS NULL THEN
    RAISE EXCEPTION 'swap_player_columns: p_columns is empty';
  END IF;

  FOREACH v_col IN ARRAY p_columns LOOP
    IF NOT public._qd_is_delta_column(v_col) THEN
      RAISE EXCEPTION 'swap_player_columns: column % is not allowed', v_col;
    END IF;
  END LOOP;

  IF p_player_a < p_player_b THEN
    v_first := p_player_a; v_second := p_player_b;
  ELSE
    v_first := p_player_b; v_second := p_player_a;
  END IF;
  PERFORM 1 FROM public.players WHERE id = v_first FOR UPDATE;
  PERFORM 1 FROM public.players WHERE id = v_second FOR UPDATE;

  FOREACH v_col IN ARRAY p_columns LOOP
    EXECUTE format('SELECT COALESCE(%I,0) FROM public.players WHERE id = %L', v_col, p_player_a) INTO v_a_val;
    EXECUTE format('SELECT COALESCE(%I,0) FROM public.players WHERE id = %L', v_col, p_player_b) INTO v_b_val;

    IF v_a_set <> '' THEN v_a_set := v_a_set || ', '; END IF;
    IF v_b_set <> '' THEN v_b_set := v_b_set || ', '; END IF;
    v_a_set := v_a_set || format('%I = %L::int', v_col, v_b_val);
    v_b_set := v_b_set || format('%I = %L::int', v_col, v_a_val);
  END LOOP;

  EXECUTE format('UPDATE public.players SET %s WHERE id = %L', v_a_set, p_player_a);
  EXECUTE format('UPDATE public.players SET %s WHERE id = %L', v_b_set, p_player_b);

  RETURN QUERY SELECT * FROM public.players WHERE id IN (p_player_a, p_player_b);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- 접근 권한 (익명 포함). 내부 로직은 화이트리스트로 보호됨.
GRANT EXECUTE ON FUNCTION public._qd_is_delta_column(TEXT) TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.apply_player_delta(UUID, JSONB, JSONB) TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.apply_player_delta_pair(UUID, JSONB, UUID, JSONB, JSONB) TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.steal_player_resource(UUID, UUID, NUMERIC, TEXT[]) TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.swap_player_columns(UUID, UUID, TEXT[]) TO authenticated, anon;


-- ===== 2) 좀비 감염 공격 (방어막/체력/역할 전이 원자 처리) =====

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
