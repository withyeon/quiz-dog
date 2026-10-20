'use client'

import { forwardRef, useCallback, useEffect, useImperativeHandle, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { RAID_SPRITE_SRC } from '@/components/raid/raidAssets'
import ArenaControls from '@/components/raid/arena/ArenaControls'
import { ARENA_IMAGE_SRC, drawArena, type ArenaImageKey, type ArenaImages, type BossImages } from '@/components/raid/arena/arenaRenderer'
import { useArenaInput } from '@/components/raid/arena/useArenaInput'
import type { RaidBossSprite, RaidRole, RaidSkillPhase } from '@/lib/game/raid'
import {
  ARENA,
  WORLD_H,
  WORLD_W,
  createArena,
  getArenaBossLine,
  grantBalloons,
  pushFloatText,
  tickArena,
  type ArenaEvent,
  type ArenaState,
  type Dir,
} from '@/lib/game/raidArena'
import { isAvatarPath, resolveAvatarSrc } from '@/lib/utils/playerDisplay'

export type ArenaHud = {
  balloons: number
  range: number
  shoes: number
  needles: number
  guard: boolean
  trapped: boolean
  bossLine: string
  snowmen: number
}

export type RaidArenaHandle = {
  grantBalloons: (count: number) => void
  /** 펭귄 위에 떠오르는 데미지 글자 */
  showBossDamage: (damage: number, groggy: boolean) => void
}

export type RaidArenaProps = {
  /** 방 코드 + 시작 시각. 무대 배치의 씨앗 */
  seedKey: string
  role: RaidRole | null
  /** 지금 싸우는 펭귄 순번. 전부 쓰러뜨렸으면 roster 길이 */
  bossIndex: number
  bossPresent: boolean
  bossSprite: RaidBossSprite | null
  /** 순번 → 그림. 쓰러진 장면에 이전 펭귄을 그린다 */
  rosterSprites: RaidBossSprite[]
  bossGroggy: boolean
  shieldActive: boolean
  skillPhase: RaidSkillPhase
  skillCycle: number
  /** 세상이 멈춰야 할 때 (퀴즈를 푸는 중 · 선생님이 멈춤) */
  frozen: boolean
  avatar: string
  onEvent: (event: ArenaEvent, state: ArenaState) => void
  onOpenQuiz: () => void
  onHud?: (hud: ArenaHud) => void
}

/** HUD(React)로 상태를 올리는 주기 (ms) */
const HUD_SYNC_MS = 150
const MAX_DT = 0.05

/** 화면 가운데에 잠깐 뜨는 안내 (갇힘·아이템·물풍선 없음) */
type Notice = { id: number; text: string; tone: 'good' | 'bad' | 'info' }

/**
 * 크레이지아케이드식 아레나 화면. 캔버스 게임 루프가 ref 안의 상태를 60fps 로 돌리고,
 * React 는 HUD·안내·조작 버튼만 저빈도로 그린다. 규칙은 전부 lib/game/raidArena 에 있다.
 */
const RaidArena = forwardRef<RaidArenaHandle, RaidArenaProps>(function RaidArena(props, ref) {
  const {
    seedKey,
    role,
    bossIndex,
    bossPresent,
    bossSprite,
    rosterSprites,
    bossGroggy,
    shieldActive,
    skillPhase,
    skillCycle,
    frozen,
    avatar,
    onEvent,
    onOpenQuiz,
    onHud,
  } = props

  const canvasRef = useRef<HTMLCanvasElement>(null)
  const stateRef = useRef<ArenaState | null>(null)
  const propsRef = useRef(props)
  propsRef.current = props
  const dirStackRef = useRef<Dir[]>([])
  const placeRef = useRef(false)
  const bossImagesRef = useRef<BossImages>({ guard: {}, knight: {}, general: {}, emperor: {} })
  const avatarImageRef = useRef<HTMLImageElement | null>(null)
  const imagesRef = useRef<ArenaImages>({})
  const [hud, setHud] = useState<ArenaHud>({ balloons: ARENA.START_BALLOONS, range: ARENA.BASE_RANGE, shoes: 0, needles: 0, guard: false, trapped: false, bossLine: '', snowmen: 0 })
  const [notices, setNotices] = useState<Notice[]>([])
  const noticeIdRef = useRef(0)

  const pushNotice = useCallback((text: string, tone: Notice['tone']) => {
    const id = ++noticeIdRef.current
    setNotices((prev) => [...prev.slice(-1), { id, text, tone }])
    window.setTimeout(() => setNotices((prev) => prev.filter((n) => n.id !== id)), 1400)
  }, [])

  const { isTouch, press, release } = useArenaInput({ dirStackRef, placeRef, onQuizKey: () => propsRef.current.onOpenQuiz() })

  useImperativeHandle(ref, () => ({
    grantBalloons: (count: number) => {
      const state = stateRef.current
      if (!state) return
      grantBalloons(state, count)
      pushNotice(`물풍선 +${count}`, 'good')
    },
    showBossDamage: (damage: number, groggy: boolean) => {
      const state = stateRef.current
      if (!state) return
      pushFloatText(state, state.boss.x + ARENA.BOSS_W / 2 + (Math.random() - 0.5) * 0.8, 0.6, `-${damage}`, groggy ? '#fde047' : '#fb7185')
    },
  }), [pushNotice])

  // 그림 미리 받기
  useEffect(() => {
    for (const key of Object.keys(ARENA_IMAGE_SRC) as ArenaImageKey[]) {
      const img = document.createElement('img')
      img.src = ARENA_IMAGE_SRC[key]
      imagesRef.current[key] = img
    }
    const sprites: RaidBossSprite[] = ['guard', 'knight', 'general', 'emperor']
    for (const sprite of sprites) {
      for (const kind of ['idle', 'hurt', 'down'] as const) {
        const img = document.createElement('img')
        img.src = RAID_SPRITE_SRC[sprite][kind]
        bossImagesRef.current[sprite][kind] = img
      }
    }
  }, [])
  useEffect(() => {
    const normalized = avatar.trim()
    if (!isAvatarPath(normalized)) {
      avatarImageRef.current = null
      return
    }
    const img = document.createElement('img')
    img.src = resolveAvatarSrc(normalized)
    avatarImageRef.current = img
  }, [avatar])

  // 아레나 만들기 (씨앗이 바뀔 때만 — 새 판)
  useEffect(() => {
    const current = propsRef.current
    stateRef.current = createArena(seedKey, {
      bossIndex: current.bossIndex,
      bossPresent: current.bossPresent,
      bossGroggy: current.bossGroggy,
      skillPhase: current.skillPhase,
      skillCycle: current.skillCycle,
      role: current.role,
    })
    // 개발 빌드에서만: 헤드리스 검수 드라이버가 상태를 들여다보고 플레이어를 옮길 수 있게 한다
    if (process.env.NODE_ENV !== 'production') {
      ;(window as unknown as { __raidArena?: typeof stateRef }).__raidArena = stateRef
    }
  }, [seedKey])

  // 게임 루프 (마운트 때 한 번)
  useEffect(() => {
    let rafId = 0
    let lastT = 0
    let lastHud = 0
    const dpr = Math.min(2, window.devicePixelRatio || 1)

    const draw = (now: number) => {
      const canvas = canvasRef.current
      const state = stateRef.current
      if (!canvas || !state) return
      if (canvas.width !== WORLD_W * dpr || canvas.height !== WORLD_H * dpr) {
        canvas.width = WORLD_W * dpr
        canvas.height = WORLD_H * dpr
      }
      const ctx = canvas.getContext('2d')
      if (!ctx) return
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      const current = propsRef.current
      const downSprite = state.boss.downSprite !== null ? current.rosterSprites[state.boss.downSprite] ?? null : null
      drawArena(ctx, state, {
        bossImages: bossImagesRef.current,
        images: imagesRef.current,
        avatarImage: avatarImageRef.current,
        avatarFallback: isAvatarPath(current.avatar) ? '🐕' : current.avatar || '🐕',
        bossSprite: current.bossSprite,
        downSprite,
        groggy: current.bossGroggy,
        shieldActive: current.shieldActive,
        now: now / 1000,
        frozen: current.frozen,
      })
    }

    const tick = (now: number) => {
      rafId = requestAnimationFrame(tick)
      const state = stateRef.current
      if (!state) return
      const dt = Math.min((now - (lastT || now)) / 1000, MAX_DT)
      lastT = now
      const current = propsRef.current

      if (!current.frozen) {
        const input = { dir: dirStackRef.current[0] ?? null, placeBalloon: placeRef.current }
        placeRef.current = false
        const events = tickArena(state, dt, input, {
          bossIndex: current.bossIndex,
          bossPresent: current.bossPresent,
          bossGroggy: current.bossGroggy,
          skillPhase: current.skillPhase,
          skillCycle: current.skillCycle,
          role: current.role,
        })
        for (const event of events) {
          current.onEvent(event, state)
          if (event.type === 'trapped') pushNotice(event.by === 'boss' ? '펭귄에 닿았어요! 물방울에 갇혔어요' : event.by === 'snowman' ? '스노우몬에 닿았어요!' : '물줄기에 맞았어요!', 'bad')
          else if (event.type === 'guarded') pushNotice('보호막이 막아 줬어요!', 'good')
          else if (event.type === 'needle') pushNotice('바늘로 물방울을 터뜨렸어요!', 'good')
          else if (event.type === 'no_balloons') pushNotice('물풍선이 없어요! 퀴즈를 풀어요', 'bad')
          else if (event.type === 'item') pushNotice(event.kind === 'range' ? '물줄기가 길어졌어요!' : event.kind === 'shoe' ? '스케이트! 더 빨라졌어요' : event.kind === 'needle' ? '바늘을 주웠어요! 갇히면 자동으로 탈출' : '물풍선 +2', 'good')
          else if (event.type === 'snowman_killed') pushNotice('스노우몬을 깼어요!', 'good')
          else if (event.type === 'thawed') pushNotice('스노우몬이 녹아서 폭주해요!', 'bad')
          else if (event.type === 'sweep') pushNotice('물보라! 펭귄이 움직이기 시작해요', 'info')
        }
      } else {
        placeRef.current = false
      }

      if (now - lastHud >= HUD_SYNC_MS) {
        lastHud = now
        const next: ArenaHud = {
          balloons: state.player.balloons,
          range: state.player.range,
          shoes: state.player.shoes,
          needles: state.player.needles,
          guard: state.player.guard,
          trapped: state.player.state === 'trapped',
          bossLine: getArenaBossLine(state, current.bossGroggy),
          snowmen: state.snowmen.length,
        }
        setHud((prev) => (
          prev.balloons === next.balloons && prev.range === next.range && prev.shoes === next.shoes && prev.needles === next.needles && prev.guard === next.guard
            && prev.trapped === next.trapped && prev.bossLine === next.bossLine && prev.snowmen === next.snowmen
            ? prev
            : next
        ))
        current.onHud?.(next)
      }
      draw(now)
    }

    rafId = requestAnimationFrame((t) => {
      lastT = t
      tick(t)
    })
    return () => cancelAnimationFrame(rafId)
  // 루프는 한 번만 돈다. 바뀌는 값은 전부 propsRef 로 읽는다
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // 퀴즈가 열리면 눌려 있던 방향은 버린다 (닫은 뒤 혼자 걷지 않게)
  useEffect(() => {
    if (frozen) dirStackRef.current = []
  }, [frozen])

  void bossIndex
  void bossPresent
  void bossSprite
  void rosterSprites
  void bossGroggy
  void shieldActive
  void skillPhase
  void skillCycle
  void role
  void onEvent

  return (
    <div className="relative w-full">
      <div
        className="relative mx-auto w-full overflow-hidden rounded-2xl ring-2 ring-sky-200/70 shadow-xl shadow-sky-950/20"
        style={{ aspectRatio: `${WORLD_W} / ${WORLD_H}`, maxWidth: `min(100%, calc((100dvh - 250px) * ${(WORLD_W / WORLD_H).toFixed(3)}))` }}
      >
        <canvas ref={canvasRef} className="block h-full w-full touch-none" aria-label="펭귄 아레나" />

        {/* 상태 칩 (왼쪽 위) */}
        <div className="pointer-events-none absolute left-2 top-2 flex flex-wrap gap-1">
          <span className={`rounded-full px-2 py-0.5 text-[11px] font-black shadow sm:text-xs ${hud.balloons <= 0 ? 'bg-rose-500 text-white' : 'bg-white/90 text-sky-800'}`}>
            물풍선 {hud.balloons}
          </span>
          <span className="rounded-full bg-white/90 px-2 py-0.5 text-[11px] font-black text-sky-800 shadow sm:text-xs">물줄기 {hud.range}</span>
          {hud.shoes > 0 && <span className="rounded-full bg-white/90 px-2 py-0.5 text-[11px] font-black text-amber-700 shadow sm:text-xs">스케이트 {hud.shoes}</span>}
          {hud.needles > 0 && <span className="rounded-full bg-amber-300 px-2 py-0.5 text-[11px] font-black text-amber-950 shadow sm:text-xs">바늘 {hud.needles}</span>}
          {role === 'guardian' && (
            <span className={`rounded-full px-2 py-0.5 text-[11px] font-black shadow sm:text-xs ${hud.guard ? 'bg-cyan-400 text-cyan-950' : 'bg-white/70 text-slate-500'}`}>
              보호막 {hud.guard ? '준비' : '충전 중'}
            </span>
          )}
        </div>

        {/* 펭귄 상태 한 줄 (오른쪽 위 — 출발 칸이 있는 아래 가운데를 가리지 않게) */}
        <div className="pointer-events-none absolute right-2 top-2 flex max-w-[55%] justify-end">
          <span className="max-w-full truncate rounded-full bg-slate-900/75 px-3 py-1 text-[11px] font-bold text-white shadow sm:text-xs">
            {hud.bossLine}
          </span>
        </div>

        {/* 안내 토스트 — 펭귄 띠 위에 뜬다 (플레이어가 다니는 바닥을 가리지 않게) */}
        <div className="pointer-events-none absolute inset-x-0 top-[9%] flex flex-col items-center gap-1">
          <AnimatePresence>
            {notices.map((notice) => (
              <motion.div
                key={notice.id}
                initial={{ opacity: 0, y: 8, scale: 0.9 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -8 }}
                className={`rounded-xl px-3 py-1.5 text-sm font-black text-white shadow-lg ${
                  notice.tone === 'good' ? 'bg-emerald-500' : notice.tone === 'bad' ? 'bg-rose-500' : 'bg-sky-600'
                }`}
              >
                {notice.text}
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      </div>

      <ArenaControls onPress={press} onRelease={release} onOpenQuiz={onOpenQuiz} balloons={hud.balloons} isTouch={isTouch} />
    </div>
  )
})

export default RaidArena
