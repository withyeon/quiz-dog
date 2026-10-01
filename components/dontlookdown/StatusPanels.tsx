'use client'

import PixelIcon from '@/components/ui/PixelIcon'
import QuizSetName from '@/components/game/QuizSetName'
import PowerUpIcon from '@/components/dontlookdown/PowerUpIcon'
import { ENERGY, POWERUP_EFFECTS, SUMMITS, type DLDPlayer, type GameSettings } from '@/lib/game/dontlookdown'

/** 상단 가운데(폰에선 왼쪽 위) 남은 시간. */
export function TimeBadge({ remainingTime }: { remainingTime: number }) {
    return (
        <div className="absolute top-[7rem] left-4 sm:top-4 sm:left-1/2 sm:-translate-x-1/2 bg-black/60 text-white px-4 sm:px-6 py-1.5 sm:py-2 rounded-xl font-bold text-lg sm:text-xl tabular-nums whitespace-nowrap">
            <PixelIcon name="time" size={22} alt="" className="inline-block align-[-5px] mr-1" />{Math.floor(remainingTime / 60)}:{String(remainingTime % 60).padStart(2, '0')}
        </div>
    )
}

/** 왼쪽 위: 퀴즈 세트 이름, 구역 진행도, 높이, 생명. */
export function ProgressPanel({
    player,
    settings,
    questionSetTitle,
}: {
    player: DLDPlayer
    settings: GameSettings
    questionSetTitle?: string | null
}) {
    const summitProgress =
        SUMMITS.length <= 1 ? 0 : ((player.currentSummit - 1) / (SUMMITS.length - 1)) * 100
    const heightProgress = (player.height / settings.summitGoal) * 100

    return (
        <div className="absolute top-4 left-4 bg-white/95 rounded-xl px-3 py-2 sm:px-5 sm:py-3 shadow-lg pointer-events-auto w-[calc(50vw-1.5rem)] sm:w-auto sm:min-w-[200px]">
            <QuizSetName title={questionSetTitle} className="mb-2 max-w-full" />
            <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-semibold text-gray-600">🏔️ 구역 {player.currentSummit}/{SUMMITS.length}</span>
                <span className="text-xs text-gray-500">{Math.floor(summitProgress)}%</span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-2 mb-3">
                <div
                    className="bg-gradient-to-r from-sky-400 to-sky-600 h-2 rounded-full transition-all duration-300"
                    style={{ width: `${summitProgress}%` }}
                />
            </div>

            <div className="flex items-center justify-between mb-1">
                <span className="text-sm font-semibold text-gray-600">높이</span>
                <span className="text-xs text-gray-500">{Math.floor(player.height)}m / {settings.summitGoal}m</span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-2">
                <div
                    className="bg-gradient-to-r from-green-500 to-emerald-500 h-2 rounded-full transition-all duration-300"
                    style={{ width: `${Math.min(100, heightProgress)}%` }}
                />
            </div>

            {settings.livesEnabled && (
                <div className="mt-3 flex items-center gap-1">
                    <span className="text-sm font-semibold text-gray-600">생명</span>
                    {Array.from({ length: settings.startingLives }).map((_, i) => (
                        <span key={i} className="text-lg">
                            {i < player.lives ? '❤️' : '🖤'}
                        </span>
                    ))}
                </div>
            )}
        </div>
    )
}

/** 오른쪽 위: 에너지, 파워업 슬롯 2개, 켜져 있는 파워업 목록. */
export function EnergyPanel({
    player,
    onActivatePowerUp,
}: {
    player: DLDPlayer
    onActivatePowerUp: (slotIndex: number) => void
}) {
    return (
        <div className="absolute top-4 right-4 bg-white/95 rounded-xl px-3 py-2 sm:px-5 sm:py-3 shadow-lg pointer-events-auto w-[calc(50vw-1.5rem)] sm:w-auto sm:min-w-[180px]">
            <div className="flex items-center justify-between mb-1">
                <span className="text-sm font-semibold text-gray-600">에너지</span>
                <span className="text-xs text-gray-500">{Math.floor(player.energy)}</span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-2 mb-4">
                <div
                    className="bg-gradient-to-r from-yellow-400 to-orange-500 h-2 rounded-full transition-all duration-300"
                    style={{ width: `${Math.min(100, (player.energy / ENERGY.MAX) * 100)}%` }}
                />
            </div>

            <div className="text-xs font-semibold text-gray-600 mb-2">파워업</div>
            <div className="flex gap-2">
                {[0, 1].map(index => {
                    const powerUp = player.powerUps[index]
                    return (
                        <button
                            type="button"
                            key={index}
                            onClick={() => onActivatePowerUp(index)}
                            disabled={!powerUp}
                            aria-label={powerUp ? `${POWERUP_EFFECTS[powerUp.type].name} 사용` : `빈 파워업 슬롯 ${index + 1}`}
                            title={powerUp ? `${POWERUP_EFFECTS[powerUp.type].name} 사용` : '빈 파워업 슬롯'}
                            className={`flex h-12 w-12 touch-manipulation items-center justify-center rounded-lg border-2 text-2xl transition active:scale-95 disabled:active:scale-100 ${powerUp ? 'border-yellow-400 bg-yellow-100 hover:bg-yellow-200' : 'cursor-default border-gray-300 bg-gray-100'
                                }`}
                        >
                            {powerUp && <PowerUpIcon type={powerUp.type} size={36} />}
                        </button>
                    )
                })}
            </div>

            {(player.activePowerUps.size > 0 || player.hasShield) && (
                <div className="mt-3 space-y-1">
                    {player.hasShield && (
                        <div className="text-xs bg-sky-100 px-2 py-1 rounded flex items-center justify-between gap-2">
                            <span className="flex items-center gap-1.5">
                                <PowerUpIcon type="shield" size={16} />
                                {POWERUP_EFFECTS.shield.name}
                            </span>
                            <span className="font-bold">보호 중</span>
                        </div>
                    )}
                    {Array.from(player.activePowerUps.entries()).map(([type, time]) => (
                        <div key={type} className="text-xs bg-sky-100 px-2 py-1 rounded flex items-center justify-between gap-2">
                            <span className="flex items-center gap-1.5">
                                <PowerUpIcon type={type} size={16} />
                                {POWERUP_EFFECTS[type].name}
                            </span>
                            <span className="font-bold">{Math.ceil(time)}초</span>
                        </div>
                    ))}
                </div>
            )}
        </div>
    )
}

/** 아래 가운데 순위 3명. 폰: 터치 버튼(점프 80px) 위로 올리고, 가로 폰(높이≤500)은 발판·캐릭터를 가리지 않게 상단으로 */
export function Leaderboard({ players, playerId }: { players: DLDPlayer[]; playerId: string }) {
    return (
        <div className="absolute bottom-28 sm:bottom-20 [@media(max-height:500px)]:bottom-auto [@media(max-height:500px)]:top-16 left-1/2 -translate-x-1/2 bg-white/95 rounded-xl px-3 py-1.5 sm:px-4 sm:py-2 shadow-lg w-[calc(100vw-2rem)] sm:w-auto sm:min-w-[300px] max-w-[360px]">
            <div className="text-xs font-bold text-gray-600 mb-1 sm:mb-2 text-center">순위</div>
            <div className="space-y-0.5 sm:space-y-1">
                {players.map((player, index) => (
                    <div key={player.id} className={`flex items-center justify-between text-sm ${player.id === playerId ? 'font-bold text-blue-600' : ''}`}>
                        <div className="flex items-center gap-2">
                            <span>{index === 0 ? '🥇' : index === 1 ? '🥈' : '🥉'}</span>
                            <span className="truncate max-w-[120px]">{player.nickname}</span>
                            {player.id === playerId && <span className="text-xs">(나)</span>}
                        </div>
                        <span>{Math.floor(player.height)}m</span>
                    </div>
                ))}
            </div>
        </div>
    )
}
