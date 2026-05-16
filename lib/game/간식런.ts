// 간식런 - 3차선 엔드리스 러너 게임 로직
export { formatTime } from '@/lib/utils/formatTime'

// ─── 상수 ───
export const GAME = {
  DURATION: 300,        // 5분
  LANE_COUNT: 3,
  QUIZ_INTERVAL: 30,    // 30초마다 퀴즈
  QUIZ_TIMEOUT: 10,     // 퀴즈 제한시간 10초
  SLOWMO_RATE: 0.3,     // 퀴즈 중 슬로우모션
  SPEED_STAGES: [
    { time: 0, speed: 1.0 },
    { time: 30, speed: 1.15 },
    { time: 60, speed: 1.3 },
    { time: 120, speed: 1.5 },
    { time: 180, speed: 1.7 },
    { time: 240, speed: 2.0 },
  ],
  BASE_SCROLL_SPEED: 4.5, // px per frame
  SPAWN_INTERVAL_OBSTACLE: 55, // frames
  SPAWN_INTERVAL_BONE: 25,     // 더 자주 스폰
  INVINCIBLE_DURATION: 60,     // frames (1초)
  BOX_SPAWN_DELAY: 45,         // frames (~0.75초)
  NEARMISS_DIST: 50,           // 니어미스 판정 거리
  COMBO_DECAY_FRAMES: 90,      // 콤보 유지 시간 (1.5초)
} as const

// ─── 플로팅 텍스트 (UI 표시용) ───
export interface FloatingText {
  id: number
  text: string
  x: number  // 0~1 normalized
  y: number
  color: string
  size: number
  life: number
  maxLife: number
}

// ─── 타입 ───
export type Lane = 0 | 1 | 2

export type ItemType =
  | 'booster' | 'shield' | 'double_score'
  | 'magnet' | 'golden_rain'
  | 'big_dog' | 'drone' | 'golden_mode'
  | 'score_steal' | 'screen_flip' | 'screen_shrink'

export type ItemRarity = 'common' | 'rare' | 'epic' | 'legendary'

export interface ActiveItem {
  type: ItemType
  remaining: number // frames remaining
}

export interface GameObject {
  id: string
  lane: Lane
  y: number    // position (0=top, screen scrolls down)
  type: 'obstacle' | 'bone' | 'golden_bone' | 'box'
  collected?: boolean
  spawnedAt?: number
}

export interface GansikRunState {
  lane: Lane
  targetLane: Lane      // 부드러운 차선 이동용
  laneProgress: number  // 0~1 이동 진행도
  score: number
  distance: number
  bonesCollected: number
  goldenBonesCollected: number
  boxesOpened: number
  quizCorrect: number
  quizTotal: number
  invincibleTimer: number
  activeItems: ActiveItem[]
  hasShield: boolean
  speedMultiplier: number
  scoreMultiplier: number
  isMagnetActive: boolean
  isBigDog: boolean
  isDrone: boolean
  objects: GameObject[]
  timeRemaining: number
  elapsed: number
  nextQuizAt: number
  isQuizActive: boolean
  pendingBoxes: boolean
  boxSpawnTimer: number
  gameOver: boolean
  frameCount: number
  // 콤보 시스템
  combo: number
  maxCombo: number
  comboTimer: number    // 콤보 유지 타이머
  // 니어미스
  nearMissCount: number
  // 마일스톤
  lastMilestone: number
  // UI 이벤트
  floatingTexts: FloatingText[]
  _lastBoxItem?: ItemType
  _events: string[]     // UI 이벤트 큐
}

// ─── 아이템 정의 ───
export const ITEM_DEFS: Record<ItemType, { emoji: string; name: string; rarity: ItemRarity; duration: number; description: string }> = {
  booster:      { emoji: '🚀', name: '부스터',     rarity: 'common',    duration: 300,  description: '2배속 + 무적' },
  shield:       { emoji: '🛡️', name: '방어막',     rarity: 'common',    duration: 9999, description: '충돌 1회 무효화' },
  double_score: { emoji: '✨', name: '점수 2배',   rarity: 'common',    duration: 900,  description: '모든 점수 ×2' },
  magnet:       { emoji: '🧲', name: '자석',       rarity: 'rare',      duration: 600,  description: '인접 차선 뼈다귀 흡수' },
  golden_rain:  { emoji: '💰', name: '황금 비',    rarity: 'rare',      duration: 300,  description: '황금 뼈다귀 3배' },
  score_steal:  { emoji: '🕶️', name: '점수 뺏기',  rarity: 'rare',      duration: 0,    description: '친구 점수 일부 훔치기' },
  big_dog:      { emoji: '🐕‍🦺', name: '큰 강아지', rarity: 'epic',      duration: 420,  description: '장애물 파괴 + 점수' },
  drone:        { emoji: '🚁', name: '드론',       rarity: 'epic',      duration: 480,  description: '공중 비행, 장애물 무시' },
  screen_flip:  { emoji: '🔄', name: '화면 뒤집기', rarity: 'epic',      duration: 420,  description: '다른 친구들 화면 뒤집기' },
  screen_shrink:{ emoji: '🔍', name: '화면 축소',   rarity: 'epic',      duration: 420,  description: '다른 친구들 화면 작게 만들기' },
  golden_mode:  { emoji: '👑', name: '황금 모드',  rarity: 'legendary', duration: 300,  description: '부스터+자석+점수2배' },
}

// 박스 확률 테이블
const BOX_TABLE: { rarity: ItemRarity; chance: number; items: ItemType[] }[] = [
  { rarity: 'common',    chance: 0.52, items: ['booster', 'shield', 'double_score'] },
  { rarity: 'rare',      chance: 0.30, items: ['magnet', 'golden_rain', 'score_steal'] },
  { rarity: 'epic',      chance: 0.16, items: ['big_dog', 'drone', 'screen_flip', 'screen_shrink'] },
  { rarity: 'legendary', chance: 0.02, items: ['golden_mode'] },
]

const SPAWN_CONFLICT_GAP = 82
const BONE_HAZARD_GAP = 76
const BOX_CLEAR_TOP = -180
const BOX_CLEAR_BOTTOM = 300

export const OBSTACLE_EMOJIS = ['🚧', '📦', '🚗']
let _nextId = 0
function nextId(): string { return `obj-${_nextId++}-${Date.now()}` }

function hasSpawnConflict(
  objs: GameObject[],
  lane: Lane,
  y: number,
  gap: number,
  types: GameObject['type'][],
): boolean {
  return objs.some((obj) =>
    obj.lane === lane
    && types.includes(obj.type)
    && Math.abs(obj.y - y) < gap
  )
}

function pushIfClear(
  objs: GameObject[],
  obj: GameObject,
  gap = SPAWN_CONFLICT_GAP,
  types: GameObject['type'][] = ['obstacle', 'bone', 'golden_bone', 'box'],
): boolean {
  if (hasSpawnConflict(objs, obj.lane, obj.y, gap, types)) return false
  objs.push(obj)
  return true
}

function clearRewardBoxPath(objs: GameObject[]): GameObject[] {
  return objs.filter((obj) =>
    obj.type === 'box'
    || obj.y < BOX_CLEAR_TOP
    || obj.y > BOX_CLEAR_BOTTOM
  )
}

// ─── 초기 상태 ───
let _floatId = 0
export function addFloatingText(s: GansikRunState, text: string, x: number, y: number, color = '#fff', size = 16): GansikRunState {
  const ft: FloatingText = { id: _floatId++, text, x, y, color, size, life: 45, maxLife: 45 }
  return { ...s, floatingTexts: [...s.floatingTexts, ft] }
}

export function createInitialState(): GansikRunState {
  _nextId = 0
  _floatId = 0
  return {
    lane: 1,
    targetLane: 1,
    laneProgress: 1,
    score: 0,
    distance: 0,
    bonesCollected: 0,
    goldenBonesCollected: 0,
    boxesOpened: 0,
    quizCorrect: 0,
    quizTotal: 0,
    invincibleTimer: 0,
    activeItems: [],
    hasShield: false,
    speedMultiplier: 1,
    scoreMultiplier: 1,
    isMagnetActive: false,
    isBigDog: false,
    isDrone: false,
    objects: [],
    timeRemaining: GAME.DURATION,
    elapsed: 0,
    nextQuizAt: GAME.QUIZ_INTERVAL,
    isQuizActive: false,
    pendingBoxes: false,
    boxSpawnTimer: 0,
    gameOver: false,
    frameCount: 0,
    combo: 0,
    maxCombo: 0,
    comboTimer: 0,
    nearMissCount: 0,
    lastMilestone: 0,
    floatingTexts: [],
    _events: [],
  }
}

// ─── 속도 계산 ───
export function getCurrentSpeed(elapsed: number): number {
  let multiplier = 1.0
  for (const stage of GAME.SPEED_STAGES) {
    if (elapsed >= stage.time) multiplier = stage.speed
  }
  return GAME.BASE_SCROLL_SPEED * multiplier
}

// ─── 차선 이동 ───
export function moveLane(state: GansikRunState, direction: 'left' | 'right'): GansikRunState {
  if (state.isQuizActive || state.gameOver) return state
  let newLane = state.targetLane
  if (direction === 'left' && newLane > 0) newLane = (newLane - 1) as Lane
  if (direction === 'right' && newLane < 2) newLane = (newLane + 1) as Lane
  return { ...state, targetLane: newLane, laneProgress: 0 }
}

// ─── 박스 아이템 결정 ───
export function rollBoxItem(): ItemType {
  const r = Math.random()
  let cumulative = 0
  for (const entry of BOX_TABLE) {
    cumulative += entry.chance
    if (r < cumulative) {
      return entry.items[Math.floor(Math.random() * entry.items.length)]
    }
  }
  return 'booster'
}

// ─── 아이템 적용 ───
export function applyItem(state: GansikRunState, item: ItemType): GansikRunState {
  const def = ITEM_DEFS[item]
  const s = { ...state, boxesOpened: state.boxesOpened + 1 }

  if (item === 'score_steal' || item === 'screen_flip' || item === 'screen_shrink') {
    return s
  }

  // 특수 처리
  if (item === 'shield') {
    return { ...s, hasShield: true }
  }
  if (item === 'golden_mode') {
    // 부스터 + 자석 + 점수2배 동시
    const items = s.activeItems.filter(i => !['booster', 'magnet', 'double_score', 'golden_mode'].includes(i.type))
    items.push({ type: 'golden_mode', remaining: def.duration })
    return {
      ...s,
      activeItems: items,
      speedMultiplier: 2,
      scoreMultiplier: 2,
      isMagnetActive: true,
      invincibleTimer: def.duration,
    }
  }

  // 일반 아이템: 기존 같은 타입은 교체 (갱신)
  const items = s.activeItems.filter(i => i.type !== item)
  items.push({ type: item, remaining: def.duration })

  const newState = { ...s, activeItems: items }

  // 효과 반영
  if (item === 'booster') {
    newState.speedMultiplier = 2
    newState.invincibleTimer = Math.max(newState.invincibleTimer, def.duration)
  }
  if (item === 'double_score') newState.scoreMultiplier = 2
  if (item === 'magnet') newState.isMagnetActive = true
  if (item === 'big_dog') { newState.isBigDog = true; newState.invincibleTimer = Math.max(newState.invincibleTimer, def.duration) }
  if (item === 'drone') { newState.isDrone = true; newState.invincibleTimer = Math.max(newState.invincibleTimer, def.duration) }
  if (item === 'golden_rain') { /* 효과는 spawn 로직에서 처리 */ }

  return newState
}

// ─── 아이템 틱 (매 프레임) ───
function tickItems(state: GansikRunState): GansikRunState {
  const items = state.activeItems
    .map(i => ({ ...i, remaining: i.remaining - 1 }))
    .filter(i => i.remaining > 0)

  const s = { ...state, activeItems: items }

  // 효과 재계산
  s.speedMultiplier = items.some(i => i.type === 'booster' || i.type === 'golden_mode') ? 2 : 1
  s.scoreMultiplier = items.some(i => i.type === 'double_score' || i.type === 'golden_mode') ? 2 : 1
  s.isMagnetActive = items.some(i => i.type === 'magnet' || i.type === 'golden_mode')
  s.isBigDog = items.some(i => i.type === 'big_dog')
  s.isDrone = items.some(i => i.type === 'drone')

  // 방어막은 activeItems에 없고 hasShield로 관리
  if (s.invincibleTimer > 0) s.invincibleTimer--

  return s
}

// ─── 뼈다귀 패턴 스폰 ───
function spawnBonePattern(objs: GameObject[], fc: number, isGoldenRain: boolean) {
  const pattern = fc % 200 < 100 ? 'line' : (fc % 300 < 100 ? 'zigzag' : 'single')
  const isGolden = isGoldenRain ? Math.random() < 0.5 : Math.random() < 0.06
  const boneType = isGolden ? 'golden_bone' as const : 'bone' as const

  if (pattern === 'line') {
    // 한 줄로 3~5개 연속
    const lane = Math.floor(Math.random() * 3) as Lane
    if (hasSpawnConflict(objs, lane, -40, BONE_HAZARD_GAP, ['obstacle', 'box'])) return
    const count = 3 + Math.floor(Math.random() * 3)
    for (let i = 0; i < count; i++) {
      const y = -40 - i * 35
      if (!hasSpawnConflict(objs, lane, y, BONE_HAZARD_GAP, ['obstacle', 'box'])) {
        objs.push({ id: nextId(), lane, y, type: boneType })
      }
    }
  } else if (pattern === 'zigzag') {
    // 지그재그
    let lane = Math.floor(Math.random() * 3) as Lane
    for (let i = 0; i < 4; i++) {
      const y = -40 - i * 35
      if (!hasSpawnConflict(objs, lane, y, BONE_HAZARD_GAP, ['obstacle', 'box'])) {
        objs.push({ id: nextId(), lane, y, type: boneType })
      }
      lane = ((lane + (Math.random() > 0.5 ? 1 : -1) + 3) % 3) as Lane
    }
  } else {
    const lane = Math.floor(Math.random() * 3) as Lane
    pushIfClear(objs, { id: nextId(), lane, y: -40, type: boneType }, BONE_HAZARD_GAP, ['obstacle', 'box'])
  }
}

// ─── 스폰 ───
function spawnObjects(state: GansikRunState, canvasH: number): GameObject[] {
  const rewardBoxesPending = state.pendingBoxes
  const rewardBoxesDropping = state.pendingBoxes && state.boxSpawnTimer <= 0
  const objs = rewardBoxesPending ? clearRewardBoxPath(state.objects) : [...state.objects]
  const fc = state.frameCount
  const isGoldenRain = state.activeItems.some(i => i.type === 'golden_rain')
  const elapsed = state.elapsed

  // 장애물 — 시간에 따라 더 자주, 가끔 2개 동시
  const obstacleInterval = Math.max(30, GAME.SPAWN_INTERVAL_OBSTACLE - Math.floor(elapsed / 30) * 3)
  if (!rewardBoxesPending && fc % obstacleInterval === 0 && !state.isDrone) {
    const lane = Math.floor(Math.random() * 3) as Lane
    const spawned = pushIfClear(objs, { id: nextId(), lane, y: -60, type: 'obstacle' })
    // 2분 이후 가끔 2개 동시
    if (spawned && elapsed > 120 && Math.random() < 0.3) {
      let lane2 = ((lane + (Math.random() > 0.5 ? 1 : 2)) % 3) as Lane
      pushIfClear(objs, { id: nextId(), lane: lane2, y: -60, type: 'obstacle' })
    }
  }

  // 뼈다귀 패턴
  if (!rewardBoxesPending && fc % GAME.SPAWN_INTERVAL_BONE === 0) {
    spawnBonePattern(objs, fc, isGoldenRain)
  }

  // 정답 후 박스 스폰
  if (rewardBoxesDropping) {
    for (let l = 0; l < 3; l++) {
      objs.push({ id: nextId(), lane: l as Lane, y: -30, type: 'box', spawnedAt: fc })
    }
  }

  return objs
}

// ─── 메인 게임 틱 ───
export function gameTick(state: GansikRunState, canvasH: number): GansikRunState {
  if (state.gameOver || state.isQuizActive) {
    // 슬로우모션 중에도 아주 느리게 진행
    if (state.isQuizActive) {
      const slowSpeed = getCurrentSpeed(state.elapsed) * GAME.SLOWMO_RATE
      const objects = state.objects
        .map(o => ({ ...o, y: o.y + slowSpeed }))
        .filter(o => o.y < canvasH + 100 && !o.collected)
      return { ...state, objects, frameCount: state.frameCount + 1 }
    }
    return state
  }

  let s = { ...state, frameCount: state.frameCount + 1, _events: [] as string[] }

  // 부드러운 차선 이동
  if (s.laneProgress < 1) {
    s.laneProgress = Math.min(1, s.laneProgress + 0.15)
    if (s.laneProgress >= 1) s.lane = s.targetLane
  }

  // 콤보 타이머 감소
  if (s.comboTimer > 0) {
    s.comboTimer--
    if (s.comboTimer <= 0) {
      s.combo = 0
    }
  }

  // 플로팅 텍스트 업데이트
  s.floatingTexts = s.floatingTexts
    .map(ft => ({ ...ft, life: ft.life - 1, y: ft.y - 1.2 }))
    .filter(ft => ft.life > 0)

  // 타이머 (매 60프레임 = 1초)
  if (s.frameCount % 60 === 0) {
    s.elapsed += 1
    s.timeRemaining = Math.max(0, GAME.DURATION - s.elapsed)
    s.score += s.scoreMultiplier

    if (s.timeRemaining <= 0) return { ...s, gameOver: true }
    if (s.elapsed >= s.nextQuizAt) return { ...s, isQuizActive: true }

    // 마일스톤 체크 (100점 단위)
    const milestone = Math.floor(s.score / 100) * 100
    if (milestone > s.lastMilestone && milestone > 0) {
      s.lastMilestone = milestone
      s._events = [...s._events, `milestone:${milestone}`]
      s = addFloatingText(s, `🎉 ${milestone}점 돌파!`, 0.5, 200, '#fbbf24', 24)
    }
  }

  s = tickItems(s)

  if (s.pendingBoxes && s.boxSpawnTimer > 0) {
    s.boxSpawnTimer--
  }

  const shouldDropRewardBoxes = s.pendingBoxes && s.boxSpawnTimer <= 0
  if (shouldDropRewardBoxes) {
    s._events = [...s._events, 'box_drop']
  }

  s.objects = spawnObjects(s, canvasH)
  if (s.pendingBoxes && s.boxSpawnTimer <= 0) {
    s.pendingBoxes = false
  }

  const speed = getCurrentSpeed(s.elapsed) * s.speedMultiplier
  s.objects = s.objects.map(o => ({ ...o, y: o.y + speed }))

  // 충돌 감지
  const playerY = canvasH * 0.75
  const hitZoneTop = playerY - 30
  const hitZoneBottom = playerY + 30
  // 현재 보간된 차선 위치
  const currentLaneF = s.laneProgress < 1
    ? s.lane + (s.targetLane - s.lane) * s.laneProgress
    : s.lane
  const isBoosting = s.activeItems.some(item => item.type === 'booster' || item.type === 'golden_mode')

  const newObjects: GameObject[] = []
  for (const obj of s.objects) {
    if (obj.collected || obj.y > canvasH + 100) continue

    const inHitZone = obj.y >= hitZoneTop && obj.y <= hitZoneBottom
    const isInLane = obj.lane === s.targetLane || (s.isMagnetActive && Math.abs(obj.lane - s.targetLane) <= 1)

    if (inHitZone && isInLane) {
      if (obj.type === 'bone' || obj.type === 'golden_bone') {
        const pts = obj.type === 'golden_bone' ? 10 : 1
        // 콤보 보너스
        s.combo++
        s.comboTimer = GAME.COMBO_DECAY_FRAMES
        s.maxCombo = Math.max(s.maxCombo, s.combo)
        const comboBonus = Math.floor(s.combo / 5) // 5콤보마다 +1
        const totalPts = (pts + comboBonus) * s.scoreMultiplier
        s.score += totalPts
        if (obj.type === 'golden_bone') s.goldenBonesCollected++
        else s.bonesCollected++

        // 플로팅 점수 텍스트
        const laneX = (obj.lane + 0.5) / 3
        const ptColor = obj.type === 'golden_bone' ? '#fbbf24' : '#fff'
        s = addFloatingText(s, `+${totalPts}`, laneX, obj.y, ptColor, 14)
        if (s.combo > 0 && s.combo % 5 === 0) {
          s = addFloatingText(s, `🔥 ${s.combo} COMBO!`, 0.5, obj.y - 20, '#ff6b35', 20)
          s._events = [...s._events, 'combo']
        }
        continue
      }
      if (obj.type === 'box') {
        const item = rollBoxItem()
        s = applyItem(s, item)
        s._lastBoxItem = item
        s._events = [...s._events, 'box_collect']
        continue
      }
    }

    // 장애물 충돌
    if (obj.type === 'obstacle' && inHitZone && obj.lane === s.targetLane) {
      if (s.isDrone || isBoosting) continue
      if (s.isBigDog) { s.score += 20 * s.scoreMultiplier; s = addFloatingText(s, '+20 💥', 0.5, obj.y, '#f59e0b', 18); continue }
      if (s.hasShield) { s.hasShield = false; s._events = [...s._events, 'shield_break']; continue }
      if (s.invincibleTimer > 0) continue
      s.score -= 100
      s.combo = 0
      s.comboTimer = 0
      s.invincibleTimer = GAME.INVINCIBLE_DURATION
      s = addFloatingText(s, '-100', 0.5, playerY, '#ef4444', 22)
      s._events = [...s._events, 'hit']
      continue
    }

    // 니어미스 감지 (다른 차선의 장애물이 지나감)
    if (obj.type === 'obstacle' && obj.lane !== s.targetLane) {
      const nearDist = Math.abs(obj.y - playerY)
      if (nearDist < GAME.NEARMISS_DIST && nearDist > 10 && Math.abs(obj.lane - s.targetLane) === 1) {
        // 프레임당 한번만 (y가 처음 지나갈때)
        if (obj.y >= playerY - 5 && obj.y < playerY + speed + 5) {
          s.nearMissCount++
          s.score += 5 * s.scoreMultiplier
          s = addFloatingText(s, 'NEAR MISS! +5', 0.5, playerY - 40, '#06b6d4', 16)
          s._events = [...s._events, 'nearmiss']
        }
      }
    }

    newObjects.push(obj)
  }
  s.objects = newObjects

  return s
}

// ─── 퀴즈 결과 처리 ───
export function handleQuizResult(state: GansikRunState, correct: boolean): GansikRunState {
  const s = {
    ...state,
    isQuizActive: false,
    nextQuizAt: state.elapsed + GAME.QUIZ_INTERVAL,
    quizTotal: state.quizTotal + 1,
  }

  if (correct) {
    s.quizCorrect = state.quizCorrect + 1
    s.score += 50 * state.scoreMultiplier
    s.pendingBoxes = true
    s.boxSpawnTimer = GAME.BOX_SPAWN_DELAY
  }

  return s
}
