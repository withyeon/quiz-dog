'use client'

import Image from 'next/image'
import QRCodeSVG from 'react-qr-code'
import type { GameModeConfig } from '@/lib/game/modes'

/**
 * 학생 입장용 참가코드·QR 패널.
 * 대기 중에는 크게(코드 + QR + 초대 링크), 게임이 시작된 뒤에는 한 줄로 접어서 보여준다.
 */
export default function RoomCodePanel({
  roomCode,
  roomStatus,
  inviteUrl,
  modeConfig,
  playerCount,
  activeSetLabel,
  timerDisplaySeconds,
  onShowLargeQr,
  onCopyInvite,
}: {
  roomCode: string
  roomStatus?: string | null
  inviteUrl: string
  modeConfig: GameModeConfig
  playerCount: number
  activeSetLabel?: string | null
  timerDisplaySeconds: number | null
  onShowLargeQr: () => void
  onCopyInvite: () => void
}) {
  if (roomStatus === 'waiting') {
    return (
              <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_340px]">
                <div className="rounded-3xl bg-gradient-to-br from-sky-400 via-sky-500 to-cyan-500 p-6 text-white shadow-xl shadow-sky-200">
                  <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <p className="text-sm font-black text-sky-50">참가코드</p>
                      <div className="mt-1 text-6xl font-black tracking-wider">{roomCode}</div>
                    </div>
                    {modeConfig.image ? (
                        <div className="relative h-24 w-56">
                          <Image
                            src={modeConfig.image}
                            alt={modeConfig.shortLabel}
                            fill
                            className="object-contain"
                            sizes="224px"
                          />
                        </div>
                      ) : (
                        <div className="text-7xl">{modeConfig.emoji}</div>
                      )}
                  </div>
                  <div className="flex flex-wrap items-center gap-3 text-sky-50">
                    <span className="rounded-full bg-white/15 px-3 py-1.5 text-sm font-black">참가자 {playerCount}명</span>
                    {/* 어떤 문제집으로 시작했는지 확인할 수 있게 표시 — 엉뚱한 문제집으로 수업을 시작하는 사고 방지 */}
                    {activeSetLabel && (
                      <span className="rounded-full bg-white/15 px-3 py-1.5 text-sm font-black">
                        📖 {activeSetLabel}
                      </span>
                    )}
                  </div>
                </div>

                <div className="rounded-3xl border border-sky-100 bg-white p-6 text-center shadow-xl shadow-sky-100">
                  <p className="mb-3 text-sm font-black text-slate-500">QR 코드로 입장</p>
                  <button
                    type="button"
                    onClick={() => onShowLargeQr()}
                    className="mx-auto inline-block rounded-2xl border-2 border-sky-100 bg-white p-4 shadow-sm transition hover:-translate-y-0.5 hover:border-sky-300 hover:shadow-lg"
                    aria-label="QR 코드 크게 보기"
                  >
                    <QRCodeSVG
                      value={inviteUrl}
                      size={260}
                      level="H"
                    />
                  </button>
                  <p className="mt-2 text-xs font-bold text-slate-400">QR을 누르면 크게 볼 수 있어요</p>
                  <button
                    onClick={onCopyInvite}
                    className="mt-4 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-black text-slate-700 transition hover:bg-slate-100"
                  >
                    초대 링크 복사
                  </button>
                </div>
              </div>
    )
  }

  return (
              <div className="mx-auto flex w-full max-w-3xl flex-wrap items-center justify-center gap-5 rounded-3xl border border-sky-100 bg-white px-6 py-5 text-center shadow-xl shadow-sky-100">
                <div>
                  <p className="text-xs font-black text-sky-500">참가코드</p>
                  <div className="text-4xl font-black tracking-wider text-black">{roomCode}</div>
                </div>
                {timerDisplaySeconds !== null && (
                  <div className={`flex flex-col items-center rounded-2xl px-6 py-3 ${
                    timerDisplaySeconds <= 60
                      ? 'bg-red-50 ring-2 ring-red-400'
                      : timerDisplaySeconds <= 120
                        ? 'bg-amber-50 ring-2 ring-amber-300'
                        : 'bg-slate-50 ring-1 ring-slate-200'
                  }`}>
                    <p className={`text-xs font-black ${timerDisplaySeconds <= 60 ? 'text-red-500' : timerDisplaySeconds <= 120 ? 'text-amber-600' : 'text-slate-500'}`}>
                      {roomStatus === 'paused' ? '⏸ 일시정지' : '⏱ 남은 시간'}
                    </p>
                    <div className={`text-5xl font-black tabular-nums ${timerDisplaySeconds <= 60 ? 'text-red-600' : timerDisplaySeconds <= 120 ? 'text-amber-600' : 'text-slate-800'}`}>
                      {timerDisplaySeconds >= 60
                        ? `${Math.floor(timerDisplaySeconds / 60)}분 ${String(timerDisplaySeconds % 60).padStart(2, '0')}초`
                        : `${timerDisplaySeconds}초`}
                    </div>
                  </div>
                )}
                <button
                  type="button"
                  onClick={() => onShowLargeQr()}
                  className="rounded-2xl border-2 border-sky-100 bg-white p-3 shadow-sm transition hover:-translate-y-0.5 hover:border-sky-300 hover:shadow-lg"
                  aria-label="QR 코드 크게 보기"
                >
                  <QRCodeSVG
                    value={inviteUrl}
                    size={110}
                    level="H"
                  />
                </button>
              </div>
  )
}
