import { supabase } from '@/lib/supabase/client'
import type { Database, Json } from '@/types/database.types'

type PlayerRow = Database['public']['Tables']['players']['Row']

/**
 * 증분 가능한 숫자 컬럼 (SQL `_qd_is_delta_column` 화이트리스트와 일치해야 함).
 */
export type DeltaColumn =
  | 'health'
  | 'gold'
  | 'score'
  | 'cash'
  | 'mafia_cash'
  | 'mafia_diamonds'
  | 'cafe_cash'
  | 'cafe_customers_served'
  | 'factory_money'
  | 'convenience_money'
  | 'claw_points'
  | 'fishing_points'
  | 'revival_streak'
  | 'position'
  | 'attack_power'
  | 'defense'

export type PlayerDeltas = Partial<Record<DeltaColumn, number>>
export type PlayerMaxes = Partial<Record<DeltaColumn, number>>

const rpc = supabase.rpc.bind(supabase) as unknown as (
  fn: string,
  args: Record<string, unknown>,
) => Promise<{ data: unknown; error: { message: string } | null }>

/**
 * 한 플레이어의 여러 숫자 컬럼을 서버에서 원자적으로 증분한다.
 * 모든 컬럼은 0 미만으로 내려가지 않으며, `maxes`가 주어지면 상한도 적용된다.
 * 갱신된 "권위 있는" 행을 반환한다 — 이 값을 broadcast 해 모든 화면을 수렴시킨다.
 */
export async function applyPlayerDelta(
  playerId: string,
  deltas: PlayerDeltas,
  maxes: PlayerMaxes = {},
): Promise<PlayerRow> {
  const { data, error } = await rpc('apply_player_delta', {
    p_player_id: playerId,
    p_deltas: deltas,
    p_max: maxes,
  })
  if (error) throw new Error(error.message)
  return data as PlayerRow
}

/**
 * 두 플레이어에 각각 독립적인 증분을 한 트랜잭션(양쪽 row lock) 안에서 적용한다.
 */
export async function applyPlayerDeltaPair(
  playerAId: string,
  deltasA: PlayerDeltas,
  playerBId: string,
  deltasB: PlayerDeltas,
  maxes: PlayerMaxes = {},
): Promise<PlayerRow[]> {
  const { data, error } = await rpc('apply_player_delta_pair', {
    p_player_a: playerAId,
    p_deltas_a: deltasA,
    p_player_b: playerBId,
    p_deltas_b: deltasB,
    p_max: maxes,
  })
  if (error) throw new Error(error.message)
  return (data as PlayerRow[]) ?? []
}

/**
 * 자원 훔치기 — 피해자가 실제 보유한 양까지만 이동시켜 총량을 보존한다.
 * `columns[0]`을 이동량 clamp 기준으로 삼는다 (예: 'gold'). 나머지 컬럼도 같은 실제이동량으로 조정.
 */
export async function stealPlayerResource(
  victimId: string,
  thiefId: string,
  amount: number,
  columns: DeltaColumn[],
): Promise<PlayerRow[]> {
  const { data, error } = await rpc('steal_player_resource', {
    p_victim: victimId,
    p_thief: thiefId,
    p_amount: amount,
    p_columns: columns,
  })
  if (error) throw new Error(error.message)
  return (data as PlayerRow[]) ?? []
}

/**
 * 두 플레이어의 지정 컬럼 값을 원자적으로 맞교환한다 (골드퀘스트 KING).
 */
export async function swapPlayerColumns(
  playerAId: string,
  playerBId: string,
  columns: DeltaColumn[],
): Promise<PlayerRow[]> {
  const { data, error } = await rpc('swap_player_columns', {
    p_player_a: playerAId,
    p_player_b: playerBId,
    p_columns: columns,
  })
  if (error) throw new Error(error.message)
  return (data as PlayerRow[]) ?? []
}

/** zombie_strike 가 알려주는, 이번 공격이 실제로 한 일. */
export type ZombieAttackOutcome =
  | 'infected'        // 이번 공격이 감염을 성사시켰다
  | 'damaged'         // 데미지만 들어갔다
  | 'blocked'         // 방어막이 통째로 막았다
  | 'hidden'          // 대상이 숨는 중이라 공격할 수 없다 (아무 변화 없음)
  | 'already_zombie'  // 도착했을 때 이미 좀비였다
  | 'no_role'
  | 'not_zombie'      // 공격자가 그새 백신으로 인간이 됐다

export type ZombieAttackResult = {
  outcome: ZombieAttackOutcome
  damage: number
  players: PlayerRow[]
}

/**
 * 좀비 감염 공격 — 숨기 확인 → 방어막 → 체력 감소 → 감염(역할 전이)을 서버에서 원자적으로 처리.
 * 데미지는 서버가 공격자의 attack_power(헬기를 부른 뒤엔 ×1.5)로 정한다.
 * (여러 좀비가 같은 인간에게 막타를 노려도 감염 연출은 실제로 성사시킨 한 명만 본다.)
 */
export async function zombieStrike(
  zombieId: string,
  targetId: string,
  limits: Record<string, number>,
): Promise<ZombieAttackResult> {
  const { data, error } = await rpc('zombie_strike', {
    p_zombie: zombieId,
    p_target: targetId,
    p_limits: limits,
  })
  if (error) throw new Error(error.message)
  const result = data as { outcome?: ZombieAttackOutcome; damage?: number; players?: PlayerRow[] } | null
  return {
    outcome: result?.outcome ?? 'no_role',
    damage: result?.damage ?? 0,
    players: result?.players ?? [],
  }
}

export type ZombieVaccineOutcome = 'dosed' | 'cured' | 'immune' | 'not_zombie' | 'not_human'

export type ZombieVaccineResult = {
  outcome: ZombieVaccineOutcome
  /** 지금까지 맞은 백신 수 (dosed 일 때) */
  doses: number
  players: PlayerRow[]
}

/** 인간이 좀비 친구에게 백신을 쏜다. 감염된 친구만 3발에 돌아오고, 처음 좀비는 면역. */
export async function zombieVaccinate(
  humanId: string,
  targetId: string,
  limits: Record<string, number>,
): Promise<ZombieVaccineResult> {
  const { data, error } = await rpc('zombie_vaccinate', {
    p_human: humanId,
    p_target: targetId,
    p_limits: limits,
  })
  if (error) throw new Error(error.message)
  const result = data as { outcome?: ZombieVaccineOutcome; doses?: number; players?: PlayerRow[] } | null
  return {
    outcome: result?.outcome ?? 'not_zombie',
    doses: result?.doses ?? 0,
    players: result?.players ?? [],
  }
}

export type ZombieSabotageResult = {
  outcome: 'sabotaged' | 'locked' | 'not_zombie'
  amount: number
  player: PlayerRow | null
}

/** 좀비의 무전기 방해. 헬기를 부른 뒤에는 locked. */
export async function zombieSabotage(
  zombieId: string,
  limits: Record<string, number>,
): Promise<ZombieSabotageResult> {
  const { data, error } = await rpc('zombie_sabotage', {
    p_zombie: zombieId,
    p_limits: limits,
  })
  if (error) throw new Error(error.message)
  const result = data as { outcome?: ZombieSabotageResult['outcome']; amount?: number; player?: PlayerRow } | null
  return {
    outcome: result?.outcome ?? 'not_zombie',
    amount: Number(result?.amount ?? 0),
    player: result?.player ?? null,
  }
}

/**
 * 무전기 목표를 정한다 (한 번만 — 이미 정해졌거나 너무 이르면 그대로 돌려준다).
 * 누가 불러도 같은 값이 나오므로 선생님 화면·학생 화면·체험 봇 어디서 불러도 된다.
 * 돌려받은 rooms.settings 를 room:patch 로 방송한다.
 */
export async function zombieLockRadioGoal(
  roomCode: string,
  limits: Record<string, number>,
): Promise<Json | null> {
  const { data, error } = await rpc('zombie_lock_radio_goal', {
    p_room: roomCode,
    p_limits: limits,
  })
  if (error) throw new Error(error.message)
  return (data as Json | null) ?? null
}

/** 무전기가 목표에 닿았으면 헬기를 부른다 (한 번만). 진행도는 서버가 다시 센다. */
export async function zombieCallHeli(roomCode: string): Promise<Json | null> {
  const { data, error } = await rpc('zombie_call_heli', { p_room: roomCode })
  if (error) throw new Error(error.message)
  return (data as Json | null) ?? null
}

/**
 * 좀비 모드 퀴즈 결과·인간 행동을 서버에 보고한다.
 * 역할은 보내지 않는다 — 서버가 저장된 role 을 읽어 판정하므로, 감염된 직후
 * 아직 그 사실을 모르는 클라이언트가 답을 제출해도 감염이 취소되지 않는다.
 */
export async function zombieApplyAction(
  playerId: string,
  action: 'correct' | 'wrong' | 'heal' | 'shield' | 'repair',
  limits: Record<string, number>,
): Promise<PlayerRow | null> {
  const { data, error } = await rpc('zombie_apply_action', {
    p_player: playerId,
    p_action: action,
    p_limits: limits,
  })
  if (error) throw new Error(error.message)
  return (data as PlayerRow | null) ?? null
}

/**
 * RPC가 반환한 권위 있는 행에서 broadcast/로컬 patch에 쓸 필드만 추출한다.
 * (RPC는 전체 행을 돌려주지만, 실제로 바뀐 숫자 컬럼만 전파하면 충분하다.)
 */
export function pickDeltaFields(
  row: PlayerRow,
  columns: Array<keyof PlayerRow>,
): Partial<PlayerRow> {
  const patch: Record<string, unknown> = {}
  for (const col of columns) {
    patch[col as string] = row[col]
  }
  return patch as Partial<PlayerRow>
}
