'use client'

import Image from 'next/image'

type GameMode = 'gold_quest' | 'racing' | 'battle_royale' | 'fishing' | 'factory' | 'cafe' | 'mafia' | 'pool' | 'dontlookdown' | 'tower' | 'allin'

interface GameModeSelectorProps {
    selectedMode: GameMode
    onSelectMode: (mode: GameMode) => void
}

export default function GameModeSelector({ selectedMode, onSelectMode }: GameModeSelectorProps) {
    return (
        <div className="mb-6">
            <label className="block text-sm font-semibold text-gray-900 mb-4">게임 모드 선택</label>
            <div className="grid grid-cols-2 gap-4">
                <button
                    onClick={() => onSelectMode('gold_quest')}
                    className={`p-6 rounded-xl border-2 transition-all flex flex-col items-center justify-center ${selectedMode === 'gold_quest'
                        ? 'border-blue-500 bg-blue-50 shadow-md scale-[1.02]'
                        : 'border-gray-200 bg-white hover:border-gray-300 hover:shadow-sm'
                        }`}
                >
                    <Image
                        src="/gold-quest.png"
                        alt="Gold Quest"
                        width={500}
                        height={500}
                        className="w-96 h-96 object-contain mb-4"
                    />
                    <div className="font-bold text-xl text-gray-900 mb-2" style={{ fontFamily: 'DNFBitBitv2, sans-serif' }}>🏴‍☠️ 해적왕의 보물찾기</div>
                    <div className="text-base text-gray-600 text-center px-2" style={{ fontFamily: 'DNFBitBitv2, sans-serif' }}>황금빛 보물이 잠든 섬, 지도를 따라 모험을 떠나는 짜릿한 해적 어드벤처!</div>
                </button>
                <button
                    onClick={() => onSelectMode('racing')}
                    className={`p-6 rounded-xl border-2 transition-all flex flex-col items-center justify-center ${selectedMode === 'racing'
                        ? 'border-blue-500 bg-blue-50 shadow-md scale-[1.02]'
                        : 'border-gray-200 bg-white hover:border-gray-300 hover:shadow-sm'
                        }`}
                >
                    <Image
                        src="/racing.png"
                        alt="Racing"
                        width={500}
                        height={500}
                        className="w-96 h-96 object-contain mb-4"
                    />
                    <div className="font-bold text-xl text-gray-900 mb-2" style={{ fontFamily: 'DNFBitBitv2, sans-serif' }}>🏃 미션: 등교 임파서블</div>
                    <div className="text-base text-gray-600 text-center px-2" style={{ fontFamily: 'DNFBitBitv2, sans-serif' }}>닫히는 교문을 향해 전력 질주! 장애물을 피해 달리는 스릴 만점 등교 레이싱.</div>
                </button>
                <button
                    onClick={() => onSelectMode('battle_royale')}
                    className={`p-6 rounded-xl border-2 transition-all flex flex-col items-center justify-center ${selectedMode === 'battle_royale'
                        ? 'border-blue-500 bg-blue-50 shadow-md scale-[1.02]'
                        : 'border-gray-200 bg-white hover:border-gray-300 hover:shadow-sm'
                        }`}
                >
                    <Image
                        src="/battle-royale.png"
                        alt="Battle Royale"
                        width={500}
                        height={500}
                        className="w-96 h-96 object-contain mb-4"
                    />
                    <div className="font-bold text-xl text-gray-900 mb-2" style={{ fontFamily: 'DNFBitBitv2, sans-serif' }}>❄️ 눈싸움 대작전</div>
                    <div className="text-base text-gray-600 text-center px-2" style={{ fontFamily: 'DNFBitBitv2, sans-serif' }}>던지고 피하고 명중시켜라! 설원 위에서 펼쳐지는 예측불허 스노우 액션.</div>
                </button>
                <button
                    onClick={() => onSelectMode('fishing')}
                    className={`p-6 rounded-xl border-2 transition-all flex flex-col items-center justify-center ${selectedMode === 'fishing'
                        ? 'border-blue-500 bg-blue-50 shadow-md scale-[1.02]'
                        : 'border-gray-200 bg-white hover:border-gray-300 hover:shadow-sm'
                        }`}
                >
                    <Image
                        src="/fishing.png"
                        alt="Fishing"
                        width={500}
                        height={500}
                        className="w-96 h-96 object-contain mb-4"
                    />
                    <div className="font-bold text-xl text-gray-900 mb-2" style={{ fontFamily: 'OkDanDan, sans-serif' }}>🕹️ 두근두근 인형뽑기</div>
                    <div className="text-base text-gray-600 text-center px-2" style={{ fontFamily: 'OkDanDan, sans-serif' }}>손끝에 집중하라! 집게가 움직일 때마다 심장이 쫄깃해지는 행운의 뽑기 한판.</div>
                </button>
                <button
                    onClick={() => onSelectMode('factory')}
                    className={`p-6 rounded-xl border-2 transition-all flex flex-col items-center justify-center ${selectedMode === 'factory'
                        ? 'border-blue-500 bg-blue-50 shadow-md scale-[1.02]'
                        : 'border-gray-200 bg-white hover:border-gray-300 hover:shadow-sm'
                        }`}
                >
                    <Image
                        src="/factory.png"
                        alt="Factory"
                        width={500}
                        height={500}
                        className="w-96 h-96 object-contain mb-4"
                    />
                    <div className="font-bold text-xl text-gray-900 mb-2" style={{ fontFamily: 'BMJUA, sans-serif' }}>🏪 전설의 편의점</div>
                    <div className="text-base text-gray-600 text-center px-2" style={{ fontFamily: 'BMJUA, sans-serif' }}>진열부터 계산까지 내 손으로! 동네 최고의 핫플레이스를 만드는 경영 시뮬레이션.</div>
                </button>
                <button
                    onClick={() => onSelectMode('cafe')}
                    className={`p-6 rounded-xl border-2 transition-all flex flex-col items-center justify-center ${selectedMode === 'cafe'
                        ? 'border-blue-500 bg-blue-50 shadow-md scale-[1.02]'
                        : 'border-gray-200 bg-white hover:border-gray-300 hover:shadow-sm'
                        }`}
                >
                    <Image
                        src="/cafe.png"
                        alt="Cafe"
                        width={500}
                        height={500}
                        className="w-96 h-96 object-contain mb-4"
                    />
                    <div className="font-bold text-xl text-gray-900 mb-2" style={{ fontFamily: 'DNFBitBitv2, sans-serif' }}>☕ 달콤 바삭 카페</div>
                    <div className="text-base text-gray-600 text-center px-2" style={{ fontFamily: 'DNFBitBitv2, sans-serif' }}>손님에게 음식을 서빙하고 카페를 성장시키는 달콤한 경영 게임!</div>
                </button>
                <button
                    onClick={() => onSelectMode('mafia')}
                    className={`p-6 rounded-xl border-2 transition-all flex flex-col items-center justify-center ${selectedMode === 'mafia'
                        ? 'border-blue-500 bg-blue-50 shadow-md scale-[1.02]'
                        : 'border-gray-200 bg-white hover:border-gray-300 hover:shadow-sm'
                        }`}
                >
                    <Image
                        src="/mafia.png"
                        alt="Mafia"
                        width={500}
                        height={500}
                        className="w-96 h-96 object-contain mb-4"
                    />
                    <div className="font-bold text-xl text-gray-900 mb-2" style={{ fontFamily: 'BMKkubulim, sans-serif' }}>🕴️ 쉿! 마피아</div>
                    <div className="text-base text-gray-600 text-center px-2" style={{ fontFamily: 'BMKkubulim, sans-serif' }}>금고를 털고, 배신하고, 색출하라! 느와르 스타일의 심리전 게임!</div>
                </button>
                <button
                    onClick={() => onSelectMode('pool')}
                    className={`p-6 rounded-xl border-2 transition-all flex flex-col items-center justify-center ${selectedMode === 'pool'
                        ? 'border-blue-500 bg-blue-50 shadow-md scale-[1.02]'
                        : 'border-gray-200 bg-white hover:border-gray-300 hover:shadow-sm'
                        }`}
                >
                    <div className="text-9xl mb-4">🎱</div>
                    <div className="font-bold text-xl text-gray-900 mb-2" style={{ fontFamily: 'DNFBitBitv2, sans-serif' }}>🎱 포켓볼 게임</div>
                    <div className="text-base text-gray-600 text-center px-2" style={{ fontFamily: 'DNFBitBitv2, sans-serif' }}>퀴즈를 풀고 정답을 맞추면 공을 칠 수 있어요! 구멍에 넣으면 점수 획득!</div>
                </button>
                <button
                    onClick={() => onSelectMode('dontlookdown')}
                    className={`p-6 rounded-xl border-2 transition-all flex flex-col items-center justify-center ${selectedMode === 'dontlookdown'
                        ? 'border-blue-500 bg-blue-50 shadow-md scale-[1.02]'
                        : 'border-gray-200 bg-white hover:border-gray-300 hover:shadow-sm'
                        }`}
                >
                    <div className="text-9xl mb-4">⛰️</div>
                    <div className="font-bold text-xl text-gray-900 mb-2" style={{ fontFamily: 'DNFBitBitv2, sans-serif' }}>⛰️ Don't Look Down</div>
                    <div className="text-base text-gray-600 text-center px-2" style={{ fontFamily: 'DNFBitBitv2, sans-serif' }}>플랫폼을 점프하며 정상까지! 퀴즈로 에너지 얻고 더블 점프로 오르는 스릴 만점 등반 게임.</div>
                </button>
                <button
                    onClick={() => onSelectMode('tower')}
                    className={`p-6 rounded-xl border-2 transition-all flex flex-col items-center justify-center ${selectedMode === 'tower'
                        ? 'border-blue-500 bg-blue-50 shadow-md scale-[1.02]'
                        : 'border-gray-200 bg-white hover:border-gray-300 hover:shadow-sm'
                        }`}
                >
                    <div className="text-9xl mb-4">🏰</div>
                    <div className="font-bold text-xl text-gray-900 mb-2" style={{ fontFamily: 'DNFBitBitv2, sans-serif' }}>🏰 타워 디펜스</div>
                    <div className="text-base text-gray-600 text-center px-2" style={{ fontFamily: 'DNFBitBitv2, sans-serif' }}>퀴즈를 풀어 타워를 설치하고 몰려오는 적들을 막으세요!</div>
                </button>
                <button
                    onClick={() => onSelectMode('allin')}
                    className={`p-6 rounded-xl border-2 transition-all flex flex-col items-center justify-center ${selectedMode === 'allin'
                        ? 'border-blue-500 bg-blue-50 shadow-md scale-[1.02]'
                        : 'border-gray-200 bg-white hover:border-gray-300 hover:shadow-sm'
                        }`}
                >
                    <div className="text-9xl mb-4">💎</div>
                    <div className="font-bold text-xl text-gray-900 mb-2" style={{ fontFamily: 'DNFBitBitv2, sans-serif' }}>💎 올인 퀴즈</div>
                    <div className="text-base text-gray-600 text-center px-2" style={{ fontFamily: 'DNFBitBitv2, sans-serif' }}>점수를 걸고 문제를 풀어라! 맞히면 대박, 틀리면 쪽박! 역전의 짜릿함!</div>
                </button>
            </div>
        </div>
    )
}
