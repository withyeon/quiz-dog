/**
 * 눈싸움 대작전 — 눈밭 전장 배치 계산 (순수 함수)
 *
 * 화면 좌표는 스테이지 기준 퍼센트(0~100)로만 다룬다. 실제 픽셀 크기는 컴포넌트가
 * ResizeObserver로 재서 스프라이트 크기만 정하고, 위치는 여기서 나온 퍼센트를 그대로 쓴다.
 */

import type { PlayerClass, Team } from '@/lib/game/battleRoyale'

/** 세로 배치 기준: top = 상대 진영, bottom = 우리 진영, middle = 팀 없는 관전 배치 */
export type FieldSide = 'top' | 'bottom' | 'middle'
export type FieldOrientation = 'vertical' | 'horizontal'

export interface FieldPoint {
  x: number
  y: number
}

export interface FieldSlot extends FieldPoint {
  row: number
  rows: number
  perRow: number
}

export interface BattlefieldPlayer {
  id: string
  nickname: string
  avatar: string | null
  health?: number | null
  player_class?: string | null
  team?: Team | null
  is_kicked?: boolean
  revival_streak?: number
}

export interface BattlefieldSprite {
  player: BattlefieldPlayer
  side: FieldSide
  slot: FieldSlot
  /** 스프라이트 하나가 차지할 수 있는 폭(스테이지 퍼센트) — 이름표 최대 폭 계산용 */
  slotWidth: number
}

/** 한 줄에 몇 명까지 세울지. 넘치면 뒷줄을 만든다. */
export function rowsForCount(count: number): number {
  if (count <= 5) return 1
  if (count <= 12) return 2
  return 3
}

/**
 * 한 진영의 배치. 앞줄(가운데 가까운 줄)이 먼저 채워지고 남는 인원은 앞줄부터 하나씩 더 선다.
 * 줄마다 가로로 고르게 퍼뜨리되 양 끝 8%는 비워 스프라이트가 잘리지 않게 한다.
 */
export function layoutSide(count: number, side: FieldSide, alongInset = 8): FieldSlot[] {
  if (count <= 0) return []
  const rows = rowsForCount(count)
  const base = Math.floor(count / rows)
  const extra = count % rows
  const rowCounts = Array.from({ length: rows }, (_, r) => base + (r < extra ? 1 : 0))
  const rowGap = rows === 3 ? 11 : 14

  const slots: FieldSlot[] = []
  rowCounts.forEach((n, r) => {
    let y: number
    if (side === 'top') y = 34 - r * rowGap
    else if (side === 'bottom') y = 66 + r * rowGap
    else y = rows === 1 ? 50 : 30 + (r * 40) / (rows - 1)

    for (let c = 0; c < n; c += 1) {
      // 뒷줄은 반 칸 어긋나게 세워 사람 무리처럼 보이게 한다.
      const stagger = r % 2 === 1 && n > 1 ? 0.5 / n : 0
      const t = Math.min(0.98, (c + 0.5) / n + stagger)
      slots.push({ x: alongInset + t * (100 - alongInset * 2), y, row: r, rows, perRow: n })
    }
  })
  return slots
}

export interface LayoutOptions {
  /** 내 플레이어. 없으면 관전 배치(홍팀 위/왼쪽, 청팀 아래/오른쪽). */
  currentPlayerId?: string | null
  orientation?: FieldOrientation
}

/**
 * 전장 배치. 반환 순서는 players 순서를 유지한다(체력으로 정렬하지 않음 —
 * 맞을 때마다 자리가 바뀌면 눈뭉치가 엉뚱한 곳으로 날아간다).
 */
export function layoutBattlefield(
  players: BattlefieldPlayer[],
  options: LayoutOptions = {},
): BattlefieldSprite[] {
  const { currentPlayerId = null, orientation = 'vertical' } = options
  const visible = players.filter((p) => !p.is_kicked)
  const isTeamGame = visible.some((p) => p.team === 'red' || p.team === 'blue')
  const me = currentPlayerId ? visible.find((p) => p.id === currentPlayerId) ?? null : null

  const sideOf = (p: BattlefieldPlayer): FieldSide => {
    if (isTeamGame) {
      if (me?.team) return p.team === me.team ? 'bottom' : 'top'
      return p.team === 'blue' ? 'bottom' : 'top'
    }
    if (me) return p.id === me.id ? 'bottom' : 'top'
    return 'middle'
  }

  const groups: Record<FieldSide, BattlefieldPlayer[]> = { top: [], bottom: [], middle: [] }
  visible.forEach((p) => groups[sideOf(p)].push(p))

  const result: BattlefieldSprite[] = []
  ;(['top', 'bottom', 'middle'] as FieldSide[]).forEach((side) => {
    const group = groups[side]
    // 가로형은 줄이 세로 열이 되고 스프라이트(아바타+체온+이름)가 세로로 길어 양끝 여백을 더 둔다
    const slots = layoutSide(group.length, side, orientation === 'horizontal' ? 12 : 8)
    group.forEach((player, i) => {
      const slot = slots[i]
      const placed = orientation === 'horizontal' ? { ...slot, x: slot.y, y: slot.x } : slot
      result.push({ player, side, slot: placed, slotWidth: (100 - (orientation === 'horizontal' ? 24 : 16)) / slot.perRow })
    })
  })
  return result
}

/** 눈뭉치가 날아갈 포물선의 꼭짓점. 화면 위쪽(y 작은 쪽)으로 솟는다. */
export function arcPeak(from: FieldPoint, to: FieldPoint): FieldPoint {
  const distance = Math.hypot(to.x - from.x, to.y - from.y)
  const lift = Math.min(28, 10 + distance * 0.35)
  return { x: (from.x + to.x) / 2, y: Math.min(from.y, to.y) - lift }
}

/** 비행 시간(ms). 거리에 따라 살짝 늘어난다. */
export function flightDuration(from: FieldPoint, to: FieldPoint): number {
  const distance = Math.hypot(to.x - from.x, to.y - from.y)
  return Math.round(Math.min(760, 420 + distance * 3.2))
}

export function maxPerRow(sprites: BattlefieldSprite[]): number {
  return sprites.reduce((max, s) => Math.max(max, s.slot.perRow), 1)
}

export function maxRows(sprites: BattlefieldSprite[]): number {
  return sprites.reduce((max, s) => Math.max(max, s.slot.rows), 1)
}

export type BattlefieldClass = PlayerClass | null
