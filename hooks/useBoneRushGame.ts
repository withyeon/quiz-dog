'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import {
  BONE_RUSH,
  admitCat,
  admitCourier,
  applyCard,
  cancelChest,
  createBoneRushState,
  drawCards,
  lockChest,
  nameWithJosa,
  parseBoneRushSave,
  toBoneRushSave,
  type BoneRushState,
  type Card,
  type StepEvent,
} from '@/lib/game/boneRush'
import { subscribeRoomRuntimeEvent, type RoomEventType } from '@/lib/realtime/roomChannel'
import type { SFXType } from '@/hooks/useAudio'
import type { Database } from '@/types/database.types'

type Player = Database['public']['Tables']['players']['Row']

export type BoneRushNotice = { id: number; text: string; tone: 'good' | 'bad' | 'info' }

/** 친구가 보낸 도둑 고양이 */
export type CatEventPayload = { catId: string; targetId: string; fromId: string; fromName: string }
/** 고양이가 돌아가며 보낸 친구(공격한 사람)에게 알리는 결과 */
export type LootEventPayload = { catId: string; targetId: string; fromId: string; fromName: string; bones: number; blocked: boolean }

/** 화면 위 숫자판 (마당 상태를 200ms 마다 읽어 온다) */
export type BoneRushHud = {
  bones: number
  fences: number
  magnetMs: number
  playMs: number
  /** 마당에 있는 고양이 (친구 고양이·들고양이) */
  cats: number
  collected: number
  looted: number
}

interface UseBoneRushGameParams {
  playerId: string | null
  currentPlayer: Player | null | undefined
  players: Player[]
  currentView: string
  setCurrentView: (view: string) => void
  checkAnswer: (answer: string) => Promise<boolean>
  goToNextQuestion: () => void
  playSFX: (sound: SFXType) => void
  commitPlayerPatch: (playerId: string, patch: Record<string, unknown>, reason?: string) => Promise<void>
  sendRoomEvent: (type: RoomEventType, payload?: unknown) => Promise<unknown>
  /** 오답 화면 시간(ms) */
  wrongScreenMs: number
  /** 방이 진행 중이고 선생님이 멈추지 않았는지 */
  isRoomRunning: boolean
}

const HUD_MS = 200
const SAVE_INTERVAL_MS = 2000
const CORRECT_SHOW_MS = 1100

function readHud(state: BoneRushState): BoneRushHud {
  return {
    bones: state.bones,
    fences: state.fences,
    magnetMs: Math.ceil(state.magnetMs / 1000) * 1000,
    playMs: Math.floor(state.playMs / 1000) * 1000,
    cats: state.cats.filter((cat) => cat.kind !== 'courier' && cat.phase !== 'leave').length,
    collected: state.stats.collected,
    looted: state.stats.looted,
  }
}

const sameHud = (a: BoneRushHud, b: BoneRushHud) => JSON.stringify(a) === JSON.stringify(b)

/**
 * 뼈다귀 쟁탈전 게임 흐름 훅.
 *
 * 화면(view): 'play'(마당) → 상자에 닿으면 'quiz'(내 화면만 멈추고 문제) →
 *   정답이면 'pick'(카드 3장) → 고양이 카드면 보낼 친구 고르기 → 'play'.
 *   오답이면 오답 배너 뒤 상자가 잠기고 'play'.
 * 친구 고양이·돌아온 고양이는 이벤트로 받아 줄을 세웠다가 마당이 돌아갈 때 들인다.
 * 저장: players.score = 뼈다귀 수, players.item_effects = BoneRushSave (2초 모아서).
 */
export function useBoneRushGame({
  playerId,
  currentPlayer,
  players,
  currentView,
  setCurrentView,
  checkAnswer,
  goToNextQuestion,
  playSFX,
  commitPlayerPatch,
  sendRoomEvent,
  wrongScreenMs,
  isRoomRunning,
}: UseBoneRushGameParams) {
  const stateRef = useRef<BoneRushState>(createBoneRushState())
  const [hud, setHud] = useState<BoneRushHud>(() => readHud(stateRef.current))
  const [cards, setCards] = useState<Card[] | null>(null)
  const [choosingTarget, setChoosingTarget] = useState(false)
  const [notice, setNotice] = useState<BoneRushNotice | null>(null)
  /** 이 상자에서 남은 문제 기회 */
  const [triesLeft, setTriesLeft] = useState<number>(BONE_RUSH.CHEST_TRIES)
  const [banner, setBanner] = useState<{ id: number; text: string; tone: 'warn' | 'good' } | null>(null)

  const viewRef = useRef(currentView)
  const answeringRef = useRef(false)
  const pickingRef = useRef(false)
  const noticeIdRef = useRef(0)
  const timersRef = useRef<number[]>([])
  const lastSavedRef = useRef('')
  const lastPickSfxRef = useRef(0)
  const incomingCatsRef = useRef<CatEventPayload[]>([])
  const incomingLootRef = useRef<LootEventPayload[]>([])
  const seenIdsRef = useRef<Set<string>>(new Set())

  useEffect(() => { viewRef.current = currentView }, [currentView])

  const later = useCallback((fn: () => void, ms: number) => {
    const id = window.setTimeout(() => {
      timersRef.current = timersRef.current.filter((item) => item !== id)
      fn()
    }, ms)
    timersRef.current.push(id)
  }, [])
  useEffect(() => () => timersRef.current.forEach((id) => window.clearTimeout(id)), [])

  const showNotice = useCallback((text: string, tone: BoneRushNotice['tone'] = 'info') => {
    noticeIdRef.current += 1
    setNotice({ id: noticeIdRef.current, text, tone })
  }, [])
  useEffect(() => {
    if (!notice) return
    const timer = window.setTimeout(() => setNotice((current) => (current?.id === notice.id ? null : current)), 2800)
    return () => window.clearTimeout(timer)
  }, [notice])

  const showBanner = useCallback((text: string, tone: 'warn' | 'good' = 'warn') => {
    noticeIdRef.current += 1
    const id = noticeIdRef.current
    setBanner({ id, text, tone })
    window.setTimeout(() => setBanner((current) => (current?.id === id ? null : current)), 2400)
  }, [])

  // ─── 저장 ───
  const flushSave = useCallback(() => {
    if (!playerId) return
    const save = toBoneRushSave(stateRef.current)
    const signature = `${save.bones}|${save.fences}|${JSON.stringify(save.stats)}|${Math.floor(save.playMs / 5000)}`
    if (signature === lastSavedRef.current) return
    lastSavedRef.current = signature
    void commitPlayerPatch(playerId, { score: save.bones, item_effects: save }, 'bone_rush_update').catch((error) => {
      console.error('Error saving bone rush:', error)
    })
  }, [commitPlayerPatch, playerId])
  const flushSaveRef = useRef(flushSave)
  useEffect(() => { flushSaveRef.current = flushSave }, [flushSave])

  useEffect(() => {
    const timer = window.setInterval(() => flushSaveRef.current(), SAVE_INTERVAL_MS)
    const onHide = () => flushSaveRef.current()
    window.addEventListener('pagehide', onHide)
    return () => {
      window.clearInterval(timer)
      window.removeEventListener('pagehide', onHide)
      flushSaveRef.current()
    }
  }, [])

  // 저장된 판 이어 하기 (새로고침 방어) — 플레이어당 한 번만
  const restoredPlayerIdRef = useRef<string | null>(null)
  useEffect(() => {
    if (!currentPlayer || restoredPlayerIdRef.current === currentPlayer.id) return
    restoredPlayerIdRef.current = currentPlayer.id
    const save = parseBoneRushSave(currentPlayer.item_effects)
    if (!save) return
    // 순위용 점수(DB)가 저장값보다 크면 그쪽을 믿는다 (저장이 조금 늦었을 수 있다)
    save.bones = Math.max(save.bones, currentPlayer.score ?? 0)
    stateRef.current = createBoneRushState(save, stateRef.current.yard)
    setHud(readHud(stateRef.current))
  }, [currentPlayer])

  // 개발 서버에서만: 자동 검수 드라이버가 마당 상태를 읽을 수 있게 (미리보기의 window.__boneRush 와 같은 이름)
  useEffect(() => {
    if (process.env.NODE_ENV !== 'development') return
    const timer = window.setInterval(() => { (window as unknown as { __boneRush?: BoneRushState }).__boneRush = stateRef.current }, 500)
    return () => window.clearInterval(timer)
  }, [])

  // ─── 숫자판 ───
  useEffect(() => {
    const timer = window.setInterval(() => {
      const next = readHud(stateRef.current)
      setHud((current) => (sameHud(current, next) ? current : next))
    }, HUD_MS)
    return () => window.clearInterval(timer)
  }, [])

  // ─── 친구 고양이·돌아온 고양이 받기 ───
  useEffect(() => {
    return subscribeRoomRuntimeEvent((event) => {
      if (!playerId) return
      if (event.type === 'bone_rush:cat') {
        const payload = event.payload as Partial<CatEventPayload> | undefined
        if (!payload?.catId || payload.targetId !== playerId || payload.fromId === playerId) return
        const key = `cat:${payload.catId}`
        if (seenIdsRef.current.has(key)) return
        seenIdsRef.current.add(key)
        incomingCatsRef.current.push({ catId: payload.catId, targetId: payload.targetId, fromId: payload.fromId || '', fromName: payload.fromName || '친구' })
      } else if (event.type === 'bone_rush:loot') {
        const payload = event.payload as Partial<LootEventPayload> | undefined
        if (!payload?.catId || payload.targetId !== playerId) return
        const key = `loot:${payload.catId}`
        if (seenIdsRef.current.has(key)) return
        seenIdsRef.current.add(key)
        const bones = Math.max(0, Math.floor(Number(payload.bones) || 0))
        if (payload.blocked || bones <= 0) {
          showNotice(payload.blocked ? `🛡️ ${payload.fromName || '친구'}의 울타리에 고양이가 막혔어요` : `😿 고양이가 ${payload.fromName || '친구'}의 뼈다귀를 하나도 못 물어 왔어요`, 'bad')
          return
        }
        incomingLootRef.current.push({ catId: payload.catId, targetId: payload.targetId, fromId: payload.fromId || '', fromName: payload.fromName || '친구', bones, blocked: false })
      }
    })
  }, [playerId, showNotice])

  // 마당이 돌아갈 때 줄 선 고양이를 하나씩 들인다
  useEffect(() => {
    if (currentView !== 'play' || !isRoomRunning) return
    const timer = window.setInterval(() => {
      const state = stateRef.current
      if (state.pendingQuiz) return
      const cat = incomingCatsRef.current.shift()
      if (cat) {
        admitCat(state, cat)
        if (state.cats[state.cats.length - 1]?.blocked) {
          showBanner(`🛡️ ${nameWithJosa(cat.fromName, '이/가')} 보낸 고양이를 울타리가 막았어요!`, 'good')
        } else {
          playSFX('incorrect')
          showBanner(`😼 ${nameWithJosa(cat.fromName, '이/가')} 도둑 고양이를 보냈어요! 도망쳐요!`)
        }
      }
      const loot = incomingLootRef.current.shift()
      if (loot) admitCourier(state, loot)
    }, 350)
    return () => window.clearInterval(timer)
  }, [currentView, isRoomRunning, playSFX, showBanner])

  // ─── 문제 열기·닫기 ───
  const openQuiz = useCallback(() => {
    if (viewRef.current !== 'play') return
    answeringRef.current = false
    setTriesLeft(BONE_RUSH.CHEST_TRIES)
    viewRef.current = 'quiz'
    setCurrentView('quiz')
  }, [setCurrentView])

  const resumePlay = useCallback(() => {
    answeringRef.current = false
    pickingRef.current = false
    setChoosingTarget(false)
    goToNextQuestion()
    viewRef.current = 'play'
    setCurrentView('play')
  }, [goToNextQuestion, setCurrentView])

  // 마당에서 상자를 열었는데 문제 화면이 안 떴으면 연다 (이벤트를 놓쳐도 멈춰 있지 않게)
  useEffect(() => {
    if (currentView !== 'play' || !isRoomRunning) return
    const timer = window.setInterval(() => {
      if (stateRef.current.pendingQuiz) openQuiz()
    }, 300)
    return () => window.clearInterval(timer)
  }, [currentView, isRoomRunning, openQuiz])

  // ─── 마당이 알려 주는 일 ───
  const handleEvents = useCallback((events: StepEvent[]) => {
    for (const event of events) {
      switch (event.type) {
        case 'chest':
          playSFX('item')
          openQuiz()
          break
        case 'pickup': {
          const now = performance.now()
          if (now - lastPickSfxRef.current > 200) {
            lastPickSfxRef.current = now
            playSFX('click')
          }
          break
        }
        case 'bark':
          playSFX('item')
          break
        case 'wild':
          showBanner('🙀 들고양이가 나타났어요! 뼈다귀를 물면 땅에 떨어져요 — 다시 주워요')
          break
        case 'bite':
          playSFX('incorrect')
          if (event.kind === 'friend') showNotice(`😿 ${event.fromName}의 고양이가 뼈다귀 ${event.bones}개를 물어 갔어요!`, 'bad')
          else showNotice(`😾 들고양이가 뼈다귀 ${event.bones}개를 흩뿌렸어요! 얼른 주워요`, 'bad')
          break
        case 'blocked':
          playSFX('correct')
          break
        case 'catLeft': {
          // 고양이가 돌아갔다 → 보낸 친구에게 결과를 알린다 (친구 화면에 배달 고양이가 들어간다)
          if (!playerId) break
          const payload: LootEventPayload = {
            catId: event.catId,
            targetId: event.fromId,
            fromId: playerId,
            fromName: currentPlayer?.nickname || '친구',
            bones: event.carried,
            blocked: event.blocked,
          }
          void sendRoomEvent('bone_rush:loot', payload)
          if (!event.blocked) showNotice(event.carried > 0 ? `😼 ${event.fromName}의 고양이가 뼈다귀 ${event.carried}개를 물고 돌아갔어요` : `😼 ${event.fromName}의 고양이가 빈손으로 돌아갔어요!`, event.carried > 0 ? 'bad' : 'good')
          break
        }
        case 'delivered':
          playSFX('correct')
          showBanner(`😼 고양이가 ${event.fromName}의 뼈다귀 ${event.bones}개를 물고 왔어요!`, 'good')
          break
        case 'catArrived':
          break
        default:
          break
      }
    }
  }, [currentPlayer?.nickname, openQuiz, playSFX, playerId, sendRoomEvent, showBanner, showNotice])

  // ─── 정답 제출 ───
  const otherPlayers = players.filter((player) => player.id !== playerId && !player.is_kicked)
  const canAttack = otherPlayers.length > 0

  const handleAnswerSubmit = async (answer: string) => {
    if (answeringRef.current) return false
    answeringRef.current = true
    const correct = await checkAnswer(answer)
    const state = stateRef.current
    if (correct) {
      playSFX('correct')
      state.stats.correct += 1
      setCards(drawCards(state, canAttack))
      pickingRef.current = false
      later(() => {
        if (viewRef.current === 'quiz') {
          viewRef.current = 'pick'
          setCurrentView('pick')
        }
      }, CORRECT_SHOW_MS)
      return true
    }
    playSFX('incorrect')
    state.stats.wrong += 1
    const left = triesLeft - 1
    setTriesLeft(left)
    later(() => {
      if (left > 0) {
        // 기회가 남았으면 같은 상자에서 다음 문제로 다시 도전 ('quiz' 그대로)
        answeringRef.current = false
        showNotice(`😣 아쉬워요! 기회가 ${left}번 남았어요`, 'info')
        goToNextQuestion()
        return
      }
      lockChest(stateRef.current)
      showNotice('🔒 기회를 다 썼어요. 상자가 잠기고 다음 상자를 기다려요', 'info')
      flushSaveRef.current()
      resumePlay()
    }, wrongScreenMs)
    return false
  }

  /** 정답 화면에서 바로 넘어가기 (QuizView 의 '정답입니다 →' 버튼) */
  const skipCorrectBanner = useCallback(() => {
    if (viewRef.current === 'quiz' && cards) {
      viewRef.current = 'pick'
      setCurrentView('pick')
    }
  }, [cards, setCurrentView])

  const pickCard = useCallback((index: number) => {
    const card = cards?.[index]
    if (!card || pickingRef.current) return
    if (card.kind === 'cat') {
      setChoosingTarget(true)
      return
    }
    pickingRef.current = true
    applyCard(stateRef.current, card)
    playSFX('item')
    if (card.kind === 'sack') showNotice(card.gold ? `✨ 황금 보따리! 뼈다귀 ${card.bones}개` : `🦴 뼈다귀 ${card.bones}개를 받았어요`, 'good')
    if (card.kind === 'fence') showNotice(`🛡️ 울타리를 세웠어요 (${stateRef.current.fences}/${BONE_RUSH.FENCE_MAX})`, 'good')
    if (card.kind === 'magnet') showNotice('🧲 뼈다귀가 저절로 날아와요!', 'good')
    setCards(null)
    flushSaveRef.current()
    resumePlay()
  }, [cards, playSFX, resumePlay, showNotice])

  const cancelTarget = useCallback(() => setChoosingTarget(false), [])

  const sendCat = useCallback((targetId: string) => {
    if (pickingRef.current || !playerId) return
    const target = otherPlayers.find((player) => player.id === targetId)
    if (!target) return
    pickingRef.current = true
    const payload: CatEventPayload = {
      catId: `${playerId}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      targetId,
      fromId: playerId,
      fromName: currentPlayer?.nickname || '친구',
    }
    void sendRoomEvent('bone_rush:cat', payload)
    applyCard(stateRef.current, { kind: 'cat' })
    playSFX('item')
    showNotice(`😼 ${target.nickname}의 마당으로 도둑 고양이가 달려갔어요!`, 'info')
    setCards(null)
    flushSaveRef.current()
    resumePlay()
  }, [currentPlayer?.nickname, otherPlayers, playSFX, playerId, resumePlay, sendRoomEvent, showNotice])

  /** 문제를 불러올 수 없을 때 상자만 치우고 계속 (방어용) */
  const abandonChest = useCallback(() => {
    cancelChest(stateRef.current)
    resumePlay()
  }, [resumePlay])

  return {
    stateRef,
    hud,
    triesLeft,
    cards,
    choosingTarget,
    otherPlayers,
    notice,
    banner,
    handleEvents,
    handleAnswerSubmit,
    skipCorrectBanner,
    pickCard,
    cancelTarget,
    sendCat,
    abandonChest,
  }
}
