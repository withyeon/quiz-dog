/**
 * 뼈다귀 쟁탈전 — 규칙·상수·순수 함수.
 *
 * "모으고, 훔치고, 지키는" 쟁탈전(블루킷 Blook Rush 류)을 멍멍 서바이벌처럼 움직이는 액션으로 옮긴 퀴즈독 오리지널 모드다.
 * - 내 마당(화면 하나)에서 퀴즈독을 움직여 땅에 떨어지는 뼈다귀를 줍는다. 주운 뼈다귀는 꼬리처럼 줄줄이 따라온다 = 점수.
 * - 마당에 보물 상자가 나타난다. 가서 닿으면 내 화면만 멈추고 문제가 나온다.
 *   맞히면 카드 3장 중 하나: 뼈다귀 보따리(바로 +뼈다귀) / 도둑 고양이 보내기(친구 뼈다귀 훔치기) / 울타리(고양이 막기).
 *   틀리면 다음 문제로 다시 도전할 수 있다(상자당 3번). 3번 다 틀리면 상자가 잠기고 다음 상자를 기다린다. 뼈다귀는 잃지 않는다.
 * - 친구가 보낸 도둑 고양이는 내 마당에 들어와 나를 쫓는다. 닿을 때마다 꼬리 끝 뼈다귀를 물어 간다.
 *   도망치면 되고, 퀴즈독은 가까이 오면 저절로 짖어서 고양이를 밀어낸다. 울타리가 있으면 아예 못 들어온다.
 *   고양이가 물고 간 뼈다귀는 보낸 친구의 마당으로 배달된다.
 * - 가끔 들고양이도 온다. 들고양이가 문 뼈다귀는 땅에 흩어지므로 다시 주우면 된다(연습용·과제용).
 *
 * 상태 객체(BoneRushState)는 프레임마다 제자리에서 바뀐다(서바이벌과 같은 방식).
 * 화면(components/bone-rush/BoneRushArena.tsx)이 고정 60Hz 로 stepBoneRush 를 부르고 그린다.
 *
 * 학생별 저장은 players 행 두 칸 (새 컬럼 없음, sql/20261029_bone_rush_mode.sql):
 *   players.score        = 가진 뼈다귀 수 — 순위 기준
 *   players.item_effects = BoneRushSave JSON (뼈다귀·울타리·통계·플레이 시간). 새로고침하면 같은 뼈다귀로 다시 시작한다.
 */

import { withJosa } from '@/lib/utils/korean'

// ─── 상수 ───
export const BONE_RUSH = {
  /** 퀴즈 제한 시간(초) */
  QUESTION_TIME_LIMIT: 30,
  /** 고정 스텝(ms) */
  STEP_MS: 1000 / 60,
  /** 마당 넓이(세계 단위²). 기기마다 화면 비율은 달라도 넓이는 같다 */
  VIEW_AREA: 1000 * 640,
  PLAYER_SPEED: 205,
  PLAYER_RADIUS: 20,
  /** 땅에 떨어지는 뼈다귀: 간격·최대 개수·황금 뼈다귀 확률과 값 */
  BONE_EVERY_MS: 1600,
  BONE_CAP: 7,
  BONE_RADIUS: 13,
  GOLD_BONE_CHANCE: 0.07,
  GOLD_BONE_VALUE: 3,
  /** 보물 상자: 첫 상자·다음 상자까지 쉬는 시간·크기 */
  CHEST_FIRST_MS: 2500,
  CHEST_DELAY_MS: 4000,
  CHEST_RADIUS: 26,
  /** 상자 하나당 문제 기회. 틀리면 다음 문제로 다시 도전, 다 쓰면 상자가 잠긴다 */
  CHEST_TRIES: 3,
  /** 카드 수·보따리 뼈다귀 수·황금 보따리 */
  CHOICES: 3,
  SACK_BONES: 5,
  GOLD_SACK_BONES: 10,
  GOLD_SACK_CHANCE: 0.15,
  /** 울타리 최대 개수 */
  FENCE_MAX: 3,
  /** 자석 카드: 뼈다귀가 날아오는 시간·거리 */
  MAGNET_MS: 15_000,
  MAGNET_RADIUS: 320,
  /** 도둑 고양이: 속도·쫓는 시간·한 번에 무는 뼈다귀·최대 무는 횟수·문 뒤 쉬는 시간 */
  CAT_SPEED: 215,
  CAT_RADIUS: 18,
  CAT_CHASE_MS: 10_000,
  CAT_BITE: 4,
  CAT_MAX_BITES: 3,
  CAT_STUN_MS: 1300,
  /** 짖기(자동): 쉬는 시간·범위·밀어내는 힘·고양이가 멍한 시간 */
  BARK_EVERY_MS: 3200,
  BARK_RADIUS: 150,
  BARK_KNOCK: 300,
  BARK_STUN_MS: 800,
  /** 들고양이: 첫 등장·간격 (플레이 시간 기준) */
  WILD_FIRST_MS: 40_000,
  WILD_EVERY_MS: 50_000,
  /** 꼬리: 뼈다귀 간격·화면에 보이는 최대 개수 */
  TAIL_SPACING: 20,
  TAIL_MAX: 36,
} as const

// ─── 카드 ───
export type CardKind = 'sack' | 'cat' | 'fence' | 'magnet'
export type Card = { kind: 'sack'; bones: number; gold: boolean } | { kind: 'cat' } | { kind: 'fence' } | { kind: 'magnet' }

export const CARD_INFO: Record<CardKind, { label: string; icon: string; badge: string; tone: 'gain' | 'attack' | 'guard' }> = {
  sack: { label: '뼈다귀 보따리', icon: '/bone-rush/sack.webp', badge: '바로 획득', tone: 'gain' },
  cat: { label: '도둑 고양이 보내기', icon: '/bone-rush/cat.webp', badge: '훔치기', tone: 'attack' },
  fence: { label: '울타리 세우기', icon: '/bone-rush/fence.webp', badge: '지키기', tone: 'guard' },
  magnet: { label: '뼈다귀 자석', icon: '/survivor/item-magnet.webp', badge: '바로 획득', tone: 'gain' },
}

export function describeCard(card: Card, fences: number): string {
  switch (card.kind) {
    case 'sack':
      return card.gold ? `황금 보따리! 뼈다귀 ${card.bones}개가 쏟아져요` : `뼈다귀 ${card.bones}개가 쏟아져요`
    case 'cat':
      return `친구 마당에 고양이를 보내 꼬리 뼈다귀를 최대 ${BONE_RUSH.CAT_BITE * BONE_RUSH.CAT_MAX_BITES}개까지 물어 와요`
    case 'fence':
      return `다음 도둑 고양이를 막아요 (울타리 ${fences}/${BONE_RUSH.FENCE_MAX})`
    case 'magnet':
      return `${Math.round(BONE_RUSH.MAGNET_MS / 1000)}초 동안 뼈다귀가 저절로 날아와요`
    default:
      return ''
  }
}

// ─── 상태 ───
export type Pickup = {
  id: number
  kind: 'bone' | 'gold'
  x: number
  y: number
  vx: number
  vy: number
  value: number
  /** 내게 날아오는 중(보따리·자석) */
  pulled: boolean
  age: number
}

export type Chest = {
  id: number
  x: number
  y: number
  age: number
  /** 'wait' 땅에 있음 → 'open' 문제 중 → 'locked' 오답 뒤 잠깐 잠김 */
  phase: 'wait' | 'open' | 'locked'
  phaseMs: number
}

export type CatKind = 'friend' | 'wild' | 'courier'
export type CatPhase = 'enter' | 'chase' | 'stun' | 'leave' | 'deliver'

export type Cat = {
  id: number
  /** 네트워크 id (친구 고양이·배달 고양이). 들고양이는 '' */
  catId: string
  kind: CatKind
  fromId: string
  fromName: string
  x: number
  y: number
  phase: CatPhase
  phaseMs: number
  chaseLeftMs: number
  bites: number
  /** 물고 있는 뼈다귀 (친구 고양이는 훔친 것, 배달 고양이는 가져온 것) */
  carried: number
  /** 울타리에 막힘 (친구 고양이) */
  blocked: boolean
  kx: number
  ky: number
  fx: number
  flashMs: number
}

export type Effect = {
  id: number
  kind: 'bark' | 'ring' | 'text' | 'poof' | 'fence'
  x: number
  y: number
  r: number
  age: number
  life: number
  text?: string
  big?: boolean
}

export type TrailPoint = { x: number; y: number; d: number }

export type BoneRushStats = {
  /** 연 상자(문제 수)·정답·오답 */
  chests: number
  correct: number
  wrong: number
  /** 땅에서 주운 뼈다귀 */
  collected: number
  catsSent: number
  /** 친구 고양이에게 뺏긴 뼈다귀 / 내 고양이가 물어 온 뼈다귀 */
  stolen: number
  looted: number
  /** 울타리로 막은 고양이 수 */
  blocked: number
}

export type BoneRushState = {
  /** 실제로 흐른 플레이 시간 (문제 푸는 동안은 멈춘다) */
  playMs: number
  yard: { w: number; h: number }
  bones: number
  fences: number
  magnetMs: number
  player: { x: number; y: number; fx: number; fy: number; moving: boolean }
  trail: TrailPoint[]
  pickups: Pickup[]
  chest: Chest | null
  nextChestMs: number
  /** 상자에 닿아 문제를 기다리는 중 — 마당이 멈춘다 */
  pendingQuiz: boolean
  cats: Cat[]
  nextWildMs: number
  barkCd: number
  effects: Effect[]
  stats: BoneRushStats
  nextId: number
  spawnAcc: number
}

export type BoneRushSave = {
  v: 1
  bones: number
  fences: number
  playMs: number
  stats: BoneRushStats
}

export type StepInput = { mx: number; my: number }

export type StepEvent =
  | { type: 'chest' }
  | { type: 'pickup'; value: number }
  | { type: 'bark' }
  | { type: 'wild' }
  | { type: 'catArrived'; kind: CatKind; fromName: string }
  | { type: 'bite'; kind: CatKind; fromName: string; bones: number }
  | { type: 'blocked'; fromName: string }
  | { type: 'catLeft'; catId: string; fromId: string; fromName: string; carried: number; blocked: boolean }
  | { type: 'delivered'; fromName: string; bones: number }

const emptyStats = (): BoneRushStats => ({ chests: 0, correct: 0, wrong: 0, collected: 0, catsSent: 0, stolen: 0, looted: 0, blocked: 0 })

/** 화면 크기(px) → 마당 크기(세계 단위)와 배율. 어떤 기기든 마당 넓이가 같다 */
export function yardForScreen(width: number, height: number): { w: number; h: number; scale: number } {
  const scale = Math.sqrt((Math.max(1, width) * Math.max(1, height)) / BONE_RUSH.VIEW_AREA)
  return { w: width / scale, h: height / scale, scale }
}

/** 새 판(또는 저장값에서 이어서). 저장값이 있으면 같은 뼈다귀·울타리로 마당만 새로 시작한다 */
export function createBoneRushState(save?: BoneRushSave | null, yard: { w: number; h: number } = { w: 1000, h: 640 }): BoneRushState {
  const playMs = save?.playMs ?? 0
  return {
    playMs,
    yard: { w: yard.w, h: yard.h },
    bones: save?.bones ?? 0,
    fences: save?.fences ?? 0,
    magnetMs: 0,
    player: { x: yard.w / 2, y: yard.h / 2, fx: 1, fy: 0, moving: false },
    trail: [{ x: yard.w / 2, y: yard.h / 2, d: 0 }],
    pickups: [],
    chest: null,
    nextChestMs: playMs + BONE_RUSH.CHEST_FIRST_MS,
    pendingQuiz: false,
    cats: [],
    nextWildMs: Math.max(playMs + 15_000, playMs < BONE_RUSH.WILD_FIRST_MS ? BONE_RUSH.WILD_FIRST_MS : playMs + BONE_RUSH.WILD_EVERY_MS),
    barkCd: 0,
    effects: [],
    stats: { ...emptyStats(), ...(save?.stats ?? {}) },
    nextId: 1,
    spawnAcc: 0,
  }
}

/** 화면 크기가 바뀌면 마당 크기를 맞추고 안의 것들을 마당 안으로 옮긴다 */
export function resizeYard(state: BoneRushState, w: number, h: number): void {
  if (Math.abs(state.yard.w - w) < 0.5 && Math.abs(state.yard.h - h) < 0.5) return
  const sx = w / state.yard.w
  const sy = h / state.yard.h
  state.yard.w = w
  state.yard.h = h
  const move = (o: { x: number; y: number }) => {
    o.x *= sx
    o.y *= sy
  }
  move(state.player)
  for (const p of state.trail) move(p)
  for (const p of state.pickups) move(p)
  for (const c of state.cats) move(c)
  for (const e of state.effects) move(e)
  if (state.chest) move(state.chest)
}

const num = (value: unknown, fallback = 0) => (typeof value === 'number' && Number.isFinite(value) ? value : fallback)

/** players.item_effects → 저장값. 모양이 다르면 null (새 판) */
export function parseBoneRushSave(raw: unknown): BoneRushSave | null {
  if (!raw || typeof raw !== 'object') return null
  const value = raw as Partial<BoneRushSave>
  if (value.v !== 1) return null
  const stats = (value.stats ?? {}) as Partial<BoneRushStats>
  return {
    v: 1,
    bones: Math.max(0, Math.floor(num(value.bones))),
    fences: Math.max(0, Math.min(BONE_RUSH.FENCE_MAX, Math.floor(num(value.fences)))),
    playMs: Math.max(0, num(value.playMs)),
    stats: {
      chests: num(stats.chests),
      correct: num(stats.correct),
      wrong: num(stats.wrong),
      collected: num(stats.collected),
      catsSent: num(stats.catsSent),
      stolen: num(stats.stolen),
      looted: num(stats.looted),
      blocked: num(stats.blocked),
    },
  }
}

export function toBoneRushSave(state: BoneRushState): BoneRushSave {
  return {
    v: 1,
    bones: state.bones,
    fences: state.fences,
    playMs: Math.round(state.playMs),
    stats: { ...state.stats },
  }
}

// ─── 카드 ───
/** 정답 보상 카드. 친구가 없으면(과제·혼자) 고양이 대신 자석 */
export function drawCards(state: BoneRushState, canAttack: boolean, rng: () => number = Math.random): Card[] {
  const gold = rng() < BONE_RUSH.GOLD_SACK_CHANCE
  const cards: Card[] = [{ kind: 'sack', bones: gold ? BONE_RUSH.GOLD_SACK_BONES : BONE_RUSH.SACK_BONES, gold }]
  cards.push(canAttack ? { kind: 'cat' } : { kind: 'magnet' })
  if (state.fences < BONE_RUSH.FENCE_MAX) cards.push({ kind: 'fence' })
  else if (canAttack) cards.push({ kind: 'magnet' })
  else cards.push({ kind: 'sack', bones: BONE_RUSH.GOLD_SACK_BONES, gold: true })
  return cards.slice(0, BONE_RUSH.CHOICES)
}

function pushEffect(state: BoneRushState, effect: Omit<Effect, 'id' | 'age'>) {
  if (effect.kind === 'text' && state.effects.length > 40) return
  state.effects.push({ ...effect, id: state.nextId++, age: 0 })
}

/** 뼈다귀를 (x, y)에서 사방으로 쏟는다. pulled 면 바로 내게 날아온다 */
function burstBones(state: BoneRushState, x: number, y: number, count: number, pulled: boolean, rng: () => number) {
  for (let i = 0; i < count; i += 1) {
    const a = rng() * Math.PI * 2
    const sp = 160 + rng() * 160
    state.pickups.push({ id: state.nextId++, kind: 'bone', x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, value: 1, pulled, age: pulled ? 0 : 0 })
  }
}

/** 카드 적용 (고양이 카드는 보내기 자체는 훅이 하고 여기선 통계만). 상자를 닫고 다음 상자를 예약한다 */
export function applyCard(state: BoneRushState, card: Card, rng: () => number = Math.random): void {
  const chest = state.chest
  const x = chest?.x ?? state.player.x
  const y = chest?.y ?? state.player.y
  switch (card.kind) {
    case 'sack':
      burstBones(state, x, y, card.bones, true, rng)
      pushEffect(state, { kind: 'poof', x, y, r: 50, life: 500 })
      break
    case 'cat':
      state.stats.catsSent += 1
      break
    case 'fence':
      state.fences = Math.min(BONE_RUSH.FENCE_MAX, state.fences + 1)
      pushEffect(state, { kind: 'fence', x: state.yard.w / 2, y: state.yard.h / 2, r: 0, life: 900 })
      break
    case 'magnet':
      state.magnetMs = BONE_RUSH.MAGNET_MS
      pushEffect(state, { kind: 'ring', x: state.player.x, y: state.player.y, r: BONE_RUSH.MAGNET_RADIUS, life: 700 })
      break
    default:
      break
  }
  state.chest = null
  state.nextChestMs = state.playMs + BONE_RUSH.CHEST_DELAY_MS
  state.pendingQuiz = false
}

/** 오답: 상자가 잠기고 사라진다. 뼈다귀는 그대로 */
export function lockChest(state: BoneRushState): void {
  if (state.chest) {
    state.chest.phase = 'locked'
    state.chest.phaseMs = 1200
  }
  state.nextChestMs = state.playMs + BONE_RUSH.CHEST_DELAY_MS
  state.pendingQuiz = false
}

/** 상자에 닿았는데 문제를 못 여는 상황(문제 없음 등)이면 그냥 상자를 치운다 */
export function cancelChest(state: BoneRushState): void {
  state.chest = null
  state.nextChestMs = state.playMs + BONE_RUSH.CHEST_DELAY_MS
  state.pendingQuiz = false
}

// ─── 고양이 ───
function edgeSpawn(state: BoneRushState, rng: () => number): { x: number; y: number } {
  const { w, h } = state.yard
  const side = Math.floor(rng() * 4)
  const pad = 70
  if (side === 0) return { x: rng() * w, y: -pad }
  if (side === 1) return { x: w + pad, y: rng() * h }
  if (side === 2) return { x: rng() * w, y: h + pad }
  return { x: -pad, y: rng() * h }
}

function makeCat(state: BoneRushState, kind: CatKind, catId: string, fromId: string, fromName: string, rng: () => number): Cat {
  const at = edgeSpawn(state, rng)
  return {
    id: state.nextId++, catId, kind, fromId, fromName,
    x: at.x, y: at.y, phase: 'enter', phaseMs: 0,
    chaseLeftMs: BONE_RUSH.CAT_CHASE_MS, bites: 0, carried: 0, blocked: false,
    kx: 0, ky: 0, fx: 1, flashMs: 0,
  }
}

/** 친구가 보낸 도둑 고양이 들이기. 울타리가 있으면 하나 쓰고 막는다 */
export function admitCat(state: BoneRushState, cat: { catId: string; fromId: string; fromName: string }, rng: () => number = Math.random): void {
  if (state.cats.some((c) => c.catId === cat.catId && c.kind === 'friend')) return
  const c = makeCat(state, 'friend', cat.catId, cat.fromId, cat.fromName, rng)
  if (state.fences > 0) {
    state.fences -= 1
    state.stats.blocked += 1
    c.blocked = true
  }
  state.cats.push(c)
}

/** 내 고양이가 뼈다귀를 물고 돌아옴 (배달 고양이). bones 가 0 이면(막힘) 아무것도 안 한다 */
export function admitCourier(state: BoneRushState, loot: { catId: string; fromId: string; fromName: string; bones: number }, rng: () => number = Math.random): void {
  if (loot.bones <= 0) return
  if (state.cats.some((c) => c.catId === loot.catId && c.kind === 'courier')) return
  const c = makeCat(state, 'courier', loot.catId, loot.fromId, loot.fromName, rng)
  c.phase = 'deliver'
  c.carried = loot.bones
  state.cats.push(c)
}

function spawnWildCat(state: BoneRushState, rng: () => number): void {
  state.cats.push(makeCat(state, 'wild', '', '', '들고양이', rng))
}

/** 꼬리 끝에서 뼈다귀를 뺀다 */
function stealBones(state: BoneRushState, count: number): number {
  const taken = Math.min(count, state.bones)
  state.bones -= taken
  return taken
}

// ─── 꼬리 ───
/** 꼬리 뼈다귀 위치 (그리기용). 최근 지나온 길을 따라 뒤로 늘어선다 */
export function tailPositions(state: BoneRushState): Array<{ x: number; y: number }> {
  const count = Math.min(state.bones, BONE_RUSH.TAIL_MAX)
  if (count <= 0) return []
  const trail = state.trail
  const out: Array<{ x: number; y: number }> = []
  const head = trail[trail.length - 1]
  let j = trail.length - 1
  const p = state.player
  for (let i = 0; i < count; i += 1) {
    const want = head.d - (i + 1) * BONE_RUSH.TAIL_SPACING
    while (j > 0 && trail[j - 1].d > want) j -= 1
    if (j === 0) {
      // 아직 길이 짧으면 뒤쪽에 옹기종기 모여 있다
      const k = i - out.length
      const a = (k * 2.4) % (Math.PI * 2)
      const r = 10 + Math.sqrt(k) * 9
      const base = trail[0]
      out.push({ x: base.x - p.fx * 20 + Math.cos(a) * r, y: base.y - p.fy * 20 + Math.sin(a) * r })
      continue
    }
    const a = trail[j - 1]
    const b = trail[j]
    const span = b.d - a.d || 1
    const t = Math.max(0, Math.min(1, (want - a.d) / span))
    out.push({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t })
  }
  return out
}

function pushTrail(state: BoneRushState) {
  const trail = state.trail
  const head = trail[trail.length - 1]
  const p = state.player
  const d = Math.hypot(p.x - head.x, p.y - head.y)
  if (d < 4) return
  trail.push({ x: p.x, y: p.y, d: head.d + d })
  const keep = (BONE_RUSH.TAIL_MAX + 2) * BONE_RUSH.TAIL_SPACING
  while (trail.length > 2 && trail[trail.length - 1].d - trail[1].d > keep) trail.shift()
}

// ─── 한 스텝 ───
/**
 * 고정 스텝 하나. 상자를 열어 문제를 기다리는 중이면 아무것도 하지 않는다.
 * 돌려주는 이벤트로 화면이 소리·알림·퀴즈·네트워크 전송을 한다.
 */
export function stepBoneRush(state: BoneRushState, dtMs: number, input: StepInput, rng: () => number = Math.random): StepEvent[] {
  const events: StepEvent[] = []
  if (state.pendingQuiz) return events
  const dt = dtMs / 1000
  state.playMs += dtMs
  const p = state.player
  const { w, h } = state.yard
  const R = BONE_RUSH.PLAYER_RADIUS

  // 1) 이동
  let mx = input.mx
  let my = input.my
  const mag = Math.hypot(mx, my)
  if (mag > 1) {
    mx /= mag
    my /= mag
  }
  p.moving = mag > 0.15
  p.x = Math.max(R, Math.min(w - R, p.x + mx * BONE_RUSH.PLAYER_SPEED * dt))
  p.y = Math.max(R, Math.min(h - R, p.y + my * BONE_RUSH.PLAYER_SPEED * dt))
  if (p.moving) {
    const m = Math.hypot(mx, my) || 1
    p.fx = mx / m
    p.fy = my / m
  }
  pushTrail(state)
  state.magnetMs = Math.max(0, state.magnetMs - dtMs)

  // 2) 뼈다귀 떨어지기
  state.spawnAcc += dtMs
  if (state.spawnAcc >= BONE_RUSH.BONE_EVERY_MS) {
    state.spawnAcc = 0
    const ground = state.pickups.filter((item) => !item.pulled).length
    if (ground < BONE_RUSH.BONE_CAP) {
      let x = 0
      let y = 0
      for (let tries = 0; tries < 8; tries += 1) {
        x = 40 + rng() * (w - 80)
        y = 40 + rng() * (h - 80)
        if (Math.hypot(x - p.x, y - p.y) > 140) break
      }
      const gold = rng() < BONE_RUSH.GOLD_BONE_CHANCE
      state.pickups.push({ id: state.nextId++, kind: gold ? 'gold' : 'bone', x, y, vx: 0, vy: 0, value: gold ? BONE_RUSH.GOLD_BONE_VALUE : 1, pulled: false, age: 0 })
    }
  }

  // 3) 보물 상자
  if (state.chest) {
    const chest = state.chest
    chest.age += dtMs
    if (chest.phase === 'locked') {
      chest.phaseMs -= dtMs
      if (chest.phaseMs <= 0) state.chest = null
    } else if (chest.phase === 'wait') {
      const r = BONE_RUSH.CHEST_RADIUS + R - 4
      if ((chest.x - p.x) ** 2 + (chest.y - p.y) ** 2 < r * r) {
        chest.phase = 'open'
        state.pendingQuiz = true
        state.stats.chests += 1
        events.push({ type: 'chest' })
        return events
      }
    }
  } else if (state.playMs >= state.nextChestMs) {
    const minD = Math.hypot(w, h) * 0.3
    let x = w / 2
    let y = h / 2
    for (let tries = 0; tries < 12; tries += 1) {
      x = 60 + rng() * (w - 120)
      y = 60 + rng() * (h - 120)
      if (Math.hypot(x - p.x, y - p.y) >= minD) break
    }
    state.chest = { id: state.nextId++, x, y, age: 0, phase: 'wait', phaseMs: 0 }
  }

  // 4) 들고양이
  if (state.playMs >= state.nextWildMs) {
    state.nextWildMs = state.playMs + BONE_RUSH.WILD_EVERY_MS
    if (!state.cats.some((c) => c.kind === 'wild')) {
      spawnWildCat(state, rng)
      events.push({ type: 'wild' })
    }
  }

  // 5) 짖기 (가까이 온 고양이가 있을 때만)
  state.barkCd = Math.max(0, state.barkCd - dtMs)
  if (state.barkCd <= 0) {
    const near = state.cats.filter((c) => (c.kind !== 'courier') && (c.phase === 'chase' || c.phase === 'stun' || c.phase === 'enter') && !c.blocked && Math.hypot(c.x - p.x, c.y - p.y) < BONE_RUSH.BARK_RADIUS + BONE_RUSH.CAT_RADIUS)
    if (near.length > 0) {
      for (const c of near) {
        const dx = c.x - p.x
        const dy = c.y - p.y
        const d = Math.hypot(dx, dy) || 1
        c.kx += (dx / d) * BONE_RUSH.BARK_KNOCK
        c.ky += (dy / d) * BONE_RUSH.BARK_KNOCK
        if (c.phase === 'chase' || c.phase === 'enter') {
          c.phase = 'stun'
          c.phaseMs = BONE_RUSH.BARK_STUN_MS
        } else {
          c.phaseMs = Math.max(c.phaseMs, BONE_RUSH.BARK_STUN_MS)
        }
        c.flashMs = 200
      }
      state.barkCd = BONE_RUSH.BARK_EVERY_MS
      pushEffect(state, { kind: 'bark', x: p.x, y: p.y, r: BONE_RUSH.BARK_RADIUS, life: 420 })
      events.push({ type: 'bark' })
    }
  }

  // 6) 고양이 움직이기
  const damp = Math.exp(-dt * 7)
  const catR = BONE_RUSH.CAT_RADIUS
  state.cats = state.cats.filter((c) => {
    c.flashMs = Math.max(0, c.flashMs - dtMs)
    const toDog = () => {
      const dx = p.x - c.x
      const dy = p.y - c.y
      const d = Math.hypot(dx, dy) || 1
      return { dx, dy, d }
    }
    const applyKnock = () => {
      c.x += c.kx * dt
      c.y += c.ky * dt
      c.kx *= damp
      c.ky *= damp
    }
    const inside = () => c.x > catR && c.x < w - catR && c.y > catR && c.y < h - catR
    const clampInside = () => {
      c.x = Math.max(catR, Math.min(w - catR, c.x))
      c.y = Math.max(catR, Math.min(h - catR, c.y))
    }
    const step = (speed: number) => {
      const { dx, dy, d } = toDog()
      c.x += (dx / d) * speed * dt
      c.y += (dy / d) * speed * dt
      c.fx = dx >= 0 ? 1 : -1
    }

    switch (c.phase) {
      case 'enter': {
        step(BONE_RUSH.CAT_SPEED)
        if (inside()) {
          if (c.blocked) {
            // 울타리에 쿵! 바로 돌아간다
            pushEffect(state, { kind: 'fence', x: c.x, y: c.y, r: 0, life: 700 })
            pushEffect(state, { kind: 'text', x: c.x, y: c.y - 30, r: 0, life: 900, text: '울타리!', big: true })
            const { dx, dy, d } = toDog()
            c.kx = (-dx / d) * 260
            c.ky = (-dy / d) * 260
            c.phase = 'leave'
            events.push({ type: 'blocked', fromName: c.fromName })
          } else {
            c.phase = 'chase'
            events.push({ type: 'catArrived', kind: c.kind, fromName: c.fromName })
          }
        }
        return true
      }
      case 'deliver': {
        step(BONE_RUSH.CAT_SPEED * 1.1)
        const { d } = toDog()
        if (d < R + catR + 6) {
          state.bones += c.carried
          state.stats.looted += c.carried
          burstBones(state, c.x, c.y, Math.min(c.carried, 12), true, rng)
          // 쏟아진 뼈다귀는 보여 주기용 — 실제 수는 이미 더했으므로 줍지 않게 value 0
          for (let i = state.pickups.length - Math.min(c.carried, 12); i < state.pickups.length; i += 1) state.pickups[i].value = 0
          pushEffect(state, { kind: 'text', x: p.x, y: p.y - 40, r: 0, life: 1100, text: `+${c.carried}`, big: true })
          events.push({ type: 'delivered', fromName: c.fromName, bones: c.carried })
          c.carried = 0
          c.phase = 'leave'
        }
        return true
      }
      case 'chase': {
        c.chaseLeftMs -= dtMs
        step(BONE_RUSH.CAT_SPEED)
        applyKnock()
        clampInside()
        const { d } = toDog()
        if (d < R + catR) {
          if (state.bones <= 0) {
            pushEffect(state, { kind: 'text', x: c.x, y: c.y - 30, r: 0, life: 900, text: '빈손…' })
            c.phase = 'leave'
            return true
          }
          const bite = stealBones(state, BONE_RUSH.CAT_BITE)
          c.bites += 1
          c.flashMs = 250
          if (c.kind === 'friend') {
            c.carried += bite
            state.stats.stolen += bite
          } else {
            // 들고양이는 뼈다귀를 흩뿌린다 — 다시 주우면 된다
            burstBones(state, c.x, c.y, bite, false, rng)
          }
          pushEffect(state, { kind: 'text', x: p.x, y: p.y - 40, r: 0, life: 900, text: `-${bite}`, big: true })
          events.push({ type: 'bite', kind: c.kind, fromName: c.fromName, bones: bite })
          const { dx, dy, d: dd } = toDog()
          c.kx = (-dx / dd) * 140
          c.ky = (-dy / dd) * 140
          if (c.bites >= BONE_RUSH.CAT_MAX_BITES) c.phase = 'leave'
          else {
            c.phase = 'stun'
            c.phaseMs = BONE_RUSH.CAT_STUN_MS
          }
        } else if (c.chaseLeftMs <= 0) {
          c.phase = 'leave'
        }
        return true
      }
      case 'stun': {
        c.chaseLeftMs -= dtMs
        c.phaseMs -= dtMs
        applyKnock()
        clampInside()
        if (c.phaseMs <= 0) c.phase = c.chaseLeftMs <= 0 ? 'leave' : 'chase'
        return true
      }
      case 'leave': {
        // 가장 가까운 가장자리로 달아난다
        const toLeft = c.x
        const toRight = w - c.x
        const toTop = c.y
        const toBottom = h - c.y
        const min = Math.min(toLeft, toRight, toTop, toBottom)
        const sp = BONE_RUSH.CAT_SPEED * 1.25 * dt
        if (min === toLeft) { c.x -= sp; c.fx = -1 }
        else if (min === toRight) { c.x += sp; c.fx = 1 }
        else if (min === toTop) c.y -= sp
        else c.y += sp
        applyKnock()
        const out = c.x < -70 || c.x > w + 70 || c.y < -70 || c.y > h + 70
        if (!out) return true
        if (c.kind === 'friend') {
          events.push({ type: 'catLeft', catId: c.catId, fromId: c.fromId, fromName: c.fromName, carried: c.carried, blocked: c.blocked })
        }
        return false
      }
      default:
        return true
    }
  })

  // 7) 뼈다귀 줍기·날아오기
  const magnet = state.magnetMs > 0
  const collectR = R + 10
  let picked = 0
  state.pickups = state.pickups.filter((item) => {
    item.age += dtMs
    // 쏟아진 뼈다귀는 튀어 나가다 멈춘다
    if (item.vx !== 0 || item.vy !== 0) {
      item.x += item.vx * dt
      item.y += item.vy * dt
      const k = Math.exp(-dt * 5)
      item.vx *= k
      item.vy *= k
      if (Math.abs(item.vx) + Math.abs(item.vy) < 6) {
        item.vx = 0
        item.vy = 0
      }
      item.x = Math.max(16, Math.min(w - 16, item.x))
      item.y = Math.max(16, Math.min(h - 16, item.y))
    }
    const dx = p.x - item.x
    const dy = p.y - item.y
    const d = Math.hypot(dx, dy)
    if (d < collectR + (item.pulled ? 10 : 0)) {
      if (item.value > 0) {
        state.bones += item.value
        if (!item.pulled) state.stats.collected += item.value
        picked += item.value
        if (item.kind === 'gold') pushEffect(state, { kind: 'text', x: p.x, y: p.y - 40, r: 0, life: 900, text: `+${item.value}`, big: true })
      }
      return false
    }
    const pullNow = item.pulled || (magnet && d < BONE_RUSH.MAGNET_RADIUS)
    if (pullNow && item.age > 220) {
      item.pulled = true
      item.vx = 0
      item.vy = 0
      const pull = (420 + Math.max(0, 300 - d)) * dt
      item.x += (dx / (d || 1)) * Math.min(d, pull)
      item.y += (dy / (d || 1)) * Math.min(d, pull)
    }
    return true
  })
  if (picked > 0) events.push({ type: 'pickup', value: picked })

  // 8) 효과 나이 먹기
  state.effects = state.effects.filter((effect) => {
    effect.age += dtMs
    return effect.age < effect.life
  })

  return events
}

// ─── 결과·칭호 ───
export type BoneRushTitle = { id: string; emoji: string; label: string; description: string }

type TitlePlayer = { id: string; is_kicked?: boolean | null; score?: number | null; item_effects?: unknown }

const TITLES: Record<string, BoneRushTitle> = {
  richest: { id: 'richest', emoji: '🏆', label: '뼈다귀 부자', description: '뼈다귀를 가장 많이 가졌어요' },
  thief: { id: 'thief', emoji: '😼', label: '고양이 조련사', description: '고양이가 물어 온 뼈다귀가 가장 많아요' },
  guard: { id: 'guard', emoji: '🛡️', label: '철벽 울타리', description: '도둑 고양이를 가장 많이 막았어요' },
  scholar: { id: 'scholar', emoji: '📦', label: '보물 상자 달인', description: '상자를 가장 많이 열었어요' },
  runner: { id: 'runner', emoji: '🐾', label: '부지런한 발바닥', description: '땅에서 뼈다귀를 가장 많이 주웠어요' },
}

export function assignTitles(players: TitlePlayer[]): Map<string, BoneRushTitle[]> {
  const active = players.filter((player) => !player.is_kicked)
  const saveById = new Map(active.map((player) => {
    const save = parseBoneRushSave(player.item_effects) ?? toBoneRushSave(createBoneRushState())
    // 순위는 DB 점수를 따른다 (저장값이 조금 늦을 수 있다)
    save.bones = Math.max(save.bones, player.score ?? 0)
    return [player.id, save]
  }))
  const result = new Map<string, BoneRushTitle[]>(active.map((player) => [player.id, []]))
  const rules: Array<[string, (save: BoneRushSave) => number]> = [
    ['richest', (save) => save.bones],
    ['thief', (save) => save.stats.looted],
    ['guard', (save) => save.stats.blocked],
    ['scholar', (save) => save.stats.correct],
    ['runner', (save) => save.stats.collected],
  ]
  for (const [id, value] of rules) {
    let best = 0
    for (const save of saveById.values()) best = Math.max(best, value(save))
    if (best <= 0) continue
    for (const [playerId, save] of saveById) {
      if (value(save) === best) result.get(playerId)!.push(TITLES[id])
    }
  }
  for (const [playerId, save] of saveById) {
    const titles = result.get(playerId)!
    if (titles.length === 0) {
      titles.push(save.stats.catsSent > 0
        ? { id: 'sneaky', emoji: '🐾', label: '장난꾸러기 탐정', description: `도둑 고양이를 ${save.stats.catsSent}번 보냈어요` }
        : { id: 'collector', emoji: '🦴', label: '씩씩한 뼈다귀 수집가', description: `뼈다귀 ${save.bones}개를 끝까지 지켰어요` })
    }
  }
  return result
}

export function formatPlayTime(ms: number): string {
  const total = Math.floor(ms / 1000)
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}`
}

export function summarizeBoneRush(save: BoneRushSave): Array<{ label: string; value: string }> {
  return [
    { label: '가진 뼈다귀', value: `${save.bones.toLocaleString()}개` },
    { label: '연 상자', value: `${save.stats.correct}/${save.stats.chests}개` },
    { label: '물어 온 뼈다귀', value: `${save.stats.looted.toLocaleString()}개` },
    { label: '막은 고양이', value: `${save.stats.blocked}마리` },
  ]
}

/** 알림 문구에 쓰는 이름+조사 */
export const nameWithJosa = withJosa
