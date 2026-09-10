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
 *   /dev/result-preview?players=2       참가자 수 바꾸기 (1~8)
 *   /dev/result-preview?game=tower      게임 모드별 점수 표기 확인
 *   /dev/result-preview?stage=4         Top 3 시상대부터 바로 (0 발표대기 · 1~3 등수공개 · 4 시상대 · 5 다시볼문제 · 6 마무리)
 *
 * 프로덕션에서는 proxy.ts가 /dev/* 를 막는다.
 */

const NICKNAMES = ['멍멍이', '초코', '하늘이', '보리', '뭉치', '까미', '두부', '코코']
const AVATARS = ['/character/1.svg', '/character/2.svg', '/character/3.svg', '/character/4.svg']

function buildPlayer(index: number): Player {
  const score = 980 - index * 137
  return {
    id: `preview-${index}`,
    room_code: '123456',
    nickname: NICKNAMES[index % NICKNAMES.length],
    score,
    gold: score,
    avatar: AVATARS[index % AVATARS.length],
    is_online: true,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    answer_history: [
      { questionIndex: 0, isCorrect: index !== 1, responseTimeMs: 3200 },
      { questionIndex: 1, isCorrect: index < 2, responseTimeMs: 5100 },
      { questionIndex: 2, isCorrect: index === 0, responseTimeMs: 4400 },
    ] as unknown as Player['answer_history'],
  } as Player
}

const QUESTIONS: AnalyticsQuestion[] = [
  { question: '분수의 덧셈에서 분모가 다르면 먼저 무엇을 해야 할까요?', correct_answer: '통분', options: ['통분', '약분', '반올림', '나눗셈'] },
  { question: '광합성에 필요하지 않은 것은?', correct_answer: '소금', options: ['빛', '물', '이산화탄소', '소금'] },
  { question: '조선을 세운 인물은?', correct_answer: '이성계', options: ['이성계', '왕건', '주몽', '박혁거세'] },
] as unknown as AnalyticsQuestion[]

function ResultPreview() {
  const params = useSearchParams()
  const rawMode = params.get('game')
  const gameMode = isGameModeId(rawMode) ? rawMode : DEFAULT_GAME_MODE
  const playerCount = Math.min(8, Math.max(1, Number.parseInt(params.get('players') ?? '3', 10) || 3))
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
      players={Array.from({ length: playerCount }, (_, index) => buildPlayer(index))}
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
