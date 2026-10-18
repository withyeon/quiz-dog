'use client'

import { useCallback, useState } from 'react'
import dynamic from 'next/dynamic'
import MafiaView from '@/components/MafiaView'
import type { Question } from '@/hooks/useGameBase'
import type { Database } from '@/types/database.types'

type PlayerRow = Database['public']['Tables']['players']['Row']

/**
 * 쉿! 마피아 학생 화면 미리보기. 방 없이 가짜 플레이어 3명으로 뜨고, 모든 답이 정답 처리된다.
 * 화면 위 숫자 판에 보상 기록(commitPlayerDelta)·자금 이동(commitPlayerSteal)·다음 문제 횟수가 쌓인다.
 * 금고나 조사 대상을 빠르게 여러 번 눌러도 각 숫자가 한 번만 올라야 한다.
 *
 *   /dev/mafia-preview
 *
 * 프로덕션에서는 proxy.ts가 /dev/* 를 막는다.
 */

const NOW = new Date().toISOString()

function buildPlayer(id: string, nickname: string, cash: number): PlayerRow {
  return {
    id,
    room_code: '123456',
    nickname,
    score: cash,
    gold: cash,
    mafia_cash: cash,
    mafia_diamonds: 0,
    avatar: '/character/1.svg',
    is_online: true,
    created_at: NOW,
    updated_at: NOW,
    active_item: null,
  } as unknown as PlayerRow
}

const PLAYERS: PlayerRow[] = [
  buildPlayer('preview-me', '나', 1000),
  buildPlayer('preview-1', '초코', 800),
  buildPlayer('preview-2', '보리', 600),
]

const QUESTIONS = [
  { id: 'q1', type: 'CHOICE', question_text: '조선을 세운 인물은?', options: ['이성계', '왕건', '주몽', '박혁거세'] },
  { id: 'q2', type: 'CHOICE', question_text: '광합성에 필요하지 않은 것은?', options: ['빛', '물', '이산화탄소', '소금'] },
] as unknown as Question[]

function MafiaPreview() {
  const [questionIndex, setQuestionIndex] = useState(0)
  const [counts, setCounts] = useState({ delta: 0, steal: 0, next: 0 })

  const bump = useCallback((key: keyof typeof counts) => {
    setCounts((prev) => ({ ...prev, [key]: prev[key] + 1 }))
  }, [])

  return (
    <div className="relative">
      <div className="fixed left-2 top-20 z-[100] rounded bg-white/95 px-3 py-2 font-mono text-sm text-black shadow" data-testid="mafia-preview-counts">
        보상 기록 {counts.delta} · 자금 이동 {counts.steal} · 다음 문제 {counts.next}
      </div>
      <MafiaView
        roomCode="123456"
        playerId="preview-me"
        players={PLAYERS}
        currentQuestion={QUESTIONS[questionIndex % QUESTIONS.length]}
        timeRemaining={300}
        checkAnswer={async () => true}
        goToNextQuestion={() => {
          bump('next')
          setQuestionIndex((prev) => prev + 1)
        }}
        commitPlayerPatch={async () => undefined}
        commitPlayerDelta={async () => {
          bump('delta')
        }}
        commitPlayerSteal={async () => {
          bump('steal')
        }}
        sendRoomEvent={() => ({ ok: true })}
        playSFX={() => undefined}
      />
    </div>
  )
}

export default dynamic(() => Promise.resolve(MafiaPreview), { ssr: false })
