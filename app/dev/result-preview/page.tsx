'use client'

import { Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import TeacherEndSequence from '@/components/results/TeacherEndSequence'
import { isGameModeId, DEFAULT_GAME_MODE } from '@/lib/game/modes'
import type { AnalyticsQuestion } from '@/lib/services/questions'
import type { Player, Room } from '@/components/results/resultAnalytics'

/**
 * 게임 종료 화면(발표 → Top 3 시상대 → 다시 볼 문제) 미리보기.
 * 실제로는 게임을 끝까지 진행해야만 볼 수 있어서 디자인을 확인하기 어려웠다.
 *
 *   /dev/result-preview                 기본(3명)
 *   /dev/result-preview?players=2       참가자 수 바꾸기 (1~40, 관중석·단체 사진 확인용)
 *   /dev/result-preview?game=tower      게임 모드별 점수 표기 확인
 *   /dev/result-preview?stage=4         Top 3 시상대부터 바로 (0 발표대기 · 1~3 등수공개 · 4 시상대 · 5 다시볼문제 · 6 마무리)
 *
 * 프로덕션에서는 proxy.ts가 /dev/* 를 막는다.
 */

const NICKNAMES = [
  '멍멍이', '초코', '하늘이', '보리', '뭉치', '까미', '두부', '코코', '별이', '콩이',
  '해피', '구름', '단비', '마루', '토리', '라떼', '우유', '망고', '솜이', '몽이',
]
const CHARACTER_COUNT = 30
const JOIN_BASE = Date.UTC(2026, 8, 30, 0, 0, 0)

function buildPlayer(index: number, count: number): Player {
  const score = index < 3 ? 980 - index * 137 : 640 - index * 14
  const round = Math.floor(index / NICKNAMES.length)
  // 들어온 순서는 점수 순서와 다르게 섞는다 (관중석이 순위대로 서지 않는지 확인용)
  const joinOrder = (index * 7 + 3) % Math.max(count, 1)
  return {
    id: `preview-${index}`,
    room_code: '123456',
    nickname: NICKNAMES[index % NICKNAMES.length] + (round > 0 ? String(round + 1) : ''),
    score,
    gold: score,
    avatar: `/character/${(index % CHARACTER_COUNT) + 1}.svg`,
    is_online: true,
    created_at: new Date(JOIN_BASE + joinOrder * 1000).toISOString(),
    updated_at: new Date(JOIN_BASE).toISOString(),
    answer_history: [
      { questionIndex: 0, isCorrect: index !== 1, responseTimeMs: 3200 },
      { questionIndex: 1, isCorrect: index < 2, responseTimeMs: 5100 },
      { questionIndex: 2, isCorrect: index === 0, responseTimeMs: 4400 },
    ] as unknown as Player['answer_history'],
  } as Player
}

// 실제 문항과 같은 키(question_text·answer·options)를 써야 분석 함수가 깨지지 않는다
const QUESTIONS: AnalyticsQuestion[] = [
  { id: 'q1', type: 'multiple', question_text: '분수의 덧셈에서 분모가 다르면 먼저 무엇을 해야 할까요?', answer: '통분', options: ['통분', '약분', '반올림', '나눗셈'] },
  { id: 'q2', type: 'multiple', question_text: '광합성에 필요하지 않은 것은?', answer: '소금', options: ['빛', '물', '이산화탄소', '소금'] },
  { id: 'q3', type: 'multiple', question_text: '조선을 세운 인물은?', answer: '이성계', options: ['이성계', '왕건', '주몽', '박혁거세'] },
] as unknown as AnalyticsQuestion[]

function ResultPreview() {
  const params = useSearchParams()
  const rawMode = params.get('game')
  const gameMode = isGameModeId(rawMode) ? rawMode : DEFAULT_GAME_MODE
  const playerCount = Math.min(40, Math.max(1, Number.parseInt(params.get('players') ?? '3', 10) || 3))
  const stage = Math.min(6, Math.max(0, Number.parseInt(params.get('stage') ?? '0', 10) || 0)) as 0 | 1 | 2 | 3 | 4 | 5 | 6

  const room = {
    room_code: '123456',
    status: 'finished',
    current_q_index: QUESTIONS.length,
    game_mode: gameMode,
    set_id: 'preview-set',
    duration_seconds: 300,
    started_at: new Date().toISOString(),
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  } as Room

  return (
    <TeacherEndSequence
      key={`${gameMode}-${playerCount}-${stage}`}
      initialStage={stage}
      room={room}
      players={Array.from({ length: playerCount }, (_, index) => buildPlayer(index, playerCount))}
      questions={QUESTIONS}
      onRestart={() => alert('다시 시작 (미리보기)')}
    />
  )
}

export default function ResultPreviewPage() {
  return (
    <Suspense fallback={null}>
      <ResultPreview />
    </Suspense>
  )
}
