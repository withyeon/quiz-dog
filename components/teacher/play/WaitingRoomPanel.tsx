'use client'

import { Play } from 'lucide-react'
import WaitingPlayers from '@/components/teacher/play/WaitingPlayers'
import type { ComponentProps } from 'react'

type Props = {
  players: ComponentProps<typeof WaitingPlayers>['players']
  onStart: () => void
}

/** 방을 만든 뒤 학생이 들어오는 동안의 대기 패널. 한 명이라도 들어와야 시작 버튼이 켜진다. */
export default function WaitingRoomPanel({ players, onStart }: Props) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-2xl font-black tracking-tight text-slate-900">학생 입장 대기 중</h2>
          <p className="mt-1 text-sm font-medium text-slate-500">참가자 {players.length}명</p>
        </div>
        <button
          onClick={onStart}
          disabled={players.length === 0}
          className="inline-flex items-center justify-center gap-2 rounded-xl bg-sky-500 px-6 py-4 text-lg font-bold text-white shadow-sm shadow-sky-200 transition hover:bg-sky-600 disabled:cursor-not-allowed disabled:bg-slate-300 disabled:shadow-none"
        >
          <Play className="h-5 w-5 fill-current" />
          게임 시작
        </button>
      </div>

      <WaitingPlayers players={players} />
    </div>
  )
}
