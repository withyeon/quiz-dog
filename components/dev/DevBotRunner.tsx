'use client'

/**
 * /dev "봇 친구" 실행기. 사람이 게임을 하는 탭 안에서 봇마다 "문제 풀기"를 흉내 낸다.
 *
 * 한 바퀴: (모드별 주기 × 난이도 속도)만큼 기다림 → 난이도 정답률로 맞힘/틀림 결정 →
 *          모드별 보상·벌점을 봇 행에 반영(lib/dev/devBotModes.ts) → answer_history 에 한 줄 추가.
 * - 점수 같은 숫자는 원자 증분 RPC(apply_player_delta)로 바꾼다. 사람이 봇을 공격·강탈해도 덮어쓰지 않게.
 * - 바꾼 값은 이 탭의 런타임 이벤트(player:patch)로 바로 알린다. 다른 탭·선생님 화면은 DB 변경 구독과
 *   3초 재동기화로 따라온다(hooks/usePlayersRealtime.ts).
 * - 방이 진행 중(playing)일 때만 움직이고, 멈춤(paused)이면 쉬고, 끝나면(finished) 그만둔다.
 *   그 판의 게임 화면(URL 의 room)을 벗어나면 실행기가 내려가며 멈춘다(DevBotRunnerGate).
 */

import { useEffect } from 'react'
import { emitRoomRuntimeEvent, type RoomEventType } from '@/lib/realtime/roomChannel'
import { DEV_BOT_DIFFICULTIES, readDevBotSession, type DevBot, type DevBotSession } from '@/lib/dev/devBots'
import { DEV_BOT_WARMUP_ANSWERS, getDevBotModeStrategy, type DevBotContext } from '@/lib/dev/devBotModes'
import {
  applyPlayerDelta,
  pickDeltaFields,
  stealPlayerResource,
  swapPlayerColumns,
  type DeltaColumn,
  type PlayerDeltas,
  type PlayerMaxes,
} from '@/lib/services/playerMutations'
import { getRoomByCode } from '@/lib/services/rooms'
import { listPlayersInRoom, updatePlayer } from '@/lib/services/players'
import { listQuestionsForGame, type GameQuestion } from '@/lib/services/questions'
import type { Database } from '@/types/database.types'

type PlayerRow = Database['public']['Tables']['players']['Row']
type RoomRow = Database['public']['Tables']['rooms']['Row']
type AnswerRecord = { questionIndex: number; isCorrect: boolean; selectedAnswer?: string; responseTimeMs?: number }

const TICK_MS = 1000
/** 방 상태(진행·멈춤·끝)를 다시 읽는 간격 */
const ROOM_REFRESH_MS = 3000
/** 게임 시작 직후 사람은 카운트다운·시작 전 퀴즈를 하므로 봇도 조금 기다렸다가 시작한다 */
const FIRST_ACTION_DELAY_MS = 6000

type BotState = {
  bot: DevBot
  history: AnswerRecord[]
  nextAt: number
  busy: boolean
  /** 모드 동작이 쓰는 봇별 메모(연속 정답 등) */
  memory: Record<string, number>
}

function jitter(min = 0.7, max = 1.3): number {
  return min + Math.random() * (max - min)
}

let eventSeq = 0

function readFlag(key: string): boolean {
  try {
    return window.sessionStorage.getItem(key) === '1'
  } catch {
    return false
  }
}

function writeFlag(key: string): void {
  try {
    window.sessionStorage.setItem(key, '1')
  } catch {
    // 저장이 막히면 새로고침 때 직업·역할을 한 번 더 고를 뿐이다
  }
}

function startEngine(session: DevBotSession): () => void {
  let stopped = false
  // 시작 준비(직업·역할 고르기 포함)가 끝나기 전에는 움직이지 않는다. 직업 없는 눈싸움 봇이 공격하지 않게.
  let ready = false
  let room: RoomRow | null = null
  let questions: GameQuestion[] = []
  let lastRoomRefresh = 0
  const players = new Map<string, PlayerRow>()
  const strategy = getDevBotModeStrategy(session.gameMode)

  // 이 탭의 게임 화면에 봇이 보낸 것처럼 이벤트를 흘린다. 화면들은 event.playerId 로 보낸 사람을 가린다.
  const emitEvent = (type: RoomEventType, playerId: string, payload: Record<string, unknown>) => {
    emitRoomRuntimeEvent({
      type,
      roomCode: session.roomCode,
      clientId: 'dev-bot-runner',
      playerId,
      sentAt: new Date().toISOString(),
      seq: (eventSeq += 1),
      payload,
    })
  }

  const publishRow = (row: PlayerRow, columns: Array<keyof PlayerRow>) => {
    players.set(row.id, row)
    emitEvent('player:patch', row.id, { playerId: row.id, patch: pickDeltaFields(row, columns), reason: 'dev_bot' })
  }

  const ctxFor = (state: BotState): DevBotContext => ({
    bot: state.bot,
    roomCode: session.roomCode,
    memory: state.memory,
    room: () => room,
    self: () => players.get(state.bot.playerId) ?? null,
    players: () => [...players.values()],
    addDelta: async (deltas: PlayerDeltas, maxes: PlayerMaxes = {}) => {
      const row = await applyPlayerDelta(state.bot.playerId, deltas, maxes)
      publishRow(row, Object.keys(deltas) as Array<keyof PlayerRow>)
      return row
    },
    addDeltaTo: async (playerId: string, deltas: PlayerDeltas, maxes: PlayerMaxes = {}) => {
      const row = await applyPlayerDelta(playerId, deltas, maxes)
      publishRow(row, Object.keys(deltas) as Array<keyof PlayerRow>)
      return row
    },
    steal: async (victimId: string, amount: number, columns: DeltaColumn[]) => {
      const rows = await stealPlayerResource(victimId, state.bot.playerId, amount, columns)
      rows.forEach((row) => publishRow(row, columns as Array<keyof PlayerRow>))
    },
    swap: async (otherId: string, columns: DeltaColumn[]) => {
      const rows = await swapPlayerColumns(state.bot.playerId, otherId, columns)
      rows.forEach((row) => publishRow(row, columns as Array<keyof PlayerRow>))
    },
    setFields: async (patch: Record<string, unknown>) => {
      await updatePlayer(state.bot.playerId, patch)
      const current = players.get(state.bot.playerId)
      if (current) players.set(current.id, { ...current, ...patch } as PlayerRow)
      emitEvent('player:patch', state.bot.playerId, { playerId: state.bot.playerId, patch, reason: 'dev_bot' })
    },
    publishRows: (rows: PlayerRow[], columns: Array<keyof PlayerRow>) => {
      rows.forEach((row) => publishRow(row, columns))
    },
    emit: (type: RoomEventType, payload: Record<string, unknown>) => emitEvent(type, state.bot.playerId, payload),
  })

  const states: BotState[] = session.bots.map((bot) => ({
    bot,
    history: [],
    nextAt: Date.now() + FIRST_ACTION_DELAY_MS * jitter(0.6, 1.4),
    busy: false,
    memory: {},
  }))

  const act = async (state: BotState) => {
    const profile = DEV_BOT_DIFFICULTIES[state.bot.difficulty]
    // 처음 몇 문제는 시작 전 퀴즈다. 보상·공격 없이 답만 하고, 미니게임이 없으니 빨리 넘어간다.
    const warmingUp = state.history.length < DEV_BOT_WARMUP_ANSWERS
    const cycleMs = (warmingUp ? Math.min(strategy.cycleSeconds, 6) : strategy.cycleSeconds) * 1000 * profile.pace
    state.busy = true
    try {
      const correct = Math.random() < profile.accuracy
      const questionIndex = questions.length > 0 ? Math.floor(Math.random() * questions.length) : 0
      const options = questions[questionIndex]?.options ?? []
      // 문제를 푸는 데 걸린 시간(눈싸움 빠른 답 보너스·인형뽑기 속도 등급에 쓰인다). 잘하는 봇일수록 빠르다.
      const answerTimeMs = Math.round(Math.min(cycleMs, 12000) * jitter(0.3, 0.8))
      if (!warmingUp) await strategy.onAnswer(ctxFor(state), correct, answerTimeMs)
      state.history = [...state.history, {
        questionIndex,
        isCorrect: correct,
        // 봇은 정답을 모른다(학생 화면엔 정답이 없다). 결과·리포트에서 봇 답인 걸 알아보게만 적는다.
        selectedAnswer: correct
          ? '(봇 정답)'
          : options.length > 0 ? options[Math.floor(Math.random() * options.length)] : '(봇 오답)',
        responseTimeMs: answerTimeMs,
      }]
      await updatePlayer(state.bot.playerId, { answer_history: state.history })
      // 다른 봇이 공격 대상을 고를 때(시작 전 퀴즈를 마쳤는지) 이 값을 본다
      const current = players.get(state.bot.playerId)
      if (current) players.set(current.id, { ...current, answer_history: state.history as unknown as PlayerRow['answer_history'] })
    } catch (error) {
      console.warn(`[봇] ${state.bot.nickname} 움직임 실패`, error)
    } finally {
      state.nextAt = Date.now() + cycleMs * jitter()
      state.busy = false
    }
  }

  const refreshRoom = async () => {
    lastRoomRefresh = Date.now()
    room = await getRoomByCode(session.roomCode)
    if (!room || room.status === 'finished' || room.status === 'ended') stopped = true
  }

  const tick = async () => {
    if (stopped) return
    if (Date.now() - lastRoomRefresh >= ROOM_REFRESH_MS) {
      try {
        await refreshRoom()
      } catch {
        return
      }
    }
    if (stopped || !ready || room?.status !== 'playing') return
    const now = Date.now()
    for (const state of states) {
      if (!state.busy && now >= state.nextAt) void act(state)
    }
  }

  // 시작: 방·문제·봇 행을 한 번 읽어 둔다(answer_history 는 이어서 쌓는다)
  void (async () => {
    try {
      await refreshRoom()
      // refreshRoom 이 room 을 채운다(클로저 대입이라 타입 좁히기가 못 따라온다)
      const setId = (room as RoomRow | null)?.set_id
      if (setId) questions = await listQuestionsForGame(setId)
      for (const row of await listPlayersInRoom(session.roomCode)) players.set(row.id, row)
      for (const state of states) {
        const saved = players.get(state.bot.playerId)?.answer_history
        state.history = Array.isArray(saved) ? (saved as unknown as AnswerRecord[]) : []
      }
      // 직업·역할처럼 사람이 게임 화면에서 고르는 값. 새로고침해 다시 띄울 때 또 바꾸지 않게 한 탭에서 한 번만 한다.
      const startedKey = `quizdog:devBotStarted:${session.roomCode}`
      if (strategy.onStart && !readFlag(startedKey)) {
        writeFlag(startedKey)
        await Promise.all(states.map((state) => strategy.onStart!(ctxFor(state))))
      }
    } catch (error) {
      console.warn('[봇] 시작 준비 실패', error)
    } finally {
      ready = true
    }
  })()

  // 사람 쪽 행(다른 플레이어)도 가끔 다시 읽는다. 공격 대상 고르기 등 모드 동작이 쓴다.
  const playersTimer = window.setInterval(() => {
    void listPlayersInRoom(session.roomCode)
      .then((rows) => rows.forEach((row) => players.set(row.id, row)))
      .catch(() => {})
  }, 5000)
  const timer = window.setInterval(() => void tick(), TICK_MS)

  return () => {
    stopped = true
    window.clearInterval(timer)
    window.clearInterval(playersTimer)
  }
}

export default function DevBotRunner() {
  useEffect(() => {
    const session = readDevBotSession()
    if (!session) return
    // 그 판의 게임 화면에서만 움직인다(결과 화면·다른 방으로 가면 멈춘다)
    const room = new URLSearchParams(window.location.search).get('room')
    if (room !== session.roomCode) return
    return startEngine(session)
  }, [])

  return null
}
