'use client'

import Image from 'next/image'
import { getPlayerDisplayNickname, isAvatarPath } from '@/lib/utils/playerDisplay'
import type { Database } from '@/types/database.types'

type PlayerRow = Database['public']['Tables']['players']['Row']

/** 캐릭터 이미지를 쓰는 학생은 이미지로, 이모지 아바타는 그대로 보여준다 */
function PlayerAvatar({ avatar, nickname }: { avatar: string | null; nickname: string }) {
  const normalizedAvatar = String(avatar || '').trim()

  if (isAvatarPath(normalizedAvatar)) {
    return (
      <Image
        src={normalizedAvatar.startsWith('/') ? normalizedAvatar : `/${normalizedAvatar}`}
        alt={nickname}
        fill
        className="object-contain scale-125"
        sizes="56px"
      />
    )
  }

  return <>{normalizedAvatar || '🐶'}</>
}

/** 대기실에 들어온 학생 목록 (아무도 없으면 안내) */
export default function WaitingPlayers({ players }: { players: PlayerRow[] }) {
  if (players.length === 0) {
    return (
      <div className="rounded-2xl border-2 border-dashed border-slate-200 bg-slate-50/70 px-6 py-10 text-center">
        <Image
          src="/mascot_pome.png"
          alt=""
          width={56}
          height={56}
          className="mx-auto mb-3 h-14 w-14 object-contain"
        />
        <p className="text-lg font-bold text-slate-700">참가자 없음</p>
        <p className="mt-1 text-sm font-medium text-slate-500">학생이 코드를 입력하면 여기에 표시돼요</p>
      </div>
    )
  }

  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      {players.map((player) => {
        const displayNickname = getPlayerDisplayNickname(player.nickname, player.avatar)

        return (
          <div
            key={player.id}
            className="flex items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 p-4 shadow-sm"
          >
            <div className="relative grid h-14 w-14 shrink-0 place-items-center overflow-hidden rounded-xl bg-white text-3xl ring-1 ring-slate-200">
              <PlayerAvatar avatar={player.avatar} nickname={displayNickname} />
            </div>
            <div className="min-w-0">
              <div className="truncate text-base font-black text-black">{displayNickname}</div>
              <div className="mt-1 text-xs font-bold text-emerald-600">준비 완료</div>
            </div>
          </div>
        )
      })}
    </div>
  )
}
