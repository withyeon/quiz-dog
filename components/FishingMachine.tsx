'use client'

import Image from 'next/image'
import { motion, AnimatePresence } from 'framer-motion'
import type { Doll, FishingState } from '@/lib/game/fishing'

interface FishingMachineProps {
  fishingState: FishingState
  caughtItem: Doll | null
  message: string
  coins: number
  onQuizSolve: () => void
  onStartFishing: () => void
  canInteract: boolean
}

export default function FishingMachine({
  fishingState,
  caughtItem,
  message,
  coins,
  onQuizSolve,
  onStartFishing,
  canInteract,
}: FishingMachineProps) {
  return (
    <div className="w-full flex flex-col md:flex-row gap-6" style={{ fontFamily: 'OkDanDan, sans-serif' }}>
      {/* --- 왼쪽: 인형뽑기 기계 (메인) --- */}
      <div
        className={`relative flex-1 bg-slate-800 rounded-3xl border-8 border-pink-500 overflow-hidden shadow-[0_0_30px_rgba(236,72,153,0.3)] min-h-[500px] ${canInteract && fishingState === 'idle' ? 'cursor-pointer hover:border-yellow-400 transition-all' : ''
          }`}
        onClick={canInteract && fishingState === 'idle' ? onStartFishing : undefined}
      >
        {/* 네온 사인 효과 */}
        <div className="absolute top-0 w-full h-2 bg-pink-400 drop-shadow-[0_0_10px_rgba(255,105,180,1)] z-10"></div>

        {/* 배경 장식 */}
        <div className="absolute inset-0 opacity-20 bg-[url('https://www.transparenttextures.com/patterns/diagmonds-light.png')]"></div>

        {/* --- 집게 (Claw) --- */}
        <motion.div
          className="absolute top-0 left-1/2 -translate-x-1/2 z-20 flex flex-col items-center"
          animate={{
            y: fishingState === 'down' || fishingState === 'grab' ? 300 : 0,
            x: fishingState === 'return' || fishingState === 'release' || fishingState === 'drop' ? -150 : 0,
          }}
          transition={{
            duration: fishingState === 'drop' ? 0.5 : 1.5,
            ease: fishingState === 'drop' ? "easeIn" : "easeInOut"
          }}
        >
          {/* 집게 줄 */}
          <div className="w-2 h-[500px] bg-gray-400 -mt-[480px]"></div>

          {/* 집게 본체 */}
          <div className="relative">
            {/* 집게 손가락 (열림/닫힘 애니메이션) */}
            <motion.div
              className="w-24 h-24 border-8 border-gray-300 rounded-full border-t-0 border-r-0 rotate-45 absolute -left-12"
              animate={{ rotate: fishingState === 'grab' || fishingState === 'up' || fishingState === 'return' ? 60 : 45 }}
            />
            <motion.div
              className="w-24 h-24 border-8 border-gray-300 rounded-full border-t-0 border-l-0 -rotate-45 absolute -right-12"
              animate={{ rotate: fishingState === 'grab' || fishingState === 'up' || fishingState === 'return' ? -60 : -45 }}
            />

            {/* 잡힌 아이템 (집게를 따라다님) */}
            <AnimatePresence>
              {caughtItem && fishingState !== 'drop' && fishingState !== 'release' && fishingState !== 'idle' && fishingState !== 'down' && (
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  exit={{ y: 500, opacity: 0, transition: { duration: 0.5 } }}
                  className={`absolute top-10 left-1/2 -translate-x-1/2 drop-shadow-lg ${caughtItem.color}`}
                >
                  {caughtItem.image ? (
                    <Image src={caughtItem.image} alt={caughtItem.name} width={64} height={64} unoptimized className="w-16 h-16 object-contain" />
                  ) : (
                    <span className="text-6xl">{caughtItem.emoji}</span>
                  )}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </motion.div>

        {/* --- 바닥에 쌓인 인형들 (장식용) --- */}
        <div className="absolute bottom-0 w-full h-44 flex items-end justify-center gap-3 px-4 flex-wrap opacity-70">
          {Array(12).fill(0).map((_, i) => (
            <Image
              key={i}
              src={`/fishing/${(i % 16) + 1}.svg`}
              alt="doll"
              width={80}
              height={80}
              unoptimized
              className="w-16 h-16 md:w-20 md:h-20 object-contain animate-bounce"
              style={{ animationDuration: `${(i % 3) + 1}s` }}
            />
          ))}
        </div>

        {/* --- 배출구 --- */}
        <div className="absolute bottom-0 left-0 w-32 h-32 bg-black/50 border-t-4 border-r-4 border-pink-500 rounded-tr-2xl flex items-center justify-center">
          <span className="text-pink-300 text-base font-bold animate-pulse" style={{ fontFamily: 'OkDanDan, sans-serif' }}>GET HERE</span>
        </div>

        {/* 메시지 오버레이 */}
        <div className="absolute top-10 w-full text-center z-30">
          <span className="bg-black/60 px-6 py-2 rounded-full text-2xl font-bold border border-white/20 backdrop-blur-md" style={{ fontFamily: 'OkDanDan, sans-serif' }}>
            {message}
          </span>
        </div>
      </div>

      {/* --- 오른쪽: 조작 패널 (Fishing Frenzy 방식) --- */}
      <div className="w-full md:w-80 flex flex-col gap-4">
        {/* 조작 버튼 */}
        <div className="bg-slate-800 p-6 rounded-2xl border-4 border-slate-700 flex flex-col gap-4">
          {canInteract && fishingState === 'idle' ? (
            <button
              onClick={onStartFishing}
              className="w-full py-8 rounded-xl font-black text-3xl shadow-[0_5px_0_rgb(180,0,0)] active:translate-y-[5px] active:shadow-none transition bg-red-500 hover:bg-red-400 text-white animate-pulse flex flex-col items-center gap-2"
              style={{ fontFamily: 'OkDanDan, sans-serif' }}
            >
              🎣 인형 뽑기!
              <span className="text-base font-normal opacity-80">클릭해서 시작</span>
            </button>
          ) : (
            <div className="text-center">
              <div className="text-4xl mb-2">🎣</div>
              <h3 className="text-2xl font-bold text-white mb-2" style={{ fontFamily: 'OkDanDan, sans-serif' }}>인형뽑기</h3>
              <p className="text-base text-gray-300">
                {fishingState === 'idle'
                  ? '정답을 맞춰서 인형뽑기 화면으로 오세요!'
                  : '집게가 움직이는 중...'}
              </p>
            </div>
          )}

          <div className="border-t border-slate-600 pt-4 space-y-2">
            <div className="flex justify-between text-base">
              <span className="text-gray-400">빠른 정답</span>
              <span className="text-yellow-400 font-bold">높은 점수!</span>
            </div>
            <div className="flex justify-between text-base">
              <span className="text-gray-400">문제를 많이 맞추면</span>
              <span className="text-blue-400 font-bold">기계 업그레이드!</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
