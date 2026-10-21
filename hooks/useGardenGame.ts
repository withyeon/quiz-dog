'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import {
  GARDEN,
  advanceGarden,
  applyCrowPeck,
  buyExpansion,
  buyScarecrow,
  buySeed,
  buySprinkler,
  claimRewardCard,
  CROP_BY_ID,
  drawRewardCards,
  harvestAll,
  harvestPlot,
  isRipe,
  parseGarden,
  pickCrowTarget,
  plantSeed,
  recordCrowShooed,
  restockShop,
  createGarden,
  type CropId,
  type CrowEventPayload,
  type GardenState,
  type HarvestResult,
  type RewardCard,
} from '@/lib/game/garden'
import { withJosa } from '@/lib/utils/korean'
import { subscribeRoomRuntimeEvent, type RoomEventType } from '@/lib/realtime/roomChannel'
import type { SFXType } from '@/hooks/useAudio'
import type { Database } from '@/types/database.types'

type Player = Database['public']['Tables']['players']['Row']

export type ActiveCrow = {
  crowId: string
  fromName: string
  plotIndex: number
  tapsLeft: number
  leftMs: number
}

export type GardenNotice = { id: number; text: string; tone: 'good' | 'bad' | 'info' }
export type HarvestFloat = HarvestResult & { id: number }

interface UseGardenGameParams {
  playerId: string | null
  currentPlayer: Player | null | undefined
  players: Player[]
  currentView: string
  setCurrentView: (view: string) => void
  checkAnswer: (answer: string) => Promise<boolean>
  handleWrongAnswer: () => void
  goToNextQuestion: () => void
  playSFX: (sound: SFXType) => void
  /** 내 행 로컬 반영 + player:patch broadcast + DB 쓰기 (useGameBase.commitPlayerPatch) */
  commitPlayerPatch: (playerId: string, patch: Record<string, unknown>, reason?: string) => Promise<void>
  sendRoomEvent: (type: RoomEventType, payload?: unknown) => Promise<unknown>
  /** 방이 진행 중(playing)이고 선생님이 멈추지 않았을 때만 밭 시계가 돈다 */
  isRunning: boolean
}

const TICK_MS = 250
/** 한 틱에 흐를 수 있는 최대 시간. 탭이 숨겨졌다 돌아왔을 때 한꺼번에 자라지 않게 */
const MAX_TICK_MS = 1000
/** DB 쓰기는 모아서 이 간격으로 (Realtime 한도 — 실시간 공격 이벤트 메모 참고) */
const SAVE_INTERVAL_MS = 1500
/** 밭 시계가 도는 화면 */
const CLOCK_VIEWS = new Set(['quiz', 'wrong', 'reward', 'garden'])

const randomBetween = (min: number, max: number) => min + Math.random() * (max - min)

/**
 * 블록 텃밭 키우기 게임 로직 훅.
 *
 * 방·플레이어·퀴즈 흐름은 useGameBase 가 맡고, 이 훅은 그 위에 밭을 얹는다:
 * 정답 → 무료 카드 3장(reward 화면) → 고르면 밭 화면(GARDEN.VISIT_MS) → 다음 문제.
 * 밭 시계는 퀴즈 화면에서도 돌아 작물이 자라고, 친구가 보낸 까마귀는 밭 화면에 들어왔을 때 내려앉는다.
 * 저장: players.score = 번 돈 합, players.item_effects = GardenState (1.5초 모아서).
 */
export function useGardenGame({
  playerId,
  currentPlayer,
  players,
  currentView,
  setCurrentView,
  checkAnswer,
  handleWrongAnswer,
  goToNextQuestion,
  playSFX,
  commitPlayerPatch,
  sendRoomEvent,
  isRunning,
}: UseGardenGameParams) {
  const [garden, setGardenState] = useState<GardenState>(() => createGarden())
  const [raining, setRaining] = useState(false)
  const [rewardCards, setRewardCards] = useState<RewardCard[] | null>(null)
  const [choosingCrowTarget, setChoosingCrowTarget] = useState(false)
  const [visitLeftMs, setVisitLeftMs] = useState<number>(GARDEN.VISIT_MS)
  const [selectedSeed, setSelectedSeed] = useState<CropId | null>(null)
  const [activeCrow, setActiveCrow] = useState<ActiveCrow | null>(null)
  const [incomingCrows, setIncomingCrows] = useState<Array<{ crowId: string; fromName: string }>>([])
  const [notice, setNotice] = useState<GardenNotice | null>(null)
  const [floats, setFloats] = useState<HarvestFloat[]>([])

  const gardenRef = useRef(garden)
  const viewRef = useRef(currentView)
  const runningRef = useRef(isRunning)
  const activeCrowRef = useRef<ActiveCrow | null>(null)
  const incomingRef = useRef(incomingCrows)
  const seenCrowIdsRef = useRef<Set<string>>(new Set())
  const rainLeftRef = useRef(0)
  const nextRainAtRef = useRef(randomBetween(GARDEN.RAIN_EVERY_MIN_MS, GARDEN.RAIN_EVERY_MAX_MS))
  const visitLeftRef = useRef<number>(GARDEN.VISIT_MS)
  const lastTickRef = useRef(0)
  const dirtyRef = useRef(false)
  const saveTimerRef = useRef<number | null>(null)
  const noticeIdRef = useRef(0)
  const leavingRef = useRef(false)
  const pickingRef = useRef(false)

  useEffect(() => { viewRef.current = currentView }, [currentView])
  useEffect(() => { runningRef.current = isRunning }, [isRunning])
  useEffect(() => { incomingRef.current = incomingCrows }, [incomingCrows])

  // ─── 저장 ───
  const flushSave = useCallback(() => {
    if (saveTimerRef.current !== null) {
      window.clearTimeout(saveTimerRef.current)
      saveTimerRef.current = null
    }
    if (!dirtyRef.current || !playerId) return
    dirtyRef.current = false
    const state = gardenRef.current
    void commitPlayerPatch(playerId, { score: state.earned, item_effects: state }, 'garden_update').catch((error) => {
      console.error('Error saving garden:', error)
    })
  }, [commitPlayerPatch, playerId])

  const flushSaveRef = useRef(flushSave)
  useEffect(() => { flushSaveRef.current = flushSave }, [flushSave])

  const scheduleSave = useCallback(() => {
    dirtyRef.current = true
    if (saveTimerRef.current !== null) return
    saveTimerRef.current = window.setTimeout(() => {
      saveTimerRef.current = null
      flushSaveRef.current()
    }, SAVE_INTERVAL_MS)
  }, [])

  useEffect(() => {
    const onHide = () => flushSaveRef.current()
    window.addEventListener('pagehide', onHide)
    return () => {
      window.removeEventListener('pagehide', onHide)
      flushSaveRef.current()
    }
  }, [])

  /** 밭 상태 바꾸기. save=false 는 밭 시계만 흐른 경우(저장은 다음 행동 때 같이) */
  const setGarden = useCallback((next: GardenState, save = true) => {
    gardenRef.current = next
    setGardenState(next)
    if (save) scheduleSave()
  }, [scheduleSave])

  // 저장된 밭 복원 (새로고침 방어) — 플레이어당 한 번만.
  // currentPlayer 는 DB 갱신마다 새 객체가 되므로 매번 복원하면 방금 한 일이 옛 값으로 되돌아간다.
  const restoredPlayerIdRef = useRef<string | null>(null)
  useEffect(() => {
    if (!currentPlayer || restoredPlayerIdRef.current === currentPlayer.id) return
    restoredPlayerIdRef.current = currentPlayer.id
    const saved = parseGarden(currentPlayer.item_effects)
    gardenRef.current = saved
    setGardenState(saved)
    // 비 예정 시각은 밭 시계 기준이라, 새로고침으로 시계가 앞서 있으면 들어오자마자 비가 오지 않게 다시 잡는다
    nextRainAtRef.current = saved.clockMs + randomBetween(GARDEN.RAIN_EVERY_MIN_MS, GARDEN.RAIN_EVERY_MAX_MS)
  }, [currentPlayer])

  const showNotice = useCallback((text: string, tone: GardenNotice['tone'] = 'info') => {
    noticeIdRef.current += 1
    setNotice({ id: noticeIdRef.current, text, tone })
  }, [])

  useEffect(() => {
    if (!notice) return
    const timer = window.setTimeout(() => setNotice((current) => (current?.id === notice.id ? null : current)), 2800)
    return () => window.clearTimeout(timer)
  }, [notice])

  const commitCrow = useCallback((next: ActiveCrow | null) => {
    activeCrowRef.current = next
    setActiveCrow(next)
  }, [])

  // ─── 밭을 떠나 다음 문제로 ───
  const leaveGarden = useCallback(() => {
    if (leavingRef.current || viewRef.current !== 'garden') return
    leavingRef.current = true
    setSelectedSeed(null)
    setRewardCards(null)
    flushSaveRef.current()
    goToNextQuestion()
  }, [goToNextQuestion])

  // ─── 까마귀가 내려앉기 (밭 화면에서만) ───
  const landNextCrow = useCallback(() => {
    if (activeCrowRef.current || incomingRef.current.length === 0) return
    const [crow, ...rest] = incomingRef.current
    incomingRef.current = rest
    setIncomingCrows(rest)
    const state = gardenRef.current
    if (state.scarecrows > 0) {
      setGarden(recordCrowShooed(state, true))
      showNotice(`🧑‍🌾 허수아비가 ${crow.fromName}의 까마귀를 쫓았어요!`, 'good')
      return
    }
    const plotIndex = pickCrowTarget(state)
    if (plotIndex === null) {
      showNotice(`🐦 ${crow.fromName}의 까마귀가 먹을 게 없어서 돌아갔어요`, 'info')
      return
    }
    playSFX('incorrect')
    commitCrow({ crowId: crow.crowId, fromName: crow.fromName, plotIndex, tapsLeft: GARDEN.CROW_SHOO_TAPS, leftMs: GARDEN.CROW_PECK_MS })
  }, [commitCrow, playSFX, setGarden, showNotice])

  // ─── 틱: 밭 시계·비·까마귀·밭 화면 남은 시간 ───
  useEffect(() => {
    lastTickRef.current = performance.now()
    const timer = window.setInterval(() => {
      const now = performance.now()
      const dt = Math.min(MAX_TICK_MS, Math.max(0, now - lastTickRef.current))
      lastTickRef.current = now
      if (!runningRef.current || !CLOCK_VIEWS.has(viewRef.current)) return

      // 비
      const state = gardenRef.current
      let rainingNow = rainLeftRef.current > 0
      if (rainingNow) {
        rainLeftRef.current = Math.max(0, rainLeftRef.current - dt)
        if (rainLeftRef.current === 0) {
          rainingNow = false
          setRaining(false)
          nextRainAtRef.current = state.clockMs + randomBetween(GARDEN.RAIN_EVERY_MIN_MS, GARDEN.RAIN_EVERY_MAX_MS)
        }
      } else if (state.clockMs >= nextRainAtRef.current) {
        rainLeftRef.current = GARDEN.RAIN_MS
        rainingNow = true
        setRaining(true)
      }

      const { state: next, ripened } = advanceGarden(state, dt, rainingNow)
      // 다 자란 작물(변이 확정)이 생겼을 때만 저장한다. 시계만 흐른 건 다음 행동 때 같이 저장
      setGarden(next, ripened.length > 0)
      if (ripened.length > 0 && viewRef.current === 'garden') playSFX('item')

      if (viewRef.current !== 'garden') return

      const crow = activeCrowRef.current
      if (crow) {
        const leftMs = crow.leftMs - dt
        if (leftMs <= 0) {
          commitCrow(null)
          const plot = gardenRef.current.plots[crow.plotIndex]
          const label = plot?.crop ? CROP_BY_ID[plot.crop.cropId].label : '작물'
          setGarden(applyCrowPeck(gardenRef.current, crow.plotIndex))
          playSFX('incorrect')
          showNotice(`🐦 까마귀가 ${withJosa(label, '을/를')} 콕! 다시 자라야 해요`, 'bad')
        } else {
          commitCrow({ ...crow, leftMs })
        }
        return
      }
      if (incomingRef.current.length > 0) {
        landNextCrow()
        return
      }

      // 밭 화면 남은 시간 (까마귀가 있는 동안은 멈춘다)
      visitLeftRef.current = Math.max(0, visitLeftRef.current - dt)
      setVisitLeftMs(visitLeftRef.current)
      if (visitLeftRef.current === 0) leaveGarden()
    }, TICK_MS)
    return () => window.clearInterval(timer)
  }, [commitCrow, landNextCrow, leaveGarden, playSFX, setGarden, showNotice])

  // ─── 친구가 보낸 까마귀 받기 ───
  useEffect(() => {
    return subscribeRoomRuntimeEvent((event) => {
      if (event.type !== 'garden:crow') return
      const payload = event.payload as Partial<CrowEventPayload> | undefined
      if (!payload?.crowId || !playerId || payload.targetId !== playerId) return
      if (seenCrowIdsRef.current.has(payload.crowId)) return
      seenCrowIdsRef.current.add(payload.crowId)
      const crow = { crowId: payload.crowId, fromName: payload.fromName || '친구' }
      const next = [...incomingRef.current, crow]
      incomingRef.current = next
      setIncomingCrows(next)
    })
  }, [playerId])

  // ─── 정답 제출 ───
  const otherPlayers = players.filter((player) => player.id !== playerId && !player.is_kicked)
  const canSendCrow = otherPlayers.length > 0

  const handleAnswerSubmit = async (answer: string) => {
    const correct = await checkAnswer(answer)
    if (!correct) {
      playSFX('incorrect')
      handleWrongAnswer()
      return false
    }
    playSFX('correct')
    setRewardCards(drawRewardCards(canSendCrow))
    return true
  }

  /** 정답 화면 → 카드 고르기 */
  const openReward = useCallback(() => {
    if (viewRef.current !== 'quiz') return
    pickingRef.current = false
    setChoosingCrowTarget(false)
    setCurrentView('reward')
  }, [setCurrentView])

  const enterGarden = useCallback(() => {
    leavingRef.current = false
    visitLeftRef.current = GARDEN.VISIT_MS
    setVisitLeftMs(GARDEN.VISIT_MS)
    setCurrentView('garden')
  }, [setCurrentView])

  const pickCard = useCallback((index: number) => {
    const card = rewardCards?.[index]
    if (!card || pickingRef.current) return
    if (card.kind === 'crow') {
      setChoosingCrowTarget(true)
      return
    }
    pickingRef.current = true
    setGarden(claimRewardCard(gardenRef.current, card, restockShop()))
    setSelectedSeed(card.cropId)
    playSFX('item')
    enterGarden()
  }, [enterGarden, playSFX, rewardCards, setGarden])

  const cancelCrowTarget = useCallback(() => setChoosingCrowTarget(false), [])

  const sendCrow = useCallback((targetId: string) => {
    if (pickingRef.current || !playerId) return
    const target = otherPlayers.find((player) => player.id === targetId)
    if (!target) return
    pickingRef.current = true
    const payload: CrowEventPayload = {
      targetId,
      fromId: playerId,
      fromName: currentPlayer?.nickname || '친구',
      crowId: `${playerId}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    }
    void sendRoomEvent('garden:crow', payload)
    setGarden(claimRewardCard(gardenRef.current, { kind: 'crow' }, restockShop()))
    setChoosingCrowTarget(false)
    playSFX('item')
    showNotice(`🐦 ${target.nickname}의 밭으로 까마귀가 날아갔어요!`, 'info')
    enterGarden()
  }, [currentPlayer?.nickname, enterGarden, otherPlayers, playSFX, playerId, sendRoomEvent, setGarden, showNotice])

  // ─── 밭 조작 ───
  const pushFloats = useCallback((harvests: HarvestResult[]) => {
    if (harvests.length === 0) return
    const stamped = harvests.map((harvest) => {
      noticeIdRef.current += 1
      return { ...harvest, id: noticeIdRef.current }
    })
    setFloats((current) => [...current, ...stamped])
    const ids = new Set(stamped.map((item) => item.id))
    window.setTimeout(() => setFloats((current) => current.filter((item) => !ids.has(item.id))), 1300)
  }, [])

  const tapPlot = useCallback((plotIndex: number) => {
    if (!runningRef.current || viewRef.current !== 'garden') return
    const state = gardenRef.current
    const plot = state.plots[plotIndex]
    if (!plot?.unlocked) return
    if (isRipe(plot, state.clockMs)) {
      const result = harvestPlot(state, plotIndex)
      if (!result) return
      setGarden(result.state)
      pushFloats([result.harvest])
      playSFX(result.harvest.mutation === 'none' ? 'click' : 'item')
      return
    }
    if (plot.crop) return
    const seed = selectedSeed && (state.seeds[selectedSeed] ?? 0) > 0
      ? selectedSeed
      : (Object.keys(state.seeds)[0] as CropId | undefined)
    if (!seed) {
      showNotice('씨앗이 없어요. 가게에서 사거나 문제를 맞혀요!', 'info')
      return
    }
    const next = plantSeed(state, plotIndex, seed)
    if (!next) return
    setGarden(next)
    if ((next.seeds[seed] ?? 0) === 0) setSelectedSeed((Object.keys(next.seeds)[0] as CropId | undefined) ?? null)
    else setSelectedSeed(seed)
    playSFX('click')
  }, [playSFX, pushFloats, selectedSeed, setGarden, showNotice])

  const harvestEverything = useCallback(() => {
    if (!runningRef.current || viewRef.current !== 'garden') return
    const { state, harvests } = harvestAll(gardenRef.current)
    if (harvests.length === 0) return
    setGarden(state)
    pushFloats(harvests)
    playSFX(harvests.some((item) => item.mutation !== 'none') ? 'item' : 'correct')
  }, [playSFX, pushFloats, setGarden])

  const tapCrow = useCallback(() => {
    const crow = activeCrowRef.current
    if (!crow || !runningRef.current) return
    const tapsLeft = crow.tapsLeft - 1
    if (tapsLeft > 0) {
      commitCrow({ ...crow, tapsLeft })
      playSFX('click')
      return
    }
    commitCrow(null)
    setGarden(recordCrowShooed(gardenRef.current, false))
    playSFX('correct')
    showNotice(`🎉 ${crow.fromName}의 까마귀를 쫓았어요!`, 'good')
  }, [commitCrow, playSFX, setGarden, showNotice])

  const runPurchase = useCallback((next: GardenState | null, okText: string) => {
    if (!next) {
      playSFX('incorrect')
      return false
    }
    setGarden(next)
    playSFX('click')
    showNotice(okText, 'good')
    return true
  }, [playSFX, setGarden, showNotice])

  const purchaseSeed = useCallback((cropId: CropId) => {
    const ok = runPurchase(buySeed(gardenRef.current, cropId), `${CROP_BY_ID[cropId].label} 씨앗을 샀어요`)
    if (ok) setSelectedSeed(cropId)
  }, [runPurchase])
  const purchaseExpansion = useCallback(() => { runPurchase(buyExpansion(gardenRef.current), '밭이 한 칸 넓어졌어요!') }, [runPurchase])
  const purchaseSprinkler = useCallback(() => { runPurchase(buySprinkler(gardenRef.current), '스프링클러로 더 빨리 자라요!') }, [runPurchase])
  const purchaseScarecrow = useCallback(() => { runPurchase(buyScarecrow(gardenRef.current), '허수아비가 까마귀를 막아 줘요') }, [runPurchase])

  return {
    garden,
    raining,
    rewardCards,
    choosingCrowTarget,
    otherPlayers,
    visitLeftMs,
    selectedSeed,
    activeCrow,
    incomingCrows,
    notice,
    floats,
    handleAnswerSubmit,
    openReward,
    pickCard,
    cancelCrowTarget,
    sendCrow,
    leaveGarden,
    tapPlot,
    harvestEverything,
    tapCrow,
    setSelectedSeed,
    purchaseSeed,
    purchaseExpansion,
    purchaseSprinkler,
    purchaseScarecrow,
  }
}
