'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import {
  SKILLS,
  SURVIVOR,
  applySkillCard,
  createSurvivorState,
  drawSkillCards,
  parseSurvivorSave,
  reviveSurvivor,
  toSurvivorSave,
  type SkillCard,
  type SkillId,
  type StepEvent,
  type SurvivorState,
} from '@/lib/game/survivor'
import type { SFXType } from '@/hooks/useAudio'
import type { Database } from '@/types/database.types'

type Player = Database['public']['Tables']['players']['Row']

export type SurvivorQuizReason = 'levelup' | 'revive'
export type SurvivorNotice = { id: number; text: string; tone: 'good' | 'bad' | 'info' }

/** 화면 위 숫자판 (전투 상태를 200ms 마다 읽어 온다) */
export type SurvivorHud = {
  hp: number
  maxHp: number
  level: number
  xp: number
  xpNeed: number
  score: number
  kills: number
  battleMs: number
  skills: Partial<Record<SkillId, number>>
  boss: { hp: number; maxHp: number } | null
}

interface UseSurvivorGameParams {
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
}

const HUD_MS = 200
/** DB 쓰기 간격 (Realtime 한도 — 실시간 공격 이벤트 메모 참고) */
const SAVE_INTERVAL_MS = 2000
/** 정답 배너를 보여 준 뒤 다음 화면으로 */
const CORRECT_SHOW_MS = 1100

function readHud(state: SurvivorState): SurvivorHud {
  const boss = state.enemies.find((enemy) => enemy.kind === 'boss')
  return {
    hp: Math.ceil(state.player.hp),
    maxHp: state.player.maxHp,
    level: state.level,
    xp: Math.floor(state.xp),
    xpNeed: state.xpNeed,
    score: state.score,
    kills: state.stats.kills,
    battleMs: Math.floor(state.battleMs / 1000) * 1000,
    skills: { ...state.skills },
    boss: boss ? { hp: Math.max(0, Math.ceil(boss.hp)), maxHp: boss.maxHp } : null,
  }
}

const sameHud = (a: SurvivorHud, b: SurvivorHud) => JSON.stringify(a) === JSON.stringify(b)

/**
 * 멍멍 서바이벌 게임 흐름 훅.
 *
 * 화면(view): 'battle'(전투) → 레벨업·쓰러짐이면 'quiz'(내 화면만 멈추고 문제) →
 *   레벨업 정답이면 'pick'(스킬 카드 3장) → 'battle'.
 *   레벨업 오답이면 오답 배너 뒤 카드 1장이 랜덤으로 붙고 'battle'.
 *   쓰러짐 정답이면 다시 일어나 'battle', 오답이면 다음 문제('quiz' 그대로).
 * 전투 상태는 stateRef 하나에 있고 캔버스(SurvivorArena)가 고정 스텝으로 바꾼다.
 * 저장: players.score = 점수, players.item_effects = SurvivorSave (2초 모아서).
 */
export function useSurvivorGame({
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
}: UseSurvivorGameParams) {
  const stateRef = useRef<SurvivorState>(createSurvivorState())
  const [hud, setHud] = useState<SurvivorHud>(() => readHud(stateRef.current))
  const [quizReason, setQuizReason] = useState<SurvivorQuizReason>('levelup')
  const [cards, setCards] = useState<SkillCard[] | null>(null)
  const [notice, setNotice] = useState<SurvivorNotice | null>(null)
  const [banner, setBanner] = useState<{ id: number; text: string } | null>(null)

  const viewRef = useRef(currentView)
  const quizReasonRef = useRef<SurvivorQuizReason>('levelup')
  const answeringRef = useRef(false)
  const pickingRef = useRef(false)
  const noticeIdRef = useRef(0)
  const timersRef = useRef<number[]>([])
  const lastSavedRef = useRef('')
  const lastKillSfxRef = useRef(0)

  useEffect(() => { viewRef.current = currentView }, [currentView])

  const later = useCallback((fn: () => void, ms: number) => {
    const id = window.setTimeout(() => {
      timersRef.current = timersRef.current.filter((item) => item !== id)
      fn()
    }, ms)
    timersRef.current.push(id)
  }, [])
  useEffect(() => () => timersRef.current.forEach((id) => window.clearTimeout(id)), [])

  const showNotice = useCallback((text: string, tone: SurvivorNotice['tone'] = 'info') => {
    noticeIdRef.current += 1
    setNotice({ id: noticeIdRef.current, text, tone })
  }, [])
  useEffect(() => {
    if (!notice) return
    const timer = window.setTimeout(() => setNotice((current) => (current?.id === notice.id ? null : current)), 2600)
    return () => window.clearTimeout(timer)
  }, [notice])

  const showBanner = useCallback((text: string) => {
    noticeIdRef.current += 1
    const id = noticeIdRef.current
    setBanner({ id, text })
    window.setTimeout(() => setBanner((current) => (current?.id === id ? null : current)), 2400)
  }, [])

  // ─── 저장 ───
  const flushSave = useCallback(() => {
    if (!playerId) return
    const save = toSurvivorSave(stateRef.current)
    const signature = `${save.score}|${save.level}|${Math.round(save.xp)}|${JSON.stringify(save.skills)}|${save.stats.kills}|${Math.floor(save.battleMs / 5000)}`
    if (signature === lastSavedRef.current) return
    lastSavedRef.current = signature
    void commitPlayerPatch(playerId, { score: save.score, item_effects: save }, 'survivor_update').catch((error) => {
      console.error('Error saving survivor:', error)
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

  // 저장된 판 이어 하기 (새로고침 방어) — 플레이어당 한 번만.
  // currentPlayer 는 DB 갱신마다 새 객체가 되므로 매번 복원하면 방금 한 일이 옛 값으로 되돌아간다.
  const restoredPlayerIdRef = useRef<string | null>(null)
  useEffect(() => {
    if (!currentPlayer || restoredPlayerIdRef.current === currentPlayer.id) return
    restoredPlayerIdRef.current = currentPlayer.id
    const save = parseSurvivorSave(currentPlayer.item_effects)
    if (!save) return
    stateRef.current = createSurvivorState(save)
    setHud(readHud(stateRef.current))
  }, [currentPlayer])

  // ─── 숫자판 ───
  useEffect(() => {
    const timer = window.setInterval(() => {
      const next = readHud(stateRef.current)
      setHud((current) => (sameHud(current, next) ? current : next))
    }, HUD_MS)
    return () => window.clearInterval(timer)
  }, [])

  // ─── 문제 열기 ───
  const openQuiz = useCallback((reason: SurvivorQuizReason) => {
    if (viewRef.current !== 'battle') return
    quizReasonRef.current = reason
    setQuizReason(reason)
    answeringRef.current = false
    viewRef.current = 'quiz'
    setCurrentView('quiz')
  }, [setCurrentView])

  const resumeBattle = useCallback(() => {
    // 레벨업이 한 번에 여러 개 쌓였으면(보물 상자 등) 바로 다음 문제
    const state = stateRef.current
    answeringRef.current = false
    goToNextQuestion()
    if (state.player.dead) {
      quizReasonRef.current = 'revive'
      setQuizReason('revive')
      return
    }
    if (state.pendingLevelUps > 0) {
      quizReasonRef.current = 'levelup'
      setQuizReason('levelup')
      return
    }
    viewRef.current = 'battle'
    setCurrentView('battle')
  }, [goToNextQuestion, setCurrentView])

  // 전투 중인데 레벨업·쓰러짐이 남아 있으면 문제를 연다 (이벤트를 놓쳐도 멈춰 있지 않게)
  useEffect(() => {
    if (currentView !== 'battle' || !isRoomRunning) return
    const timer = window.setInterval(() => {
      const state = stateRef.current
      if (state.player.dead) openQuiz('revive')
      else if (state.pendingLevelUps > 0) openQuiz('levelup')
    }, 300)
    return () => window.clearInterval(timer)
  }, [currentView, isRoomRunning, openQuiz])

  // ─── 캔버스가 알려 주는 일 ───
  const handleEvents = useCallback((events: StepEvent[]) => {
    for (const event of events) {
      switch (event.type) {
        case 'levelup':
          playSFX('item')
          openQuiz('levelup')
          break
        case 'chest':
          playSFX('item')
          showBanner('🎁 보물 상자! 문제를 맞히고 스킬을 하나 더 받아요')
          openQuiz('levelup')
          break
        case 'death':
          playSFX('incorrect')
          openQuiz('revive')
          break
        case 'boss':
          showBanner('👑 대왕 슬라임이 나타났어요!')
          break
        case 'bossDown':
          playSFX('correct')
          showBanner('🎉 대왕 슬라임을 물리쳤어요! 보물 상자를 주워요')
          break
        case 'ring':
          showBanner('⚠️ 몬스터 떼가 둘러쌌어요!')
          break
        case 'meat':
          playSFX('click')
          showNotice('🍖 냠냠! 체력을 회복했어요', 'good')
          break
        case 'kill': {
          const now = performance.now()
          if (now - lastKillSfxRef.current > 260) {
            lastKillSfxRef.current = now
            playSFX('click')
          }
          break
        }
        default:
          break
      }
    }
  }, [openQuiz, playSFX, showBanner, showNotice])

  // ─── 정답 제출 ───
  const handleAnswerSubmit = async (answer: string) => {
    if (answeringRef.current) return false
    answeringRef.current = true
    const reason = quizReasonRef.current
    const correct = await checkAnswer(answer)
    const state = stateRef.current

    if (reason === 'revive') {
      if (correct) {
        playSFX('correct')
        later(() => {
          reviveSurvivor(stateRef.current)
          showNotice('💪 다시 일어났어요! 잠깐 무적이에요', 'good')
          flushSaveRef.current()
          resumeBattle()
        }, CORRECT_SHOW_MS)
      } else {
        playSFX('incorrect')
        // 틀리면 정답을 보여 준 뒤 다음 문제로 (계속 'quiz')
        later(() => {
          answeringRef.current = false
          goToNextQuestion()
        }, wrongScreenMs)
      }
      return correct
    }

    if (correct) {
      playSFX('correct')
      setCards(drawSkillCards(state, SURVIVOR.CHOICES))
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
    const [gift] = drawSkillCards(state, 1)
    later(() => {
      applySkillCard(stateRef.current, gift)
      if (gift.skillId !== 'snack') {
        showNotice(`🎁 선물 카드: ${SKILLS[gift.skillId].label} Lv.${gift.level}`, 'info')
      }
      flushSaveRef.current()
      resumeBattle()
    }, wrongScreenMs)
    return false
  }

  /** 정답 화면에서 바로 넘어가기 (QuizView 의 '정답입니다 →' 버튼) */
  const skipCorrectBanner = useCallback(() => {
    if (quizReasonRef.current === 'levelup' && viewRef.current === 'quiz') {
      viewRef.current = 'pick'
      setCurrentView('pick')
    }
  }, [setCurrentView])

  const pickCard = useCallback((index: number) => {
    const card = cards?.[index]
    if (!card || pickingRef.current) return
    pickingRef.current = true
    applySkillCard(stateRef.current, card)
    playSFX('item')
    if (card.skillId === 'snack') showNotice('🍪 스킬을 다 모았어요! 체력 회복 +50점', 'good')
    setCards(null)
    flushSaveRef.current()
    resumeBattle()
  }, [cards, playSFX, resumeBattle, showNotice])

  return {
    stateRef,
    hud,
    quizReason,
    cards,
    notice,
    banner,
    handleEvents,
    handleAnswerSubmit,
    skipCorrectBanner,
    pickCard,
  }
}
