import { supabase } from '@/lib/supabase/client'
import type { Database } from '@/types/database.types'

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

/**
 * 좀비 감염 공격 — 방어막 흡수 → 체력 감소 → 감염(역할 전이)을 서버에서 원자적으로 처리.
 * 두 행(공격자/대상)의 권위 있는 최종 상태를 반환한다.
 */
export async function zombieAttack(
  zombieId: string,
  targetId: string,
  damage: number,
  infectionThreshold: number,
  zombieBaseAttack: number,
): Promise<PlayerRow[]> {
  const { data, error } = await rpc('zombie_attack', {
    p_zombie: zombieId,
    p_target: targetId,
    p_damage: damage,
    p_infection_threshold: infectionThreshold,
    p_zombie_base_attack: zombieBaseAttack,
  })
  if (error) throw new Error(error.message)
  return (data as PlayerRow[]) ?? []
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
