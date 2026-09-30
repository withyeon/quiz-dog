'use client'

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode, type RefObject } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import TowerDefenseMap from '@/components/TowerDefenseMap'
import SkillChoiceModal from '@/components/SkillChoiceModal'
import TowerBattleHeader from '@/components/tower/TowerBattleHeader'
import TowerItemBar from '@/components/tower/TowerItemBar'
import TowerPlacementPanel from '@/components/tower/TowerPlacementPanel'
import TowerQuizOverlay from '@/components/tower/TowerQuizOverlay'
import TowerToast from '@/components/tower/TowerToast'
import TowerWaveClearToast from '@/components/tower/TowerWaveClearToast'
import TowerWavePanel from '@/components/tower/TowerWavePanel'
import { TutorialDemoFrame, GlassQuizStep, TapPointer, DEMO_SET_NAME } from '@/components/tutorial/TutorialDemoFrame'
import {
  ENEMY_TYPES,
  LASER_BEAM_DURATION_MS,
  MAP_HEIGHT,
  MAP_WIDTH,
  PATH_POINTS,
  PLAYER_START_GOLD,
  PLAYER_START_HP,
  PROJECTILE_HIT_RADIUS,
  PROJECTILE_SPEED,
  TOWER_QUIZZES_PER_WAVE,
  TOWER_QUIZ_TIME_LIMIT,
  TOWER_TYPES,
  WAVES,
  applyProjectileHit,
  calculateQuizGoldReward,
  canPlaceTowerAtPoint,
  getDistance,
  getEnemyLeakDamage,
  getLaserPierceCount,
  getNextPosition,
  getQuizGoldRange,
  getTowerDamage,
  getTowerHitDamage,
  getTowerQuizStatus,
  getTowerRange,
  getTowerWaveOutlook,
  hasReachedEnd,
  moveProjectile,
  type BuildSlot,
  type Enemy,
  type EnemyTypeId,
  type LaserBeam,
  type Projectile,
  type Tower,
  type TowerQuizProgress,
  type TowerTypeId,
} from '@/lib/game/tower'
import { SKILLS, getItemBlockReason, type SkillId } from '@/lib/game/skills'
import { createHitParticles, updateParticles, type Particle } from '@/lib/game/particles'

/**
 * 타워 디펜스 튜토리얼 데모.
 *   (app/tower/page.tsx · hooks/useTowerDefenseGame.ts · lib/game/tower.ts)
 * 장면 6개는 튜토리얼 규칙 6장과 1:1로 맞춰 두었습니다.
 *
 * 실제 화면과 같은 재료로 그립니다:
 *   - 배경은 실제 화면 클래스(tower-command-screen), 헤더는 TowerBattleHeader 그대로
 *   - 맵은 실제 TowerDefenseMap 캔버스 — 길·입구·출구·타워·적·화살·폭발이 게임과 똑같이 그려진다
 *   - 웨이브 패널 · 아이템 칸 · 타워 배치 패널 · 웨이브 퀴즈 화면 · 아이템 고르기 · 안내 토스트도 실제 컴포넌트
 * 맵 위 전투는 실제 규칙 함수(getNextPosition · applyProjectileHit · getTowerDamage …)로 움직이고,
 * 타워 설치는 실제 맵의 클릭 처리(canPlaceTowerAtPoint)를 그대로 거칩니다. 헤더 문구는 게임과 같은
 * getTowerQuizStatus 로 만들기 때문에 밸런스나 문구가 바뀌면 데모도 따라 바뀝니다.
 */

const DEMO_ROOM_CODE = '482913'
const noop = () => {}

// ───────────── 이야기 흐름과 숫자 ─────────────
// 3~5장: 게임 시작 → 웨이브 1 전에 퀴즈 3문제 · 6장: 화살 타워를 세우고 웨이브 1 시작
// 1·2장: 타워를 몇 개 더 세운 뒤 웨이브 1 이 한창일 때

/** 바로 맞혔을 때 받는 골드 (최대) */
const QUIZ_GOLD_FAST = getQuizGoldRange().max
/** 두 번째 문제는 6초 걸려 맞힌 것으로 — 빨리 풀수록 골드가 많다는 걸 숫자로도 보여 준다 */
const QUIZ_GOLD_SECOND = calculateQuizGoldReward(6, TOWER_QUIZ_TIME_LIMIT)
const GOLD_AFTER_FIRST = PLAYER_START_GOLD + QUIZ_GOLD_FAST
const GOLD_BEFORE_THIRD = GOLD_AFTER_FIRST + QUIZ_GOLD_SECOND
const GOLD_AFTER_QUIZZES = GOLD_BEFORE_THIRD + QUIZ_GOLD_FAST

/** 6장에서 세우는 타워와 자리 — 첫 모퉁이 안쪽. 입구에서 나온 적이 곧바로 사거리에 들어온다 */
const BUILD_TYPE: TowerTypeId = 'BASIC'
const BUILD_SPOT = { x: 100, y: 250 }
/** 6장에서 먼저 올려 보는 길 위 — canPlaceTowerAtPoint 가 막는 자리 */
const PATH_SPOT = { x: 150, y: 330 }

type DemoTower = { type: TowerTypeId; x: number; y: number }

/** 1·2장: 6장의 화살 타워에 폭탄·얼음 타워를 더 세운 모습 (모두 실제로 세울 수 있는 자리) */
const BATTLE_TOWERS: DemoTower[] = [
  { type: BUILD_TYPE, ...BUILD_SPOT },
  { type: 'BOMB', x: 200, y: 350 },
  { type: 'SLOW', x: 300, y: 350 },
]
/** 웨이브 1 에서 이미 처치한 적 수 (1장 시작 시점) */
const KILLED_BEFORE = 4
const KILL_GOLD = ENEMY_TYPES.NORMAL.goldReward * KILLED_BEFORE
const GOLD_IN_WAVE_ONE = GOLD_AFTER_QUIZZES - BATTLE_TOWERS.reduce((sum, tower) => sum + TOWER_TYPES[tower.type].cost, 0) + KILL_GOLD
const EARNED_IN_WAVE_ONE = GOLD_AFTER_QUIZZES - PLAYER_START_GOLD + KILL_GOLD

/**
 * 3문제를 다 맞히면 나오는 아이템 3장. 실제로는 getSkillChoices 가 흔한 아이템 3장을 뽑고
 * 그중 하나를 희귀 아이템(번개 · 공습)으로 꼭 바꿔 넣는다 — 그래서 번개가 들어 있다.
 */
const ITEM_CHOICES: SkillId[] = ['BLIZZARD', 'THUNDER', 'HEAL']
const PICKED_ITEM: SkillId = 'THUNDER'

const EXIT_POINT = PATH_POINTS[PATH_POINTS.length - 1]

const FIRST_QUIZ = { question: '세종대왕이 만든 글자는?', options: ['한글', '한자', '숫자', '그림'], correctIndex: 0 }
const THIRD_QUIZ = { question: '태양계에서 가장 큰 행성은?', options: ['목성', '지구', '화성', '금성'], correctIndex: 0 }

// ───────────── 맵 위 전투 (실제 게임 루프를 규칙 함수로 그대로 따라 한다) ─────────────

const TICK_MS = 50 // 실제 게임 루프와 같은 간격 (hooks/useTowerDefenseGame)
const MAX_TICK_DELTA = 0.25
const MAX_PARTICLES = 240
const WAVE_CLEAR_TOAST_MS = 2500
const LEAK_MARK_MS = 1100

type DemoEnemy = {
  type: EnemyTypeId
  /** 입구에서 길을 따라 간 거리(px) */
  distance: number
  /** 남은 체력 비율 — 앞쪽 타워에 이미 맞은 적 */
  hpRatio?: number
}

type BattleSnapshot = {
  hp: number
  gold: number
  earned: number
  currentWave: number
  isWaveActive: boolean
  towers?: DemoTower[]
  enemies?: DemoEnemy[]
  /** 입구에서 나올 적 — 불러온 순간부터 delayMs 뒤 */
  spawns?: { type: EnemyTypeId; delayMs: number }[]
}

type World = {
  /** 장면을 새로 불러올 때마다 오른다 — 헤더 숫자가 세어 올라가지 않고 바로 바뀌게 */
  version: number
  nextId: number
  towers: Tower[]
  enemies: Enemy[]
  projectiles: Projectile[]
  beams: LaserBeam[]
  particles: Particle[]
  queue: { type: EnemyTypeId; spawnTime: number }[]
  hp: number
  gold: number
  earned: number
  currentWave: number
  isWaveActive: boolean
  shakeIntensity: number
  shakeUntil: number
  waveClear: number | null
  waveClearUntil: number
  leaks: { id: number; damage: number; until: number }[]
}

type BattleView = Omit<World, 'nextId' | 'queue' | 'shakeUntil' | 'waveClearUntil'> & {
  /** 아직 입구에서 안 나온 적 수 — 실제 헤더의 "N마리 남음" 과 같은 뜻 */
  queueCount: number
}

/** 입구에서 길을 따라 distance(px) 만큼 간 자리 */
function pointOnPath(distance: number): { x: number; y: number; index: number } {
  let rest = Math.max(0, distance)
  for (let index = 0; index < PATH_POINTS.length - 1; index += 1) {
    const from = PATH_POINTS[index]
    const to = PATH_POINTS[index + 1]
    const length = getDistance(from.x, from.y, to.x, to.y)
    if (rest <= length) {
      const t = length === 0 ? 0 : rest / length
      return { x: from.x + (to.x - from.x) * t, y: from.y + (to.y - from.y) * t, index }
    }
    rest -= length
  }
  return { ...EXIT_POINT, index: PATH_POINTS.length - 1 }
}

function makeEnemy(world: World, type: EnemyTypeId, distance: number, hpRatio = 1): Enemy {
  const enemyType = ENEMY_TYPES[type]
  const point = pointOnPath(distance)
  return {
    id: `demo-enemy-${world.nextId++}`,
    type,
    hp: Math.max(1, Math.round(enemyType.hp * hpRatio)),
    maxHp: enemyType.hp,
    speed: enemyType.speed,
    currentPathIndex: point.index,
    x: point.x,
    y: point.y,
  }
}

function makeTower(world: World, spec: DemoTower): Tower {
  return { id: `demo-tower-${world.nextId++}`, type: spec.type, x: spec.x, y: spec.y, level: 1, lastAttackTime: 0 }
}

function createWorld(snapshot: BattleSnapshot, version: number): World {
  const now = Date.now()
  const world: World = {
    version,
    nextId: 0,
    towers: [],
    enemies: [],
    projectiles: [],
    beams: [],
    particles: [],
    queue: [],
    hp: snapshot.hp,
    gold: snapshot.gold,
    earned: snapshot.earned,
    currentWave: snapshot.currentWave,
    isWaveActive: snapshot.isWaveActive,
    shakeIntensity: 0,
    shakeUntil: 0,
    waveClear: null,
    waveClearUntil: 0,
    leaks: [],
  }
  world.towers = (snapshot.towers ?? []).map((spec) => makeTower(world, spec))
  world.enemies = (snapshot.enemies ?? []).map((spec) => makeEnemy(world, spec.type, spec.distance, spec.hpRatio))
  world.queue = (snapshot.spawns ?? []).map((spawn) => ({ type: spawn.type, spawnTime: now + spawn.delayMs }))
  return world
}

function toView(world: World): BattleView {
  return {
    version: world.version,
    towers: world.towers,
    enemies: world.enemies,
    projectiles: world.projectiles,
    beams: world.beams,
    particles: world.particles,
    hp: world.hp,
    gold: world.gold,
    earned: world.earned,
    currentWave: world.currentWave,
    isWaveActive: world.isWaveActive,
    shakeIntensity: world.shakeIntensity,
    waveClear: world.waveClear,
    leaks: world.leaks,
    queueCount: world.queue.length,
  }
}

/**
 * 한 틱 — hooks/useTowerDefenseGame 의 게임 루프와 같은 순서:
 * 스폰 → 이동·출구 → 타워 공격 → 발사체 명중 → 처치 보상 → 파티클 → 웨이브 끝.
 * 무언가 바뀌었으면 true.
 */
function stepWorld(world: World, now: number, dt: number): boolean {
  let changed = false
  const newParticles: Particle[] = []
  const shake = (intensity: number, durationMs: number) => {
    if (now < world.shakeUntil && intensity <= world.shakeIntensity) return
    world.shakeIntensity = intensity
    world.shakeUntil = now + durationMs
  }

  // 1. 스폰
  if (world.isWaveActive && world.queue.length > 0) {
    const due = world.queue.filter((spawn) => spawn.spawnTime <= now)
    if (due.length > 0) {
      world.enemies = [...world.enemies, ...due.map((spawn) => makeEnemy(world, spawn.type, 0))]
      world.queue = world.queue.filter((spawn) => spawn.spawnTime > now)
      changed = true
    }
  }

  // 2. 이동 + 출구 도달 (체력 감소 · 화면 흔들림)
  if (world.enemies.length > 0) {
    const moved = world.enemies.map((enemy) => {
      const next = getNextPosition(enemy, dt)
      return { ...enemy, x: next.x, y: next.y, currentPathIndex: next.pathIndex }
    })
    const arrived = moved.filter((enemy) => hasReachedEnd(enemy))
    if (arrived.length > 0) {
      arrived.forEach((enemy) => {
        const damage = getEnemyLeakDamage(enemy.type)
        world.hp = Math.max(0, world.hp - damage)
        world.leaks = [...world.leaks, { id: world.nextId++, damage, until: now + LEAK_MARK_MS }]
      })
      shake(6, 300)
    }
    world.enemies = moved.filter((enemy) => !hasReachedEnd(enemy))
    changed = true
  }

  // 3. 타워 공격 (레이저는 즉시 피해 + 빔, 나머지는 발사체)
  if (world.towers.length > 0 && world.enemies.length > 0) {
    const pendingDamage = new Map<string, number>()
    const newBeams: LaserBeam[] = []
    let towersChanged = false
    const towers = world.towers.map((tower) => {
      const towerType = TOWER_TYPES[tower.type]
      if (now - tower.lastAttackTime < 1000 / towerType.attackSpeed) return tower

      const range = getTowerRange(tower.type, tower.level)
      const damage = getTowerDamage(tower.type, tower.level)
      const inRange = world.enemies
        .filter((enemy) => (
          enemy.hp - (pendingDamage.get(enemy.id) ?? 0) > 0
          && getDistance(tower.x, tower.y, enemy.x, enemy.y) <= range
        ))
        .sort((a, b) => b.currentPathIndex - a.currentPathIndex)
      if (inRange.length === 0) return tower

      towersChanged = true
      if (tower.type === 'LASER') {
        const targets = inRange.slice(0, getLaserPierceCount(tower.level))
        targets.forEach((target) => {
          pendingDamage.set(target.id, (pendingDamage.get(target.id) ?? 0) + getTowerHitDamage('LASER', target.type, damage))
          newParticles.push(...createHitParticles(target.x, target.y, 'LASER'))
        })
        newBeams.push({
          id: `demo-beam-${world.nextId++}`,
          towerId: tower.id,
          fromX: tower.x,
          fromY: tower.y,
          targets: targets.map((target) => ({ x: target.x, y: target.y })),
          createdAt: now,
          expiresAt: now + LASER_BEAM_DURATION_MS,
        })
      } else {
        const target = inRange[0]
        world.projectiles = [
          ...world.projectiles,
          {
            id: `demo-shot-${world.nextId++}`,
            towerId: tower.id,
            towerType: tower.type,
            x: tower.x,
            y: tower.y,
            targetX: target.x,
            targetY: target.y,
            targetEnemyId: target.id,
            speed: PROJECTILE_SPEED,
            damage,
          },
        ]
      }
      return { ...tower, lastAttackTime: now }
    })
    if (towersChanged) world.towers = towers
    if (pendingDamage.size > 0) {
      world.enemies = world.enemies.map((enemy) => {
        const taken = pendingDamage.get(enemy.id)
        return taken ? { ...enemy, hp: enemy.hp - taken } : enemy
      })
    }
    if (newBeams.length > 0) world.beams = [...world.beams, ...newBeams]
  }
  if (world.beams.length > 0) {
    const alive = world.beams.filter((beam) => beam.expiresAt > now)
    if (alive.length !== world.beams.length) {
      world.beams = alive
      changed = true
    }
  }

  // 4. 발사체 이동 + 명중
  if (world.projectiles.length > 0) {
    const survivors: Projectile[] = []
    world.projectiles.forEach((projectile) => {
      const target = world.enemies.find((enemy) => enemy.id === projectile.targetEnemyId)
      if (!target || target.hp <= 0) return

      const tracking = { ...projectile, targetX: target.x, targetY: target.y }
      const next = moveProjectile(tracking, dt)
      if (getDistance(next.x, next.y, target.x, target.y) < PROJECTILE_HIT_RADIUS) {
        newParticles.push(...createHitParticles(target.x, target.y, projectile.towerType))
        if (projectile.towerType === 'BOMB') shake(4, 200)
        world.enemies = applyProjectileHit(world.enemies, target, projectile, now)
        return
      }
      survivors.push({ ...tracking, x: next.x, y: next.y })
    })
    world.projectiles = survivors
    changed = true
  }

  // 5. 처치 — 적마다 정해진 골드가 골드·점수에 더해진다
  const dead = world.enemies.filter((enemy) => enemy.hp <= 0)
  if (dead.length > 0) {
    dead.forEach((enemy) => {
      const reward = ENEMY_TYPES[enemy.type].goldReward
      world.gold += reward
      world.earned += reward
      newParticles.push(...createHitParticles(enemy.x, enemy.y, enemy.type === 'BOSS' ? 'BOSS_DIE' : 'ENEMY_DIE'))
    })
    world.enemies = world.enemies.filter((enemy) => enemy.hp > 0)
    changed = true
  }

  // 6. 파티클
  if (world.particles.length > 0 || newParticles.length > 0) {
    world.particles = [...updateParticles(world.particles, dt), ...newParticles].slice(-MAX_PARTICLES)
    changed = true
  }

  // 7. 흔들림 · 알림 정리
  if (world.shakeIntensity > 0 && now >= world.shakeUntil) {
    world.shakeIntensity = 0
    changed = true
  }
  if (world.leaks.some((leak) => leak.until <= now)) {
    world.leaks = world.leaks.filter((leak) => leak.until > now)
    changed = true
  }
  if (world.waveClear !== null && now >= world.waveClearUntil) {
    world.waveClear = null
    changed = true
  }

  // 8. 웨이브 끝 — 적이 다 나오고 맵에서도 사라지면 다음 웨이브로
  if (world.isWaveActive && world.queue.length === 0 && world.enemies.length === 0) {
    world.isWaveActive = false
    world.currentWave += 1
    world.waveClear = world.currentWave
    world.waveClearUntil = now + WAVE_CLEAR_TOAST_MS
    changed = true
  }

  return changed
}

type BattleApi = {
  load: (snapshot: BattleSnapshot) => void
  addGold: (amount: number) => void
  placeTower: (type: TowerTypeId, x: number, y: number) => boolean
  startWave: () => void
}

function useDemoBattle(initial: BattleSnapshot): { view: BattleView; api: BattleApi } {
  const worldRef = useRef<World | null>(null)
  if (worldRef.current === null) worldRef.current = createWorld(initial, 0)
  const [view, setView] = useState<BattleView>(() => toView(worldRef.current as World))
  const commit = useCallback(() => {
    if (worldRef.current) setView(toView(worldRef.current))
  }, [])

  useEffect(() => {
    let last = Date.now()
    const timer = window.setInterval(() => {
      const world = worldRef.current
      if (!world) return
      const now = Date.now()
      const dt = Math.min(MAX_TICK_DELTA, Math.max(0, (now - last) / 1000))
      last = now
      if (stepWorld(world, now, dt)) commit()
    }, TICK_MS)
    return () => window.clearInterval(timer)
  }, [commit])

  const api = useMemo<BattleApi>(() => ({
    load: (snapshot) => {
      worldRef.current = createWorld(snapshot, (worldRef.current?.version ?? 0) + 1)
      commit()
    },
    addGold: (amount) => {
      const world = worldRef.current
      if (!world) return
      world.gold += amount
      world.earned += amount
      commit()
    },
    // 실제 handlePlaceTower 와 같은 조건: 골드가 모자라거나 길·다른 타워와 겹치면 못 세운다
    placeTower: (type, x, y) => {
      const world = worldRef.current
      const cost = TOWER_TYPES[type].cost
      if (!world || world.gold < cost || !canPlaceTowerAtPoint(x, y, world.towers)) return false
      world.towers = [...world.towers, makeTower(world, { type, x, y })]
      world.gold -= cost
      commit()
      return true
    },
    // 실제 startWave 와 같은 대기열: 1초 뒤부터 웨이브 구성대로 간격을 두고 나온다
    startWave: () => {
      const world = worldRef.current
      const wave = world ? WAVES[world.currentWave] : undefined
      if (!world || !wave || world.isWaveActive) return
      let spawnTime = Date.now() + 1000
      const queue: World['queue'] = []
      wave.enemies.forEach((group) => {
        for (let index = 0; index < group.count; index += 1) {
          queue.push({ type: group.type, spawnTime })
          spawnTime += group.spawnDelay
        }
      })
      world.queue = queue
      world.isWaveActive = true
      commit()
    },
  }), [commit])

  return { view, api }
}

// ───────────── 장면별 시작 상태 ─────────────

const START: BattleSnapshot = {
  hp: PLAYER_START_HP,
  gold: PLAYER_START_GOLD,
  earned: 0,
  currentWave: 0,
  isWaveActive: false,
}

/** 1장: 웨이브 1 막바지 — 앞쪽 타워에 맞은 적들이 몰려오고 마지막 한 마리가 곧 나온다 */
const GOAL_SNAPSHOT: BattleSnapshot = {
  hp: PLAYER_START_HP,
  gold: GOLD_IN_WAVE_ONE,
  earned: EARNED_IN_WAVE_ONE,
  currentWave: 0,
  isWaveActive: true,
  towers: BATTLE_TOWERS,
  enemies: [
    { type: 'NORMAL', distance: 330, hpRatio: 0.6 },
    { type: 'NORMAL', distance: 270, hpRatio: 0.8 },
    { type: 'NORMAL', distance: 200, hpRatio: 0.9 },
    { type: 'NORMAL', distance: 120 },
  ],
  spawns: [{ type: 'NORMAL', delayMs: 500 }],
}

/** 2장: 타워를 피해 살아남은 적들이 출구로 줄지어 나간다. 뒤이어 나올 적이 남아 있어 웨이브는 계속된다 */
const LEAK_SNAPSHOT: BattleSnapshot = {
  ...GOAL_SNAPSHOT,
  enemies: [1550, 1480, 1410, 1340, 1270, 1200, 1130, 1060, 990].map((distance, index) => ({
    type: 'NORMAL' as const,
    distance,
    hpRatio: [0.4, 0.7, 0.3, 0.6, 0.5, 0.8, 0.4, 0.6, 0.7][index],
  })),
  spawns: [
    { type: 'NORMAL', delayMs: 9000 },
    { type: 'NORMAL', delayMs: 9900 },
  ],
}

const AFTER_QUIZZES: BattleSnapshot = { ...START, gold: GOLD_AFTER_QUIZZES, earned: GOLD_AFTER_QUIZZES - PLAYER_START_GOLD }

// ───────────── 화면 상태 (헤더·패널이 같이 본다) ─────────────

type DemoUi = {
  /** 웨이브별 퀴즈 진행 (실제 quizProgressByWave) */
  quiz: Record<number, TowerQuizProgress>
  /** 연속 정답 (useGameBase 의 consecutiveCorrect) */
  streak: number
  /** 아이템 칸 */
  items: SkillId[]
  selectedTowerType: TowerTypeId | null
}

const NO_QUIZ: TowerQuizProgress = { answered: 0, correct: 0 }
const ALL_CORRECT: TowerQuizProgress = { answered: TOWER_QUIZZES_PER_WAVE, correct: TOWER_QUIZZES_PER_WAVE }

const UI_START: DemoUi = { quiz: { 0: NO_QUIZ }, streak: 0, items: [], selectedTowerType: null }
const UI_AFTER_QUIZZES: DemoUi = { quiz: { 0: ALL_CORRECT }, streak: TOWER_QUIZZES_PER_WAVE, items: [PICKED_ITEM], selectedTowerType: null }

/** 버튼에 실제로 적히는 글자 — 헤더와 같은 함수로 만든다 */
const LABELS_AT_START = getTowerQuizStatus({ progress: NO_QUIZ, currentWave: 0, isWaveActive: false, waveEnemiesRemaining: 0 })
const LABELS_READY = getTowerQuizStatus({ progress: ALL_CORRECT, currentWave: 0, isWaveActive: false, waveEnemiesRemaining: 0 })

// ───────────── 작은 도구들 ─────────────

type Step = readonly [atMs: number, run: () => void]

/**
 * 장면이 붙는 순간 load 를 부르고 steps 를 차례로 실행한다.
 * loopMs 가 있으면 그 간격으로 처음부터 다시 — 선생님이 한 장에 오래 머물러도 계속 보인다.
 */
function useTimeline(load: () => void, steps: Step[], loopMs?: number) {
  const loadRef = useRef(load)
  loadRef.current = load
  const stepsRef = useRef(steps)
  stepsRef.current = steps
  useLayoutEffect(() => {
    let timers: number[] = []
    const play = () => {
      loadRef.current()
      timers = stepsRef.current.map(([at, run]) => window.setTimeout(run, at))
      if (loopMs) timers.push(window.setTimeout(play, loopMs))
    }
    play()
    return () => timers.forEach((timer) => window.clearTimeout(timer))
  }, [loopMs])
}

/** 헤더 숫자가 바뀌면 세어 올라가거나 내려간다. 장면을 새로 불러오면(resetKey) 바로 바뀐다 */
function useTween(target: number, resetKey: number, duration = 650): number {
  const [shown, setShown] = useState(target)
  const shownRef = useRef(target)
  const keyRef = useRef(resetKey)
  useLayoutEffect(() => {
    if (keyRef.current !== resetKey) {
      keyRef.current = resetKey
      shownRef.current = target
      setShown(target)
      return
    }
    const from = shownRef.current
    if (from === target) return
    let raf = 0
    const start = performance.now()
    const tick = (now: number) => {
      const progress = Math.min(1, (now - start) / duration)
      const value = Math.round(from + (target - from) * (1 - Math.pow(1 - progress, 3)))
      shownRef.current = value
      setShown(value)
      if (progress < 1) raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [target, resetKey, duration])
  return shown
}

/** 포인터·떠오르는 숫자를 붙일 자리 */
type Anchor =
  | { kind: 'button'; text: string; scope: 'header' | 'stage' }
  | { kind: 'map'; x: number; y: number }
  | { kind: 'metric'; label: string }

const headerButton = (text: string): Anchor => ({ kind: 'button', text, scope: 'header' })
const stageButton = (text: string): Anchor => ({ kind: 'button', text, scope: 'stage' })
const mapPoint = (point: { x: number; y: number }): Anchor => ({ kind: 'map', ...point })

/** 화면 좌표로 찾은 자리 (버튼은 누르는 손끝이 닿을 곳, 헤더 칸은 아랫변 가운데) */
function locateAnchor(anchor: Anchor, header: HTMLElement | null, stage: HTMLElement | null): { x: number; y: number } | null {
  if (anchor.kind === 'map') {
    const canvas = stage?.querySelector('canvas')
    if (!canvas) return null
    const rect = canvas.getBoundingClientRect()
    return { x: rect.left + (anchor.x / MAP_WIDTH) * rect.width, y: rect.top + (anchor.y / MAP_HEIGHT) * rect.height }
  }
  if (anchor.kind === 'metric') {
    // HudMetric: <div 칸><div 제목줄><아이콘/><span>{label}</span></div><div>{값}</div></div>
    const label = [...(header?.querySelectorAll('span') ?? [])].find((span) => span.textContent?.trim() === anchor.label)
    const box = label?.parentElement?.parentElement
    if (!box) return null
    const rect = box.getBoundingClientRect()
    // 헤더가 프레임 맨 위에 붙어 있어 칸 위쪽에 띄우면 잘린다 — 칸 바로 아래에 띄운다
    return { x: rect.left + rect.width / 2, y: rect.bottom + 2 }
  }
  // 무대 쪽은 장면 전체에서 찾는다 — 아이템 고르기 모달은 맵·패널 옆(같은 장면 안)에 붙는다
  const root = anchor.scope === 'header' ? header : stage?.closest('[data-demo-scene]') ?? stage
  const button = [...(root?.querySelectorAll('button') ?? [])].find((b) => (b.textContent ?? '').includes(anchor.text))
  if (!button) return null
  const rect = button.getBoundingClientRect()
  // 헤더 버튼처럼 낮은 버튼은 아랫변을 눌러 글자를 가리지 않고, 큰 카드는 안쪽 오른쪽 아래를 누른다
  const isShort = rect.height < 48
  return {
    x: rect.right - Math.min(34, rect.width * 0.3),
    y: isShort ? rect.bottom : rect.bottom - Math.min(14, rect.height * 0.35),
  }
}

/** 실제 맵 캔버스에 마우스 이벤트를 보내 게임과 똑같이 미리보기·설치가 되게 한다 */
function sendToMap(stage: HTMLElement | null, type: 'mousemove' | 'click' | 'mouseout', point?: { x: number; y: number }) {
  const canvas = stage?.querySelector('canvas')
  if (!canvas) return
  const rect = canvas.getBoundingClientRect()
  canvas.dispatchEvent(new MouseEvent(type, {
    bubbles: true,
    cancelable: true,
    clientX: point ? rect.left + (point.x / MAP_WIDTH) * rect.width : rect.left - 20,
    clientY: point ? rect.top + (point.y / MAP_HEIGHT) * rect.height : rect.top - 20,
    // React 의 onMouseLeave 는 캔버스 밖으로 나가는 mouseout 으로 알아챈다
    relatedTarget: type === 'mouseout' ? canvas.parentElement : null,
  }))
}

type SceneCtx = {
  /** 튜토리얼 프레임 크기 — 퀴즈·모달 크기를 여기서 정한다 */
  frame: FrameSize | null
  battle: BattleView
  api: BattleApi
  ui: DemoUi
  setUi: (ui: DemoUi | ((prev: DemoUi) => DemoUi)) => void
  headerRef: RefObject<HTMLDivElement>
}

type FloatNote = { id: number; anchor: Anchor; text: string; tone: 'gain' | 'loss' }

function useAnchorPoint(
  layerRef: RefObject<HTMLDivElement>,
  headerRef: RefObject<HTMLDivElement>,
  stageRef: RefObject<HTMLDivElement>,
  anchor: Anchor | null,
): { x: number; y: number } | null {
  const [point, setPoint] = useState<{ x: number; y: number } | null>(null)
  const anchorRef = useRef(anchor)
  anchorRef.current = anchor
  const key = anchor ? JSON.stringify(anchor) : ''
  useEffect(() => {
    if (!key) {
      setPoint(null)
      return
    }
    // 모달·패널이 튀어나오는 동안 자리가 조금씩 움직이므로 몇 번 더 잰다
    const resolve = () => {
      const layer = layerRef.current
      const current = anchorRef.current
      const found = current ? locateAnchor(current, headerRef.current, stageRef.current) : null
      if (!layer || !found) return
      const base = layer.getBoundingClientRect()
      setPoint({ x: found.x - base.left, y: found.y - base.top })
    }
    resolve()
    const timers = [120, 400, 800].map((ms) => window.setTimeout(resolve, ms))
    window.addEventListener('resize', resolve)
    return () => {
      timers.forEach((timer) => window.clearTimeout(timer))
      window.removeEventListener('resize', resolve)
    }
  }, [key, layerRef, headerRef, stageRef])
  return point
}

/**
 * 프레임 전체를 덮는 투명한 층 — 손가락 포인터와 떠오르는 숫자를 헤더·패널·맵 어디에든 올린다.
 * (프레임 루트의 translateZ 가 fixed 를 프레임 안에 가둔다)
 */
function DemoLayer({ ctx, stageRef, pointer, note }: {
  ctx: SceneCtx
  stageRef: RefObject<HTMLDivElement>
  pointer: Anchor | null
  note: FloatNote | null
}) {
  const layerRef = useRef<HTMLDivElement>(null)
  const pointerAt = useAnchorPoint(layerRef, ctx.headerRef, stageRef, pointer)
  const noteAt = useAnchorPoint(layerRef, ctx.headerRef, stageRef, note?.anchor ?? null)
  return (
    <div ref={layerRef} className="pointer-events-none fixed inset-0 z-[70]">
      <AnimatePresence>
        {note && noteAt && (
          <div key={note.id} className="absolute -translate-x-1/2" style={{ left: noteAt.x, top: noteAt.y }}>
            <FloatBubble text={note.text} tone={note.tone} />
          </div>
        )}
      </AnimatePresence>
      {pointer && pointerAt && (
        // 손끝(아이콘 왼쪽 위)이 자리에 닿도록 13px 당긴다
        <motion.div
          className="absolute"
          initial={false}
          animate={{ left: pointerAt.x - 13, top: pointerAt.y - 13 }}
          transition={{ type: 'spring', stiffness: 160, damping: 21 }}
        >
          <TapPointer className="left-0 top-0" />
        </motion.div>
      )}
    </div>
  )
}

/** 떠오르는 숫자 (+120 · -8) — 위치는 바깥 div, 움직임은 안쪽 motion 에만 준다 */
function FloatBubble({ text, tone }: { text: string; tone: 'gain' | 'loss' }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8, scale: 0.8 }}
      animate={{ opacity: 1, y: -6, scale: 1 }}
      exit={{ opacity: 0, y: -22 }}
      transition={{ type: 'spring', stiffness: 320, damping: 18 }}
      className={`whitespace-nowrap rounded-full px-3 py-1 text-sm font-black text-white shadow-lg sm:text-base ${
        tone === 'gain' ? 'bg-amber-500' : 'bg-rose-500'
      }`}
    >
      {text}
    </motion.div>
  )
}

// ───────────── 크기 맞추기 ─────────────
// 튜토리얼 창 크기는 폰(세로로 긴 칸)부터 데스크톱까지 제각각이라, 고정 zoom 대신 프레임 크기에서 정한다.

type FrameSize = { width: number; height: number }

/** 무대 안 화면은 실제 폰 폭 / 태블릿 폭으로 그린 뒤 통째로 줄인다 — 패널과 맵의 비율이 실제 화면 그대로 남는다 */
const SCREEN_WIDTH = 600
const SCREEN_WIDTH_PHONE = 420
const MAX_SCREEN_ZOOM = 1.25

/** 요소에 지금 걸린 zoom (getBoundingClientRect 는 줄어든 크기를 돌려주므로 되돌릴 때 쓴다) */
function appliedZoom(element: HTMLElement): number {
  return Number.parseFloat(element.style.zoom) || 1
}

/** 이 요소가 들어 있는 튜토리얼 프레임의 크기 */
function useFrameSize(innerRef: RefObject<HTMLElement>): FrameSize | null {
  const [size, setSize] = useState<FrameSize | null>(null)
  useLayoutEffect(() => {
    const frame = innerRef.current?.closest('[data-tutorial-frame]')
    if (!(frame instanceof HTMLElement)) return
    const measure = () => {
      setSize((prev) => (
        prev && prev.width === frame.clientWidth && prev.height === frame.clientHeight
          ? prev
          : { width: frame.clientWidth, height: frame.clientHeight }
      ))
    }
    measure()
    const observer = new ResizeObserver(measure)
    observer.observe(frame)
    return () => observer.disconnect()
  }, [innerRef])
  return size
}

/**
 * 무대 칸(box)에 화면(content)이 통째로 들어가는 zoom 과, 화면을 그릴 폭.
 * 폭이 좁으면(폰) 폰 폭으로 그려서 글자가 너무 작아지지 않게 한다.
 */
function useFitScreen(boxRef: RefObject<HTMLDivElement>, contentRef: RefObject<HTMLDivElement>): { zoom: number; width: number } {
  const [fit, setFit] = useState({ zoom: 1, width: SCREEN_WIDTH })
  useLayoutEffect(() => {
    const box = boxRef.current
    const content = contentRef.current
    if (!box || !content) return
    const measure = () => {
      const style = window.getComputedStyle(box)
      const availWidth = box.clientWidth - Number.parseFloat(style.paddingLeft) - Number.parseFloat(style.paddingRight)
      const availHeight = box.clientHeight - Number.parseFloat(style.paddingTop) - Number.parseFloat(style.paddingBottom)
      if (availWidth <= 0 || availHeight <= 0) return
      const width = availWidth < 520 ? SCREEN_WIDTH_PHONE : SCREEN_WIDTH
      const zoom = appliedZoom(content)
      const rect = content.getBoundingClientRect()
      // 폭을 바꾸면 높이도 바뀌니, 폭부터 맞춘 뒤 다시 잰다 (ResizeObserver 가 한 번 더 부른다)
      const naturalWidth = rect.width / zoom
      const naturalHeight = rect.height / zoom
      if (Math.abs(naturalWidth - width) > 1) {
        setFit((prev) => ({ ...prev, width }))
        return
      }
      const next = Math.min(MAX_SCREEN_ZOOM, availWidth / width, availHeight / naturalHeight)
      setFit((prev) => (Math.abs(prev.zoom - next) > 0.003 || prev.width !== width ? { zoom: next, width } : prev))
    }
    measure()
    const observer = new ResizeObserver(measure)
    observer.observe(box)
    observer.observe(content)
    return () => observer.disconnect()
  }, [boxRef, contentRef])
  return fit
}

/** 웨이브 퀴즈 화면 크기 — 데스크톱 프레임(높이 644)에서 0.78 이면 "정답입니다" 까지 캡션 위에 들어온다 */
function quizZoom(frame: FrameSize | null): number {
  if (!frame) return 0.72
  return Math.min(0.88, Math.max(0.46, (0.78 * frame.height) / 644))
}

/** 아이템 고르기 모달 크기 — 폰은 카드 3장이 세로로 쌓여 더 줄인다 */
function skillModalZoom(frame: FrameSize | null): number {
  if (!frame) return 0.6
  if (frame.width < 520) return Math.min(0.5, Math.max(0.38, (0.46 * frame.height) / 560))
  return Math.min(0.8, Math.max(0.5, (0.72 * frame.height) / 644))
}

/** 장면 전환 — 투명도만 바꾼다 (transform 을 주면 안쪽 fixed 퀴즈·모달이 무대 안에 갇힌다) */
function SceneCard({ id, children }: { id: string; children: ReactNode }) {
  return (
    <motion.div
      key={id}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.25 }}
      className="absolute inset-0"
      data-demo-scene
    >
      {children}
    </motion.div>
  )
}

type PanelKind = 'wave' | 'items' | 'build'

/**
 * 실제 작전 화면 (app/tower/page.tsx 의 폰·태블릿 배치): 위에 패널 하나, 아래에 맵.
 * 무대가 실제 화면보다 작아 장면마다 필요한 패널 하나만 보여 준다.
 */
function TowerScreen({ ctx, stageRef, panel, onPlaceTower, showLeaks = false }: {
  ctx: SceneCtx
  stageRef: RefObject<HTMLDivElement>
  panel: PanelKind | null
  onPlaceTower?: (slot: BuildSlot) => void
  showLeaks?: boolean
}) {
  const { battle, ui } = ctx
  const contentRef = useRef<HTMLDivElement>(null)
  const fit = useFitScreen(stageRef, contentRef)
  const outlook = getTowerWaveOutlook(battle.currentWave)
  const isDangerous = battle.hp <= 30

  let panelNode: ReactNode = null
  if (panel === 'wave') {
    panelNode = (
      <TowerWavePanel
        currentWave={battle.currentWave}
        isWaveActive={battle.isWaveActive}
        nextWaveRoster={outlook.nextWaveRoster}
        waveProgress={outlook.waveProgress}
      />
    )
  } else if (panel === 'items') {
    const entries = ui.items.map((skillId, index) => ({
      index,
      skill: SKILLS[skillId],
      blockReason: getItemBlockReason(skillId, { enemyCount: battle.enemies.length, isWaveActive: battle.isWaveActive, hp: battle.hp }),
    }))
    panelNode = (
      <motion.div key={ui.items.length} initial={{ scale: ui.items.length > 0 ? 1.04 : 1 }} animate={{ scale: 1 }} transition={{ type: 'spring', stiffness: 300, damping: 16 }}>
        <TowerItemBar items={entries} onUseItem={noop} />
      </motion.div>
    )
  } else if (panel === 'build') {
    panelNode = (
      <div className="mb-3">
        <TowerPlacementPanel compact gold={battle.gold} selectedTowerType={ui.selectedTowerType} onSelectTowerType={noop} />
      </div>
    )
  }

  return (
    <div ref={stageRef} className="pointer-events-none absolute inset-0 flex items-center justify-center px-3 pb-3 sm:px-5">
      <div ref={contentRef} className="shrink-0" style={{ width: fit.width, zoom: fit.zoom }}>
        {panelNode}
        <div className={`tower-map-frame relative transition-all duration-300 ${isDangerous ? 'animate-pulse ring-4 ring-red-500 ring-offset-2' : ''}`}>
          <TowerDefenseMap
            towers={battle.towers}
            enemies={battle.enemies}
            projectiles={battle.projectiles}
            laserBeams={battle.beams}
            particles={battle.particles}
            shakeIntensity={battle.shakeIntensity}
            selectedTowerType={ui.selectedTowerType}
            onPlaceTower={onPlaceTower ?? noop}
            onSelectTower={noop}
            selectedTower={null}
          />
          <AnimatePresence>
            {battle.waveClear !== null && (
              <div key={`clear-${battle.waveClear}`} className="pointer-events-none absolute inset-0 z-20 [zoom:0.75]">
                <TowerWaveClearToast wave={battle.waveClear} />
              </div>
            )}
          </AnimatePresence>
          {showLeaks && (
            <AnimatePresence>
              {battle.leaks.map((leak) => (
                // 출구 표시 바로 위 — 적이 빠져나간 자리에서 체력이 깎인다
                <div
                  key={leak.id}
                  className="absolute -translate-x-1/2 -translate-y-full"
                  style={{ left: `${((EXIT_POINT.x - 34) / MAP_WIDTH) * 100}%`, top: `${((EXIT_POINT.y - 30) / MAP_HEIGHT) * 100}%` }}
                >
                  <FloatBubble text={`체력 -${leak.damage}`} tone="loss" />
                </div>
              ))}
            </AnimatePresence>
          )}
        </div>
      </div>
    </div>
  )
}

/** 웨이브 퀴즈 화면 — 실제 TowerQuizOverlay 안에 실제 QuizView(GlassQuizStep) */
function DemoQuiz({ frame, progress, streak, quiz, answered }: {
  frame: FrameSize | null
  progress: TowerQuizProgress
  streak: number
  quiz: typeof FIRST_QUIZ
  answered: boolean
}) {
  return (
    <div style={{ zoom: quizZoom(frame) }}>
      <TowerQuizOverlay answered={progress.answered} correct={progress.correct} consecutiveCorrect={streak}>
        <div className="flex justify-center">
          <GlassQuizStep question={quiz.question} options={quiz.options} correctIndex={quiz.correctIndex} answered={answered} zoom={0.78} />
        </div>
      </TowerQuizOverlay>
    </div>
  )
}

// ───────────── 장면 ─────────────

type SceneProps = { ctx: SceneCtx }

/** 1장: 웨이브가 한창 — 적이 계속 몰려오고, 타워가 다 막아 내면 "웨이브 1 클리어!" 뒤 2/10 */
function GoalScene({ ctx }: SceneProps) {
  const stageRef = useRef<HTMLDivElement>(null)
  useTimeline(() => {
    ctx.api.load(GOAL_SNAPSHOT)
    ctx.setUi(UI_AFTER_QUIZZES)
  }, [])
  return (
    <SceneCard id="tower-goal">
      <TowerScreen ctx={ctx} stageRef={stageRef} panel="wave" />
    </SceneCard>
  )
}

/** 2장: 타워를 지나친 적이 출구로 나갈 때마다 체력이 깎인다 — 30 이하가 되면 맵이 붉게 깜빡인다 */
function LeakScene({ ctx }: SceneProps) {
  const stageRef = useRef<HTMLDivElement>(null)
  useTimeline(() => {
    ctx.api.load(LEAK_SNAPSHOT)
    ctx.setUi(UI_AFTER_QUIZZES)
  }, [])
  return (
    <SceneCard id="tower-leak">
      <TowerScreen ctx={ctx} stageRef={stageRef} panel="wave" showLeaks />
    </SceneCard>
  )
}

/** 3장: 웨이브 시작 버튼은 "퀴즈 3문제 먼저" — 퀴즈 버튼을 눌러 웨이브 퀴즈를 연다 */
function QuizScene({ ctx }: SceneProps) {
  const stageRef = useRef<HTMLDivElement>(null)
  const [pointer, setPointer] = useState<Anchor | null>(null)
  const [quizOpen, setQuizOpen] = useState(false)
  useTimeline(() => {
    ctx.api.load(START)
    ctx.setUi(UI_START)
    setPointer(null)
    setQuizOpen(false)
  }, [
    [700, () => setPointer(headerButton(LABELS_AT_START.startWaveButtonLabel))],
    [1900, () => setPointer(headerButton(LABELS_AT_START.quizButtonLabel))],
    [2700, () => {
      setPointer(null)
      setQuizOpen(true)
    }],
  ])
  return (
    <SceneCard id="tower-quiz">
      <TowerScreen ctx={ctx} stageRef={stageRef} panel="wave" />
      <AnimatePresence>
        {quizOpen && <DemoQuiz key="quiz" frame={ctx.frame} progress={NO_QUIZ} streak={0} quiz={FIRST_QUIZ} answered={false} />}
      </AnimatePresence>
      <DemoLayer ctx={ctx} stageRef={stageRef} pointer={pointer} note={null} />
    </SceneCard>
  )
}

/** 4장: 빨리 맞히면 골드 — 퀴즈를 닫고 나오면 헤더 골드가 오른다 */
function CorrectScene({ ctx }: SceneProps) {
  const stageRef = useRef<HTMLDivElement>(null)
  const [quizOpen, setQuizOpen] = useState(true)
  const [answered, setAnswered] = useState(false)
  const [note, setNote] = useState<FloatNote | null>(null)
  useTimeline(() => {
    ctx.api.load(START)
    ctx.setUi(UI_START)
    setQuizOpen(true)
    setAnswered(false)
    setNote(null)
  }, [
    [900, () => {
      // 실제 게임처럼 누르는 순간 진행이 기록된다 (위쪽 배지가 "2/3 · 정답 1/3" 으로)
      setAnswered(true)
      ctx.setUi({ ...UI_START, quiz: { 0: { answered: 1, correct: 1 } }, streak: 1 })
    }],
    [2100, () => {
      setQuizOpen(false)
      ctx.api.addGold(QUIZ_GOLD_FAST)
      setNote({ id: 1, anchor: { kind: 'metric', label: '골드' }, text: `+${QUIZ_GOLD_FAST}골드`, tone: 'gain' })
    }],
    [3900, () => setNote(null)],
  ])
  return (
    <SceneCard id="tower-correct">
      <TowerScreen ctx={ctx} stageRef={stageRef} panel="wave" />
      <AnimatePresence>
        {quizOpen && (
          <DemoQuiz key="quiz" frame={ctx.frame} progress={ctx.ui.quiz[0] ?? NO_QUIZ} streak={ctx.ui.streak} quiz={FIRST_QUIZ} answered={answered} />
        )}
      </AnimatePresence>
      <DemoLayer ctx={ctx} stageRef={stageRef} pointer={null} note={note} />
    </SceneCard>
  )
}

/** 5장: 세 번째도 정답 → 아이템 3장 중 하나 → 바로 쓰이지 않고 아이템 칸에 들어간다 */
function ItemScene({ ctx }: SceneProps) {
  const stageRef = useRef<HTMLDivElement>(null)
  const [quizOpen, setQuizOpen] = useState(true)
  const [answered, setAnswered] = useState(false)
  const [modalOpen, setModalOpen] = useState(false)
  const [pointer, setPointer] = useState<Anchor | null>(null)
  const [toast, setToast] = useState<string | null>(null)
  const beforeThird: DemoUi = { ...UI_START, quiz: { 0: { answered: 2, correct: 2 } }, streak: 2 }
  useTimeline(() => {
    ctx.api.load({ ...START, gold: GOLD_BEFORE_THIRD, earned: GOLD_BEFORE_THIRD - PLAYER_START_GOLD })
    ctx.setUi(beforeThird)
    setQuizOpen(true)
    setAnswered(false)
    setModalOpen(false)
    setPointer(null)
    setToast(null)
  }, [
    [900, () => {
      setAnswered(true)
      ctx.api.addGold(QUIZ_GOLD_FAST)
      ctx.setUi({ ...beforeThird, quiz: { 0: ALL_CORRECT }, streak: TOWER_QUIZZES_PER_WAVE })
    }],
    [1400, () => setModalOpen(true)],
    [2500, () => setPointer(stageButton(SKILLS[PICKED_ITEM].name))],
    [3400, () => {
      setPointer(null)
      setModalOpen(false)
      setQuizOpen(false)
      ctx.setUi(UI_AFTER_QUIZZES)
      // 실제 handleSkillSelect 가 띄우는 문구 그대로
      setToast(`${SKILLS[PICKED_ITEM].name} 아이템을 챙겼어요! 아이템 칸에서 원할 때 쓰세요.`)
    }],
    [6800, () => setToast(null)],
  ])
  return (
    <SceneCard id="tower-item">
      <TowerScreen ctx={ctx} stageRef={stageRef} panel="items" />
      <AnimatePresence>
        {quizOpen && (
          <DemoQuiz key="quiz" frame={ctx.frame} progress={ctx.ui.quiz[0] ?? NO_QUIZ} streak={ctx.ui.streak} quiz={THIRD_QUIZ} answered={answered} />
        )}
      </AnimatePresence>
      <AnimatePresence>
        {modalOpen && (
          <div key="skills" style={{ zoom: skillModalZoom(ctx.frame) }}>
            <SkillChoiceModal
              skills={ITEM_CHOICES.map((id) => SKILLS[id])}
              goldReward={QUIZ_GOLD_FAST}
              isBonus
              comboCount={TOWER_QUIZZES_PER_WAVE}
              onSelect={noop}
            />
          </div>
        )}
      </AnimatePresence>
      <AnimatePresence>
        {toast && (
          <div key="toast" className="[zoom:0.85]">
            <TowerToast message={toast} />
          </div>
        )}
      </AnimatePresence>
      <DemoLayer ctx={ctx} stageRef={stageRef} pointer={pointer} note={null} />
    </SceneCard>
  )
}

/** 6장: 타워 고르기 → 길 위는 빨갛게(못 세움) → 잔디는 초록 → 설치(골드 차감) → 웨이브 1 시작 */
function BuildScene({ ctx }: SceneProps) {
  const stageRef = useRef<HTMLDivElement>(null)
  const [pointer, setPointer] = useState<Anchor | null>(null)
  const [note, setNote] = useState<FloatNote | null>(null)
  const noteId = useRef(0)

  const handlePlaceTower = (slot: BuildSlot) => {
    if (!ctx.api.placeTower(BUILD_TYPE, slot.x, slot.y)) return
    ctx.setUi((prev) => ({ ...prev, selectedTowerType: null }))
    noteId.current += 1
    setNote({ id: noteId.current, anchor: { kind: 'metric', label: '골드' }, text: `-${TOWER_TYPES[BUILD_TYPE].cost}골드`, tone: 'loss' })
  }

  useTimeline(() => {
    ctx.api.load(AFTER_QUIZZES)
    ctx.setUi(UI_AFTER_QUIZZES)
    setPointer(null)
    setNote(null)
    sendToMap(stageRef.current, 'mouseout')
  }, [
    [700, () => setPointer(stageButton(TOWER_TYPES[BUILD_TYPE].name.replace(' 타워', '')))],
    [1400, () => ctx.setUi((prev) => ({ ...prev, selectedTowerType: BUILD_TYPE }))],
    [2200, () => {
      setPointer(mapPoint(PATH_SPOT))
      sendToMap(stageRef.current, 'mousemove', PATH_SPOT)
    }],
    [3500, () => {
      setPointer(mapPoint(BUILD_SPOT))
      sendToMap(stageRef.current, 'mousemove', BUILD_SPOT)
    }],
    [4400, () => {
      // 실제 맵의 클릭 처리(canPlaceTowerAtPoint)를 거쳐 onPlaceTower 가 불린다
      sendToMap(stageRef.current, 'click', BUILD_SPOT)
      sendToMap(stageRef.current, 'mouseout')
    }],
    // 방금 세운 타워가 손가락에 가리지 않게 잠깐 치운다
    [4700, () => setPointer(null)],
    [5400, () => setPointer(headerButton(LABELS_READY.startWaveButtonLabel))],
    [6100, () => {
      setPointer(null)
      ctx.api.startWave()
    }],
    [6400, () => setNote(null)],
  ], 19000)

  return (
    <SceneCard id="tower-build">
      <TowerScreen ctx={ctx} stageRef={stageRef} panel="build" onPlaceTower={handlePlaceTower} />
      <DemoLayer ctx={ctx} stageRef={stageRef} pointer={pointer} note={note} />
    </SceneCard>
  )
}

// ───────────── 헤더 (실제 TowerBattleHeader) ─────────────

/** 데스크톱에서 한 줄 헤더가 칩(배치 중 · 연속 정답)까지 한 줄에 들어가는 크기 — 줄이 바뀌면 맵이 장면 도중 줄어든다 */
const HEADER_MAX_ZOOM = 0.62
const HEADER_MAX_ZOOM_PHONE = 0.6
const HEADER_MIN_ZOOM = 0.42
/** 프레임 높이 중 헤더가 차지해도 되는 몫 — 태블릿은 헤더가 세 줄로 쌓여 이만큼으로 줄인다. 낮은 창(크롬북)은 더 아낀다 */
function headerShare(frameHeight: number): number {
  return frameHeight < 480 ? 0.19 : 0.22
}

function TowerHeader({ battle, ui, boxRef, onFrame }: {
  battle: BattleView
  ui: DemoUi
  boxRef: RefObject<HTMLDivElement>
  onFrame: (frame: FrameSize | null) => void
}) {
  const status = getTowerQuizStatus({
    progress: ui.quiz[battle.currentWave] ?? NO_QUIZ,
    currentWave: battle.currentWave,
    isWaveActive: battle.isWaveActive,
    waveEnemiesRemaining: battle.queueCount,
  })
  const { waveProgress } = getTowerWaveOutlook(battle.currentWave)
  const hp = useTween(battle.hp, battle.version)
  const gold = useTween(battle.gold, battle.version)
  const earned = useTween(battle.earned, battle.version)

  const frame = useFrameSize(boxRef)
  useEffect(() => {
    onFrame(frame)
  }, [frame, onFrame])

  // 프레임 크기가 바뀔 때만 다시 잰다 (칩이 생기고 없어질 때마다 재면 헤더가 장면 도중 커졌다 작아진다)
  const [zoom, setZoom] = useState(HEADER_MAX_ZOOM)
  useLayoutEffect(() => {
    const box = boxRef.current
    if (!box || !frame) return
    const natural = box.getBoundingClientRect().height / appliedZoom(box)
    if (!natural) return
    const max = frame.width < 520 ? HEADER_MAX_ZOOM_PHONE : HEADER_MAX_ZOOM
    const next = Math.max(HEADER_MIN_ZOOM, Math.min(max, (frame.height * headerShare(frame.height)) / natural))
    setZoom((prev) => (Math.abs(prev - next) > 0.004 ? next : prev))
  }, [frame, boxRef])

  return (
    <div ref={boxRef} className="pointer-events-none px-2 pt-2" style={{ zoom }}>
      <TowerBattleHeader
        roomCode={DEMO_ROOM_CODE}
        questionSetTitle={DEMO_SET_NAME}
        selectedTowerType={ui.selectedTowerType}
        hp={hp}
        gold={gold}
        totalGoldEarned={earned}
        currentWave={battle.currentWave}
        isWaveActive={battle.isWaveActive}
        waveEnemiesRemaining={battle.queueCount}
        waveProgress={waveProgress}
        score={earned}
        quizHudValue={status.quizHudValue}
        quizHudDetail={status.quizHudDetail}
        quizButtonLabel={status.quizButtonLabel}
        consecutiveCorrect={ui.streak}
        isQuizAvailable={status.isQuizAvailable}
        canStartWave={status.canStartWave}
        startWaveButtonLabel={status.startWaveButtonLabel}
        onQuizClick={noop}
        onStartWave={noop}
      />
    </div>
  )
}

export default function TowerTutorialDemo() {
  const { view: battle, api } = useDemoBattle(START)
  const [ui, setUi] = useState<DemoUi>(UI_START)
  const [frame, setFrame] = useState<FrameSize | null>(null)
  const headerRef = useRef<HTMLDivElement>(null)
  const ctx: SceneCtx = { frame, battle, api, ui, setUi, headerRef }

  return (
    <TutorialDemoFrame
      backgroundClassName="tower-command-screen"
      header={() => <TowerHeader battle={battle} ui={ui} boxRef={headerRef} onFrame={setFrame} />}
      /* 규칙 6장과 1:1 — lib/game/tutorials.ts 의 tower 슬라이드 순서와 같습니다 */
      phases={[
        { key: 'goal', duration: 9000, step: 1, caption: `웨이브 ${WAVES.length}번을 다 막으면 이겨요` },
        { key: 'leak', duration: 7000, step: 2, caption: '적이 출구로 나가면 체력이 깎여요' },
        { key: 'quiz', duration: 4800, step: 3, caption: `웨이브를 시작하려면 퀴즈 ${TOWER_QUIZZES_PER_WAVE}문제부터` },
        { key: 'correct', duration: 4200, step: 4, caption: `빨리 맞힐수록 골드가 많아요 — 최대 ${QUIZ_GOLD_FAST}골드` },
        { key: 'item', duration: 6800, step: 5, caption: `${TOWER_QUIZZES_PER_WAVE}문제 다 맞히면 아이템 — 아이템 칸에 챙겨 둬요` },
        { key: 'build', duration: 12000, step: 6, caption: '길을 피해 타워를 세워 적을 막아요' },
      ]}
    >
      {({ phase }) => {
        if (phase === 'goal') return <GoalScene key="goal" ctx={ctx} />
        if (phase === 'leak') return <LeakScene key="leak" ctx={ctx} />
        if (phase === 'quiz') return <QuizScene key="quiz" ctx={ctx} />
        if (phase === 'correct') return <CorrectScene key="correct" ctx={ctx} />
        if (phase === 'item') return <ItemScene key="item" ctx={ctx} />
        return <BuildScene key="build" ctx={ctx} />
      }}
    </TutorialDemoFrame>
  )
}
