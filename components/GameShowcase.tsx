'use client'

import { useState, useRef, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import Image from 'next/image'
import { ChevronLeft, ChevronRight } from 'lucide-react'

interface GameData {
    name: string
    emoji: string
    videoSrc?: string   // /videos/gold-quest.mp4 등 넣으면 자동 재생
    imageSrc: string    // 동영상 없을 때 폴백 이미지
    keywords: string[]
    description: string
    accentColor: string
    tagColor: string
}

const games: GameData[] = [
    {
        name: '타워 디펜스',
        emoji: '🏰',
        videoSrc: '/main/mp4/tower-defense.mov',
        imageSrc: '/tower-defense.svg',
        keywords: ['🏰 타워 설치', '⚔️ 적 격파', '🧠 전략 배치', '🛡️ 라운드 방어'],
        description: '퀴즈를 맞추고 타워를 세워 적을 막아내세요! 전략적으로 배치해 최후까지 버티세요.',
        accentColor: '#6366f1',
        tagColor: 'rgba(99,102,241,0.15)',
    },
    {
        name: '해적왕의 보물찾기',
        emoji: '🏴‍☠️',
        videoSrc: '/videos/gold-quest.mp4',
        imageSrc: '/gold-quest.png',
        keywords: ['💰 골드 수집', '⚔️ 실시간 대결', '🗺️ 맵 탐험', '🏆 최고 부자 우승'],
        description: '퀴즈를 맞추면 골드를 획득! 해적이 되어 보물을 차지하세요.',
        accentColor: '#f59e0b',
        tagColor: 'rgba(245,158,11,0.15)',
    },
    {
        name: '등교 임파서블',
        emoji: '🏃',
        videoSrc: '/videos/racing.mp4',
        imageSrc: '/racing.png',
        keywords: ['🚗 레이싱', '🧩 퀴즈 가속', '💥 아이템 공격', '🥇 1등 목표'],
        description: '정답을 맞출수록 속도 UP! 장애물을 피해 가장 먼저 도착하세요.',
        accentColor: '#3b82f6',
        tagColor: 'rgba(59,130,246,0.15)',
    },
    {
        name: '눈싸움 대작전',
        emoji: '❄️',
        videoSrc: '/videos/battle-royale.mp4',
        imageSrc: '/battle-royale.png',
        keywords: ['❄️ 눈덩이 공격', '🛡️ 배틀로얄', '💎 클래스 선택', '📉 안전 구역'],
        description: '마지막까지 살아남아라! 퀴즈로 눈덩이를 모아 상대를 맞추세요.',
        accentColor: '#38bdf8',
        tagColor: 'rgba(56,189,248,0.15)',
    },
    {
        name: '인형뽑기',
        emoji: '🕹️',
        videoSrc: '/videos/fishing.mp4',
        imageSrc: '/fishing.png',
        keywords: ['🎣 뽑기 시도', '⭐ 희귀 아이템', '🎰 확률 도전', '💫 특별 보상'],
        description: '퀴즈를 맞추고 뽑기 기회 획득! 희귀 아이템을 노려보세요.',
        accentColor: '#ec4899',
        tagColor: 'rgba(236,72,153,0.15)',
    },
    {
        name: '전설의 편의점',
        emoji: '🏪',
        videoSrc: '/videos/factory.mp4',
        imageSrc: '/factory.png',
        keywords: ['🏭 상품 진열', '📈 매출 경쟁', '🔗 시너지 효과', '💸 부자 되기'],
        description: '퀴즈로 상품을 획득하고 편의점을 경영하며 최고 부자가 되세요!',
        accentColor: '#10b981',
        tagColor: 'rgba(16,185,129,0.15)',
    },
    {
        name: '달콤 바삭 카페',
        emoji: '☕',
        videoSrc: '/videos/cafe.mp4',
        imageSrc: '/cafe.png',
        keywords: ['☕ 메뉴 경영', '👥 손님 응대', '⭐ 별점 관리', '🍰 레시피 업그레이드'],
        description: '카페를 운영하며 퀴즈로 메뉴를 추가하고 최고의 카페를 만들어요!',
        accentColor: '#f97316',
        tagColor: 'rgba(249,115,22,0.15)',
    },
    {
        name: '쉿! 마피아',
        emoji: '🕴️',
        videoSrc: '/videos/mafia.mp4',
        imageSrc: '/mafia.png',
        keywords: ['🔍 추리 대결', '🗳️ 투표 제거', '🤫 정체 숨기기', '🧠 심리전'],
        description: '마피아를 찾아라! 퀴즈 실력과 눈치로 마지막까지 살아남으세요.',
        accentColor: '#6b7280',
        tagColor: 'rgba(107,114,128,0.15)',
    },
    {
        name: 'Don\'t Look Down',
        emoji: '⛰️',
        videoSrc: '/videos/dontlookdown.mp4',
        imageSrc: '/dontlookdown/background.png',
        keywords: ['🧗 고도 경쟁', '⚡ 파워업 수집', '💨 장애물 피하기', '🏔️ 정상 등반'],
        description: '퀴즈를 맞추며 더 높이 올라가세요! 떨어지면 탈락이에요.',
        accentColor: '#14b8a6',
        tagColor: 'rgba(20,184,166,0.15)',
    },
]

const slideVariants = {
    enter: (dir: number) => ({
        x: dir > 0 ? 80 : -80,
        opacity: 0,
        scale: 0.97,
    }),
    center: {
        x: 0,
        opacity: 1,
        scale: 1,
    },
    exit: (dir: number) => ({
        x: dir > 0 ? -80 : 80,
        opacity: 0,
        scale: 0.97,
    }),
}

export default function GameShowcase() {
    const [current, setCurrent] = useState(0)
    const [direction, setDirection] = useState(0)
    const dragStartX = useRef(0)

    const go = useCallback(
        (delta: number) => {
            setDirection(delta)
            setCurrent((prev) => (prev + delta + games.length) % games.length)
        },
        []
    )

    const game = games[current]

    return (
        <section className="py-24 px-4 sm:px-6 lg:px-8 relative">
            <div className="max-w-7xl mx-auto">
                {/* Section header */}
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    className="text-center mb-14"
                >
                    <h2
                        className="text-4xl md:text-5xl font-black mb-4"
                        style={{ color: '#0369a1' }}
                    >
                        게임 미리보기
                    </h2>
                    <p className="text-lg text-sky-600/70">
                        좌우로 넘겨 다양한 게임을 확인해보세요!
                    </p>
                </motion.div>

                {/* Slide area */}
                <div className="relative">
                    <AnimatePresence mode="wait" custom={direction}>
                        <motion.div
                            key={current}
                            custom={direction}
                            variants={slideVariants}
                            initial="enter"
                            animate="center"
                            exit="exit"
                            transition={{ duration: 0.38, ease: [0.32, 0.72, 0, 1] }}
                            className="grid md:grid-cols-[1.35fr_1fr] gap-6 items-center"
                            drag="x"
                            dragConstraints={{ left: 0, right: 0 }}
                            dragElastic={0.1}
                            onDragStart={(_, info) => { dragStartX.current = info.point.x }}
                            onDragEnd={(_, info) => {
                                const diff = dragStartX.current - info.point.x
                                if (Math.abs(diff) > 60) go(diff > 0 ? 1 : -1)
                            }}
                        >
                            {/* LEFT: Video / Image */}
                            <div
                                className="toss-card texture-grain relative rounded-3xl overflow-hidden aspect-video min-h-[220px] md:min-h-[280px] select-none transition-shadow duration-300"
                                style={{
                                    background: 'rgba(255,255,255,0.55)',
                                    backdropFilter: 'blur(20px)',
                                    WebkitBackdropFilter: 'blur(20px)',
                                    border: '1px solid rgba(255,255,255,0.9)',
                                }}
                            >
                                <VideoOrImage game={game} />
                                {/* Gloss top line */}
                                <div
                                    className="absolute inset-x-0 top-0 h-px"
                                    style={{ background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.9), transparent)' }}
                                />
                                {/* Game name badge */}
                                <div
                                    className="toss-depth-plastic absolute bottom-4 left-4 flex items-center gap-2 px-4 py-2 rounded-full"
                                    style={{
                                        background: 'rgba(255,255,255,0.75)',
                                        backdropFilter: 'blur(12px)',
                                        WebkitBackdropFilter: 'blur(12px)',
                                        border: '1px solid rgba(255,255,255,0.95)',
                                    }}
                                >
                                    <span className="text-xl">{game.emoji}</span>
                                    <span className="text-sm font-bold text-sky-800">{game.name}</span>
                                </div>
                            </div>

                            {/* RIGHT: Keywords & Description */}
                            <div className="flex flex-col gap-6 px-2">
                                <div>
                                    <div className="flex items-center gap-3 mb-3">
                                        <span className="text-5xl">{game.emoji}</span>
                                        <h3
                                            className="text-3xl font-black leading-tight"
                                            style={{ color: '#0369a1' }}
                                        >
                                            {game.name}
                                        </h3>
                                    </div>
                                    <p className="text-sky-700/70 text-base leading-relaxed">{game.description}</p>
                                </div>

                                {/* Keyword tags */}
                                <div className="flex flex-wrap gap-3">
                                    {game.keywords.map((kw) => (
                                        <motion.div
                                            key={kw}
                                            initial={{ opacity: 0, scale: 0.85 }}
                                            animate={{ opacity: 1, scale: 1 }}
                                            transition={{ duration: 0.3 }}
                                            className="toss-depth-plastic texture-grain relative px-4 py-2 rounded-2xl text-sm font-bold"
                                            style={{
                                                background: game.tagColor,
                                                border: `1px solid ${game.accentColor}30`,
                                                color: game.accentColor,
                                                backdropFilter: 'blur(8px)',
                                                WebkitBackdropFilter: 'blur(8px)',
                                            }}
                                        >
                                            {kw}
                                        </motion.div>
                                    ))}
                                </div>

                                {/* Dots */}
                                <div className="flex items-center gap-2 mt-2">
                                    {games.map((_, i) => (
                                        <button
                                            key={i}
                                            onClick={() => { setDirection(i > current ? 1 : -1); setCurrent(i) }}
                                            className="rounded-full transition-all duration-300"
                                            style={{
                                                width: i === current ? 24 : 8,
                                                height: 8,
                                                background: i === current ? game.accentColor : 'rgba(14,165,233,0.25)',
                                            }}
                                        />
                                    ))}
                                </div>
                            </div>
                        </motion.div>
                    </AnimatePresence>

                    {/* Arrow buttons */}
                    <button
                        onClick={() => go(-1)}
                        className="toss-depth-plastic absolute left-0 top-1/2 -translate-y-1/2 -translate-x-5 md:-translate-x-7 z-10 w-12 h-12 rounded-full flex items-center justify-center transition-all duration-200 hover:scale-110 active:scale-95"
                        style={{
                            background: 'rgba(255,255,255,0.8)',
                            backdropFilter: 'blur(12px)',
                            WebkitBackdropFilter: 'blur(12px)',
                            border: '1px solid rgba(255,255,255,0.95)',
                        }}
                    >
                        <ChevronLeft className="w-5 h-5 text-sky-600" />
                    </button>
                    <button
                        onClick={() => go(1)}
                        className="toss-depth-plastic absolute right-0 top-1/2 -translate-y-1/2 translate-x-5 md:translate-x-7 z-10 w-12 h-12 rounded-full flex items-center justify-center transition-all duration-200 hover:scale-110 active:scale-95"
                        style={{
                            background: 'rgba(255,255,255,0.8)',
                            backdropFilter: 'blur(12px)',
                            WebkitBackdropFilter: 'blur(12px)',
                            border: '1px solid rgba(255,255,255,0.95)',
                        }}
                    >
                        <ChevronRight className="w-5 h-5 text-sky-600" />
                    </button>
                </div>
            </div>
        </section>
    )
}

/** 동영상이 있으면 재생, 없으면 이미지 폴백 */
function VideoOrImage({ game }: { game: GameData }) {
    const videoRef = useRef<HTMLVideoElement>(null)

    if (game.videoSrc) {
        return (
            <video
                ref={videoRef}
                key={game.videoSrc}
                src={game.videoSrc}
                autoPlay
                loop
                muted
                playsInline
                className="w-full h-full object-cover"
                onError={() => {
                    // 동영상 로드 실패 시 비디오 숨기고 이미지 표시
                    if (videoRef.current) videoRef.current.style.display = 'none'
                }}
            />
        )
    }

    return (
        <Image
            src={game.imageSrc}
            alt={game.name}
            fill
            className="object-cover"
            sizes="(max-width: 768px) 100vw, 50vw"
        />
    )
}
