'use client'

import Image from 'next/image'
import { motion } from 'framer-motion'
import { AlertTriangle, Crosshair, Snowflake, Thermometer, Users } from 'lucide-react'
import { CLASS_BADGES, HudTile } from '@/components/battle/BattleHud'
import QuizSetName from '@/components/game/QuizSetName'
import {
  PLAYER_CLASSES,
  TEAM_INFO,
  getComboDamageMultiplier,
  type PlayerClass,
  type SnowballItem,
  type Team,
} from '@/lib/game/battleRoyale'
import type { BattlePlayer } from '@/hooks/useSnowBattleGame'

type BattleHeaderProps = {
  questionSetTitle?: string | null
  players: BattlePlayer[]
  currentHealth: number
  selectedClass: PlayerClass | null
  myTeam: Team | null
  isReloading: boolean
  hasSnowball: boolean
  currentItem: SnowballItem | null
  onUseItem: () => void
  zoneLevel: number
  consecutiveCorrect: number
}

/** 눈싸움 상단 패널: 제목·HUD 타일 4개·상태 칩(팀·장비·장전·아이템·폭설·연속 정답). */
export default function BattleHeader({
  questionSetTitle,
  players,
  currentHealth,
  selectedClass,
  myTeam,
  isReloading,
  hasSnowball,
  currentItem,
  onUseItem,
  zoneLevel,
  consecutiveCorrect,
}: BattleHeaderProps) {
  const aliveCount = players.filter((player) => (player.health ?? 100) > 0).length
  const currentRank = players.filter((player) => (player.health ?? 100) > currentHealth).length + 1
  const selectedClassInfo = selectedClass ? PLAYER_CLASSES[selectedClass] : null

  const isTeamGame = players.some((p) => p.team)
  const myTeamInfo = myTeam ? TEAM_INFO[myTeam] : null
  const teamAlive = isTeamGame
    ? {
        red: players.filter((p) => p.team === 'red' && (p.health ?? 100) > 0).length,
        blue: players.filter((p) => p.team === 'blue' && (p.health ?? 100) > 0).length,
      }
    : null
  const SelectedClassIcon = selectedClass ? CLASS_BADGES[selectedClass].Icon : Snowflake
  const selectedClassTone = selectedClass ? CLASS_BADGES[selectedClass].tone : 'text-slate-600 bg-slate-50 border-slate-200'
  const healthTone = currentHealth <= 30 ? 'danger' : currentHealth <= 65 ? 'warm' : 'good'
  const comboMultiplier = getComboDamageMultiplier(consecutiveCorrect)

  return (
    <div className="mx-auto mb-4 max-w-7xl">
      {/* 폰에서 헤더가 화면의 60%를 차지하던 문제: 설명·배지는 sm부터만, HUD 타일은 항상 한 줄 4열 */}
      <header className="battle-frost-panel overflow-hidden p-3 sm:p-5">
        <div className="flex flex-col gap-3 sm:gap-5 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-center gap-3 sm:items-start">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-[8px] bg-white shadow-lg sm:h-14 sm:w-14">
              <Image
                src="/title/battle-royale.webp"
                alt="눈싸움 대작전"
                width={56}
                height={56}
                className="h-full w-full object-contain p-1"
              />
            </div>
            <div>
              <div className="mb-2 hidden flex-wrap items-center gap-2 sm:flex">
                <span className="battle-chip px-3 py-1 text-xs font-black text-slate-600">
                  실시간 배틀
                </span>
              </div>
              <h1 className="text-2xl font-black leading-tight text-slate-950 sm:text-4xl">
                눈싸움 대작전
              </h1>
              <QuizSetName title={questionSetTitle} className="mt-1.5" />
              <p className="mt-1 hidden text-sm font-semibold text-slate-500 sm:block">
                퀴즈를 맞히면 눈뭉치가 날아갑니다. 상대 팀을 전부 눈사람으로 만드세요.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-4 gap-1.5 sm:gap-2 xl:min-w-[620px]">
            <HudTile
              icon={<Thermometer className="h-3.5 w-3.5" />}
              label="체온"
              value={`${currentHealth}°`}
              detail={selectedClassInfo ? `최대 ${selectedClassInfo.maxHealth}°` : '기본 장비'}
              tone={healthTone}
            />
            <HudTile
              icon={<Image src="/trophy.webp" alt="" width={14} height={14} className="h-3.5 w-3.5 object-contain" />}
              label="순위"
              value={`${currentRank}`}
              detail={`${players.length}명 중`}
              tone="warm"
            />
            <HudTile
              icon={<Users className="h-3.5 w-3.5" />}
              label="생존"
              value={`${aliveCount}/${players.length}`}
              detail="아레나"
            />
            <HudTile
              icon={<SelectedClassIcon className="h-3.5 w-3.5" />}
              label="장비"
              value={selectedClassInfo ? selectedClassInfo.name : '미선택'}
              detail={selectedClassInfo ? `${selectedClassInfo.attackSpeed}x 장전` : '대기 중'}
            />
          </div>
        </div>

        <div className="mt-2 flex flex-wrap items-center gap-2 sm:mt-4">
          {myTeam && myTeamInfo && teamAlive && (
            <div
              className={`inline-flex items-center gap-2 rounded-full border-2 px-3 py-2 text-sm font-black ${
                myTeam === 'red'
                  ? 'border-rose-300 bg-rose-50 text-rose-700'
                  : 'border-sky-300 bg-sky-50 text-sky-700'
              }`}
            >
              <span className="text-base">{myTeamInfo.emoji}</span>
              {myTeamInfo.name}
              <span className="ml-1 rounded-full bg-white/70 px-2 py-0.5 text-[10px]">
                {teamAlive[myTeam]}명 생존 / 상대 {teamAlive[myTeam === 'red' ? 'blue' : 'red']}명
              </span>
            </div>
          )}

          {selectedClassInfo && (
            <div className={`inline-flex items-center gap-2 rounded-full border px-3 py-2 text-sm font-black ${selectedClassTone}`}>
              <SelectedClassIcon className="h-4 w-4" />
              {selectedClassInfo.name}
            </div>
          )}

          {isReloading && !hasSnowball && (
            <div className="battle-chip battle-pulse inline-flex items-center gap-2 px-3 py-2 text-sm font-black text-slate-700">
              <Snowflake className="h-4 w-4 text-cyan-600" />
              눈뭉치 장전 중
            </div>
          )}

          {hasSnowball && (
            <motion.div
              animate={{ scale: [1, 1.04, 1] }}
              transition={{ duration: 1.1, repeat: Infinity }}
              className="battle-status-ready inline-flex items-center gap-2 rounded-full px-3 py-2 text-sm font-black text-white"
            >
              <Crosshair className="h-4 w-4" />
              눈뭉치 준비 완료
            </motion.div>
          )}

          {currentItem && currentItem.type === 'giant_ball' && (
            <motion.div
              animate={{ y: [0, -2, 0] }}
              transition={{ duration: 1.2, repeat: Infinity }}
              className="inline-flex items-center gap-2 rounded-full border border-amber-300 bg-amber-50 px-3 py-2 text-sm font-black text-amber-800 shadow-sm"
            >
              <span>{currentItem.icon}</span>
              {currentItem.name} · 다음 공격 3배
            </motion.div>
          )}

          {currentItem && currentItem.type !== 'giant_ball' && (
            <motion.button
              type="button"
              animate={{ y: [0, -2, 0] }}
              transition={{ duration: 1.2, repeat: Infinity }}
              className="inline-flex items-center gap-2 rounded-full border border-violet-200 bg-violet-50 px-3 py-2 text-sm font-black text-violet-800 shadow-sm"
              onClick={onUseItem}
            >
              <span>{currentItem.icon}</span>
              {currentItem.name} · 탭하여 사용
            </motion.button>
          )}

          {zoneLevel > 1 && (
            <div className="battle-status-warn inline-flex items-center gap-2 rounded-full px-3 py-2 text-sm font-black text-white">
              <AlertTriangle className="h-4 w-4" />
              폭설 주의보 {zoneLevel}단계
            </div>
          )}

          {consecutiveCorrect >= 2 && (
            <motion.div
              key={consecutiveCorrect}
              initial={{ scale: 0.5, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className="inline-flex items-center gap-2 rounded-full bg-orange-500 px-4 py-2 font-black text-white shadow-lg shadow-orange-300/30"
            >
              🔥 {consecutiveCorrect}연속! 데미지 {Math.round(comboMultiplier * 100)}%
            </motion.div>
          )}
        </div>
      </header>
    </div>
  )
}
