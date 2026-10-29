'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import {
  ITEM_INFO,
  QUIZPANG,
  addToInventory,
  applyItem,
  chainCheer,
  createQuizpangState,
  drawItemCards,
  findAnyMove,
  isQuizDue,
  parseQuizpangSave,
  scheduleNextQuiz,
  tickQuizpang,
  toQuizpangSave,
  type Cell,
  type ItemCard,
  type ItemId,
  type LineDir,
  type QuizpangState,
  type Step,
} from '@/lib/game/quizpang'
import type { SFXType } from '@/hooks/useAudio'
import { withJosa } from '@/lib/utils/korean'
import type { Database } from '@/types/database.types'

type Player = Database['public']['Tables']['players']['Row']

/** main = 30초마다 뜨는 문제(정답이면 카드), bonus = 틀린 뒤 추가 문제(보상 없음) */
export type QuizpangQuizReason = 'main' | 'bonus'
export type QuizpangNotice = { id: number; text: string; tone: 'good' | 'bad' | 'info' }
/** burst = 콤보 배너 (폭발 그림 위에 글자) */
export type QuizpangBanner = { id: number; text: string; big?: boolean; burst?: boolean }
export type Targeting = { item: 'bomb' | 'line'; index: number; dir: LineDir }

/** 보드(캔버스)가 훅에 알려 주는 일 */
export type BoardEvent =
  | { type: 'clear'; chain: number; score: number; count: number; specials: number; triggered: number; source: 'match' | 'bomb' | 'line' }
  | { type: 'invalid' }
  | { type: 'shuffle' }
  | { type: 'done'; score: number }

/** 보드 컴포넌트가 노출하는 조작 핸들 */
export type BoardHandle = {
  /** 아이템 등 훅이 만든 단계 목록을 재생한다 */
  play: (steps: Step[]) => void
}

export type QuizpangHud = {
  score: number
  playMs: number
  /** 다음 문제까지 남은 퍼즐 시간(ms) */
  quizInMs: number
  doubleMsLeft: number
  inventory: ItemId[]
  cleared: number
  maxChain: number
  correct: number
  questions: number
}

interface UseQuizpangGameParams {
  playerId: string | null
  currentPlayer: Player | null | undefined
  currentView: string
  setCurrentView: (view: string) => void
  checkAnswer: (answer: string) => Promise<boolean>
  goToNextQuestion: () => void
  playSFX: (sound: SFXType) => void
  /** 내 행 로컬 반영 + player:patch broadcast + DB 쓰기 (useGameBase.commitPlayerPatch) */
  commitPlayerPatch: (playerId: string, patch: Record<string, unknown>, reason?: string) => Promise<void>
  /** 오답 화면 시간(ms). 구성치기 문제집은 해설을 읽도록 더 길다 (getWrongScreenMs) */
  wrongScreenMs: number
  /** 방이 진행 중이고 선생님이 멈추지 않았는지 */
  isRoomRunning: boolean
  /** 이번 판 보드 시드 (같은 방 = 같은 보드). null 이면 아직 모른다 */
  boardSeed: number | null
}

const HUD_MS = 150
const TICK_MS = 100

function readHud(state: QuizpangState): QuizpangHud {
  return {
    score: state.score,
    playMs: Math.floor(state.playMs / 1000) * 1000,
    quizInMs: Math.max(0, Math.ceil((state.quizDueMs - state.playMs) / 1000) * 1000),
    doubleMsLeft: Math.ceil(state.doubleMsLeft / 100) * 100,
    inventory: [...state.inventory],
    cleared: state.stats.cleared,
    maxChain: state.stats.maxChain,
    correct: state.stats.correct,
    questions: state.stats.questions,
  }
}
const sameHud = (a: QuizpangHud, b: QuizpangHud) => JSON.stringify(a) === JSON.stringify(b)

/**
 * 퀴즈팡팡 게임 흐름 훅.
 *
 * 화면(view): 'puzzle'(퍼즐) → 퍼즐 시간이 QUESTION_INTERVAL_MS 쌓이고 콤보가 끝나면 'quiz'(내 화면만 멈추고 문제) →
 *   정답이면 'pick'(아이템 카드 3장) → 'puzzle'.
 *   오답이면 정답을 보여 준 뒤 추가 문제('quiz' 그대로, reason=bonus) → 맞든 틀리든 'puzzle' (아이템 없음).
 * 보드 상태는 stateRef 하나에 있고 캔버스(QuizpangBoard)가 스왑·콤보를 계산하고 그린다.
 * 저장: players.score = 점수, players.item_effects = QuizpangSave (2초 모아서).
 */
export function useQuizpangGame({
  playerId,
  currentPlayer,
  currentView,
  setCurrentView,
  checkAnswer,
  goToNextQuestion,
  playSFX,
  commitPlayerPatch,
  wrongScreenMs,
  isRoomRunning,
  boardSeed,
}: UseQuizpangGameParams) {
  const stateRef = useRef<QuizpangState | null>(null)
  const boardRef = useRef<BoardHandle | null>(null)
  const [ready, setReady] = useState(false)
  const [hud, setHud] = useState<QuizpangHud | null>(null)
  const [quizReason, setQuizReason] = useState<QuizpangQuizReason>('main')
  const [cards, setCards] = useState<ItemCard[] | null>(null)
  const [notice, setNotice] = useState<QuizpangNotice | null>(null)
  const [banner, setBanner] = useState<QuizpangBanner | null>(null)
  const [targeting, setTargeting] = useState<Targeting | null>(null)

  const viewRef = useRef(currentView)
  const runningRef = useRef(isRoomRunning)
  const quizReasonRef = useRef<QuizpangQuizReason>('main')
  const answeringRef = useRef(false)
  const pickingRef = useRef(false)
  const busyRef = useRef(false)
  const targetingRef = useRef<Targeting | null>(null)
  const noticeIdRef = useRef(0)
  const timersRef = useRef<number[]>([])
  const lastSavedRef = useRef('')
  const lastTickRef = useRef<number | null>(null)

  useEffect(() => { viewRef.current = currentView }, [currentView])
  useEffect(() => { runningRef.current = isRoomRunning }, [isRoomRunning])
  useEffect(() => { targetingRef.current = targeting }, [targeting])

  const later = useCallback((fn: () => void, ms: number) => {
    const id = window.setTimeout(() => {
      timersRef.current = timersRef.current.filter((item) => item !== id)
      fn()
    }, ms)
    timersRef.current.push(id)
  }, [])
  useEffect(() => () => timersRef.current.forEach((id) => window.clearTimeout(id)), [])

  const showNotice = useCallback((text: string, tone: QuizpangNotice['tone'] = 'info') => {
    noticeIdRef.current += 1
    setNotice({ id: noticeIdRef.current, text, tone })
  }, [])
  useEffect(() => {
    if (!notice) return
    const timer = window.setTimeout(() => setNotice((current) => (current?.id === notice.id ? null : current)), 2400)
    return () => window.clearTimeout(timer)
  }, [notice])

  const showBanner = useCallback((text: string, big = false, burst = false) => {
    noticeIdRef.current += 1
    const id = noticeIdRef.current
    setBanner({ id, text, big, burst })
    window.setTimeout(() => setBanner((current) => (current?.id === id ? null : current)), big ? 1600 : 1100)
  }, [])

  // ─── 보드 만들기 (시드 + 저장값) — 플레이어당 한 번 ───
  // currentPlayer 는 DB 갱신마다 새 객체가 되므로 매번 복원하면 방금 한 일이 옛 값으로 되돌아간다.
  const builtForRef = useRef<string | null>(null)
  useEffect(() => {
    if (boardSeed === null || !currentPlayer) return
    const buildKey = `${currentPlayer.id}:${boardSeed}`
    if (builtForRef.current === buildKey) return
    builtForRef.current = buildKey
    const save = parseQuizpangSave(currentPlayer.item_effects)
    stateRef.current = createQuizpangState(boardSeed, save)
    if (process.env.NODE_ENV !== 'production') {
      // 검수 드라이버용 (개발 빌드에서만): 상태와 가능한 수 하나
      const w = window as unknown as { __quizpang?: unknown; __quizpangHint?: () => unknown }
      w.__quizpang = stateRef.current
      w.__quizpangHint = () => (stateRef.current ? findAnyMove(stateRef.current.board) : null)
    }
    lastTickRef.current = null
    setHud(readHud(stateRef.current))
    setReady(true)
  }, [boardSeed, currentPlayer])

  // ─── 저장 ───
  const flushSave = useCallback(() => {
    const state = stateRef.current
    if (!playerId || !state) return
    const save = toQuizpangSave(state)
    const signature = `${save.score}|${save.inventory.join(',')}|${save.stats.cleared}|${save.stats.questions}|${Math.floor(save.playMs / 5000)}`
    if (signature === lastSavedRef.current) return
    lastSavedRef.current = signature
    void commitPlayerPatch(playerId, { score: save.score, item_effects: save }, 'quizpang_update').catch((error) => {
      console.error('Error saving quizpang:', error)
    })
  }, [commitPlayerPatch, playerId])
  const flushSaveRef = useRef(flushSave)
  useEffect(() => { flushSaveRef.current = flushSave }, [flushSave])

  useEffect(() => {
    const timer = window.setInterval(() => flushSaveRef.current(), QUIZPANG.SAVE_INTERVAL_MS)
    const onHide = () => flushSaveRef.current()
    window.addEventListener('pagehide', onHide)
    return () => {
      window.clearInterval(timer)
      window.removeEventListener('pagehide', onHide)
      flushSaveRef.current()
    }
  }, [])

  // ─── 숫자판 ───
  useEffect(() => {
    const timer = window.setInterval(() => {
      const state = stateRef.current
      if (!state) return
      const next = readHud(state)
      setHud((current) => (current && sameHud(current, next) ? current : next))
    }, HUD_MS)
    return () => window.clearInterval(timer)
  }, [])

  // ─── 문제 열기·닫기 ───
  const openQuiz = useCallback((reason: QuizpangQuizReason) => {
    if (viewRef.current !== 'puzzle') return
    quizReasonRef.current = reason
    setQuizReason(reason)
    answeringRef.current = false
    setTargeting(null)
    viewRef.current = 'quiz'
    setCurrentView('quiz')
  }, [setCurrentView])

  const resumePuzzle = useCallback(() => {
    const state = stateRef.current
    if (state) scheduleNextQuiz(state)
    answeringRef.current = false
    goToNextQuestion()
    viewRef.current = 'puzzle'
    setCurrentView('puzzle')
    lastTickRef.current = null
  }, [goToNextQuestion, setCurrentView])

  // ─── 퍼즐 시계: 퍼즐 화면에서, 방이 돌아갈 때만 흐른다. 문제가 때가 됐고 콤보가 끝나 있으면 연다 ───
  useEffect(() => {
    if (currentView !== 'puzzle' || !isRoomRunning || !ready) {
      lastTickRef.current = null
      return
    }
    const timer = window.setInterval(() => {
      const state = stateRef.current
      if (!state) return
      const now = performance.now()
      const dt = lastTickRef.current === null ? 0 : Math.min(250, now - lastTickRef.current)
      lastTickRef.current = now
      const wasDouble = state.doubleMsLeft > 0
      tickQuizpang(state, dt)
      if (wasDouble && state.doubleMsLeft <= 0) showNotice('🍖 2배 간식 시간이 끝났어요', 'info')
      if (isQuizDue(state) && !busyRef.current && !targetingRef.current) openQuiz('main')
    }, TICK_MS)
    return () => window.clearInterval(timer)
  }, [currentView, isRoomRunning, openQuiz, ready, showNotice])

  // ─── 보드가 알려 주는 일 ───
  const handleBoardEvents = useCallback((events: BoardEvent[]) => {
    for (const event of events) {
      switch (event.type) {
        case 'clear': {
          playSFX(event.chain >= 3 || event.specials > 0 || event.triggered > 0 ? 'item' : 'click')
          const cheer = chainCheer(event.chain)
          if (cheer) showBanner(cheer, event.chain >= 4, true)
          else if (event.triggered > 0) showBanner(event.triggered > 1 ? '연속 펑! 💥💥' : '펑! 💥')
          else if (event.specials > 0) showBanner('✨ 스페셜 강아지 탄생!')
          else if (event.count >= 6) showBanner('와, 한꺼번에!')
          break
        }
        case 'invalid':
          playSFX('click')
          break
        case 'shuffle':
          showNotice('🌀 맞출 수 있는 짝이 없어서 보드를 섞었어요', 'info')
          break
        case 'done':
          busyRef.current = false
          break
        default:
          break
      }
    }
  }, [playSFX, showBanner, showNotice])

  const handleBusyChange = useCallback((busy: boolean) => {
    busyRef.current = busy
  }, [])

  // ─── 정답 제출 ───
  const handleAnswerSubmit = async (answer: string) => {
    if (answeringRef.current) return false
    answeringRef.current = true
    const reason = quizReasonRef.current
    const correct = await checkAnswer(answer)
    const state = stateRef.current
    if (state) {
      state.stats.questions += 1
      if (correct) state.stats.correct += 1
    }

    if (reason === 'bonus') {
      // 추가 문제: 맞든 틀리든 퍼즐로 (아이템 없음). 틀렸을 때만 정답을 보여 준다.
      playSFX(correct ? 'correct' : 'incorrect')
      later(() => {
        flushSaveRef.current()
        resumePuzzle()
      }, correct ? QUIZPANG.CORRECT_SHOW_MS : wrongScreenMs)
      return correct
    }

    if (correct) {
      playSFX('correct')
      setCards(drawItemCards(QUIZPANG.CHOICES))
      pickingRef.current = false
      later(() => {
        if (viewRef.current === 'quiz') {
          viewRef.current = 'pick'
          setCurrentView('pick')
        }
      }, QUIZPANG.CORRECT_SHOW_MS)
      return true
    }

    playSFX('incorrect')
    // 틀리면 정답을 보여 준 뒤 추가 문제 1개
    later(() => {
      quizReasonRef.current = 'bonus'
      setQuizReason('bonus')
      answeringRef.current = false
      goToNextQuestion()
    }, wrongScreenMs)
    return false
  }

  /** 정답 화면에서 바로 넘어가기 (QuizView 의 '정답입니다 →' 버튼) */
  const skipCorrectBanner = useCallback(() => {
    if (viewRef.current !== 'quiz') return
    if (quizReasonRef.current === 'main') {
      viewRef.current = 'pick'
      setCurrentView('pick')
    }
  }, [setCurrentView])

  const pickCard = useCallback((index: number) => {
    const card = cards?.[index]
    const state = stateRef.current
    if (!card || !state || pickingRef.current) return
    pickingRef.current = true
    const dropped = addToInventory(state, card.item)
    playSFX('item')
    if (dropped) showNotice(`보관함이 가득 차서 ${withJosa(ITEM_INFO[dropped].label, '을/를')} 내보냈어요`, 'info')
    else showNotice(`${ITEM_INFO[card.item].emoji} ${withJosa(ITEM_INFO[card.item].label, '을/를')} 보관함에 넣었어요`, 'good')
    setCards(null)
    flushSaveRef.current()
    resumePuzzle()
  }, [cards, playSFX, resumePuzzle, showNotice])

  // ─── 아이템 ───
  const playSteps = useCallback((steps: Step[]) => {
    if (steps.length === 0) return
    busyRef.current = true
    boardRef.current?.play(steps)
  }, [])

  /** 보관함 n번째 아이템 쓰기. 폭탄·줄 삭제는 자리를 고르는 상태로 들어간다 */
  const useItem = useCallback((index: number) => {
    const state = stateRef.current
    if (!state || viewRef.current !== 'puzzle' || !runningRef.current || busyRef.current) return
    const item = state.inventory[index]
    if (!item) return
    if (targetingRef.current?.index === index) {
      setTargeting(null)
      return
    }
    if (item === 'bomb' || item === 'line') {
      setTargeting({ item, index, dir: 'row' })
      playSFX('click')
      return
    }
    state.inventory.splice(index, 1)
    const result = applyItem(state, item)
    playSFX('item')
    if (item === 'double') showBanner('🍖 점수 2배 간식 시간!', true)
    else showBanner('🌀 빙글빙글!')
    flushSaveRef.current()
    playSteps(result.steps)
  }, [playSFX, playSteps, showBanner])

  const cancelTargeting = useCallback(() => setTargeting(null), [])
  const setLineDir = useCallback((dir: LineDir) => {
    setTargeting((current) => (current ? { ...current, dir } : current))
  }, [])

  /** 보드에서 자리를 골랐다 (폭탄·줄 삭제). dirHint = 끌어서 고른 방향 */
  const handleBoardTarget = useCallback((cell: Cell, dirHint?: LineDir) => {
    const state = stateRef.current
    const target = targetingRef.current
    if (!state || !target || busyRef.current) return
    const item = state.inventory[target.index]
    if (item !== target.item) {
      setTargeting(null)
      return
    }
    state.inventory.splice(target.index, 1)
    setTargeting(null)
    const dir = dirHint ?? target.dir
    const result = applyItem(state, item, { cell, dir })
    playSFX('item')
    showBanner(item === 'bomb' ? '💣 멍멍 폭탄!' : dir === 'row' ? '🦴 가로 한 줄 싹!' : '🦴 세로 한 줄 싹!')
    flushSaveRef.current()
    playSteps(result.steps)
  }, [playSFX, playSteps, showBanner])

  return {
    stateRef,
    boardRef,
    ready,
    hud,
    quizReason,
    cards,
    notice,
    banner,
    targeting,
    handleBoardEvents,
    handleBusyChange,
    handleBoardTarget,
    handleAnswerSubmit,
    skipCorrectBanner,
    pickCard,
    useItem,
    cancelTargeting,
    setLineDir,
  }
}

