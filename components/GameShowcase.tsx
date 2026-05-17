'use client'

import { useState, useRef, useCallback, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import Image from 'next/image'
import Link from 'next/link'
import { ChevronLeft, ChevronRight } from 'lucide-react'

const PRIMARY_COLOR = '#4FC3F7'

interface GameData {
    name: string
    emoji: string
    videoSrc?: string   // /videos/gold-quest.mp4 등 넣으면 자동 재생
    imageSrc: string    // 동영상 없을 때 폴백 이미지
    titleImageSrc?: string
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
        imageSrc: '/title/tower-defense.svg',
        titleImageSrc: '/title/tower-defense.svg',
        keywords: ['🏰 타워 설치', '⚔️ 적 격파', '🧠 전략 배치', '🛡️ 라운드 방어'],
        description: '퀴즈를 맞추고 타워를 세워 적을 막아내세요! 전략적으로 배치해 최후까지 버티세요.',
        accentColor: '#6366f1',
        tagColor: 'rgba(99,102,241,0.15)',
    },
    {
        name: '해적왕의 보물찾기',
        emoji: '🏴‍☠️',
        videoSrc: '/main/mp4/gold-quest.mov',
        imageSrc: '/title/gold-quest.svg',
        titleImageSrc: '/title/gold-quest.svg',
        keywords: ['💰 골드 수집', '⚔️ 실시간 대결', '🗺️ 맵 탐험', '🏆 최고 부자 우승'],
        description: '퀴즈를 맞추면 골드를 획득! 해적이 되어 보물을 차지하세요.',
        accentColor: '#f59e0b',
        tagColor: 'rgba(245,158,11,0.15)',
    },
    {
        name: '눈싸움 대작전',
        emoji: '❄️',
        videoSrc: '/videos/battle-royale.mp4',
        imageSrc: '/title/battle-royale.svg',
        titleImageSrc: '/title/battle-royale.svg',
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
        imageSrc: '/title/factory.svg',
        titleImageSrc: '/title/factory.svg',
        keywords: ['🏭 상품 진열', '📈 매출 경쟁', '🔗 시너지 효과', '💸 부자 되기'],
        description: '퀴즈로 상품을 획득하고 편의점을 경영하며 최고 부자가 되세요!',
        accentColor: '#10b981',
        tagColor: 'rgba(16,185,129,0.15)',
    },
    {
        name: '달콤 바삭 카페',
        emoji: '☕',
        videoSrc: '/videos/cafe.mp4',
        imageSrc: '/title/cafe.svg',
        titleImageSrc: '/title/cafe.svg',
        keywords: ['☕ 메뉴 경영', '👥 손님 응대', '⭐ 별점 관리', '🍰 레시피 업그레이드'],
        description: '카페를 운영하며 퀴즈로 메뉴를 추가하고 최고의 카페를 만들어요!',
        accentColor: '#f97316',
        tagColor: 'rgba(249,115,22,0.15)',
    },
    {
        name: '쉿! 마피아',
        emoji: '🕴️',
        videoSrc: '/videos/mafia.mp4',
        imageSrc: '/title/mafia.svg',
        titleImageSrc: '/title/mafia.svg',
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
    {
        name: '좀비를 피해라',
        emoji: '🧟',
        imageSrc: '/zombie/background.png',
        titleImageSrc: '/title/zombie.svg',
        keywords: ['🧟 좀비 회피', '🏃 생존 질주', '⚠️ 함정 주의', '🏁 끝까지 생존'],
        description: '퀴즈를 맞추며 좀비를 피해 끝까지 살아남으세요!',
        accentColor: '#22c55e',
        tagColor: 'rgba(34,197,94,0.15)',
    },
    {
        name: '간식런',
        emoji: '🍪',
        imageSrc: '/title/gansik-run.svg',
        titleImageSrc: '/title/gansik-run.svg',
        keywords: ['🍪 간식 수집', '🏃 스피드 런', '🧠 퀴즈 부스트', '🏆 최고 기록'],
        description: '퀴즈를 맞춰 간식을 모으고 빠르게 달려 최고 기록에 도전하세요.',
        accentColor: '#a855f7',
        tagColor: 'rgba(168,85,247,0.15)',
    },
    {
        name: '강아지대소동',
        emoji: '🐾',
        imageSrc: '/title/puppy-chaos.svg',
        titleImageSrc: '/title/puppy-chaos.svg',
        keywords: ['🐶 강아지 대소동', '🎯 미션 달성', '⚡ 스피드 플레이', '🎉 협동 재미'],
        description: '강아지들과 함께 퀴즈 미션을 해결하며 대소동을 즐겨보세요!',
        accentColor: '#f43f5e',
        tagColor: 'rgba(244,63,94,0.15)',
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
    const [animationsReady, setAnimationsReady] = useState(false)
    const dragStartX = useRef(0)

    useEffect(() => {
        setAnimationsReady(true)
    }, [])

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
                    initial={animationsReady ? { opacity: 0, y: 20 } : false}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    className="text-center mb-14"
                >
                    <h2
                        className="text-4xl md:text-5xl font-black mb-4"
                        style={{
                            color: '#ffffff',
                            WebkitTextStroke: '5px #1e3a8a',
                            paintOrder: 'stroke fill',
                            textShadow: '3px 3px 0 rgba(10, 20, 80, 0.35)',
                        }}
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
                            initial={animationsReady ? 'enter' : false}
                            animate={animationsReady ? 'center' : undefined}
                            exit="exit"
                            transition={{ duration: 0.38, ease: [0.32, 0.72, 0, 1] }}
                            className="grid gap-6 items-center lg:grid-cols-[1.35fr_1fr]"
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
                                className="toss-card texture-grain relative rounded-3xl overflow-hidden aspect-video min-h-[180px] sm:min-h-[220px] lg:min-h-[280px] select-none transition-shadow duration-300"
                                style={{
                                    backgroundColor: 'rgba(255,255,255,0.55)',
                                    backdropFilter: 'blur(20px)',
                                    WebkitBackdropFilter: 'blur(20px)',
                                    border: '1px solid rgba(255,255,255,0.9)',
                                    transform: 'translateZ(0)',
                                }}
                            >
                                <VideoOrImage game={game} />
                                {/* Gloss top line */}
                                <div
                                    className="absolute inset-x-0 top-0 h-px"
                                    style={{ backgroundImage: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.9), transparent)' }}
                                />
                                {/* Game name badge */}
                                <div
                                    className="toss-depth-plastic absolute bottom-4 left-4 flex items-center gap-2 px-4 py-2 rounded-full"
                                    style={{
                                        backgroundColor: 'rgba(255,255,255,0.75)',
                                        backdropFilter: 'blur(12px)',
                                        WebkitBackdropFilter: 'blur(12px)',
                                        border: '1px solid rgba(255,255,255,0.95)',
                                    }}
                                >
                                    {game.titleImageSrc && (
                                        <Image
                                            src={game.titleImageSrc}
                                            alt={game.name}
                                            width={360}
                                            height={108}
                                            className="h-12 w-auto max-w-[180px] object-contain"
                                        />
                                    )}
                                </div>
                            </div>

                            {/* RIGHT: Keywords & Description */}
                            <div className="flex flex-col items-center gap-4 px-2 text-center lg:items-start lg:gap-6 lg:text-left">
                                <div>
                                    <div className="mb-4">
                                        {game.titleImageSrc && (
                                            <Image
                                                src={game.titleImageSrc}
                                                alt={game.name}
                                                width={780}
                                                height={264}
                                                className="h-28 w-auto max-w-full object-contain sm:h-36 md:h-40 lg:h-64"
                                            />
                                        )}
                                    </div>
                                    <p className="text-sky-700/70 text-base leading-relaxed">{game.description}</p>
                                    <Link
                                        href="/teacher"
                                        className="mt-5 inline-flex items-center justify-center rounded-full px-8 py-3 text-base font-bold text-white transition-[filter] duration-200 ease-in-out hover:brightness-90"
                                        style={{ backgroundColor: PRIMARY_COLOR }}
                                    >
                                        지금 플레이하기
                                    </Link>
                                </div>

                                {/* Dots */}
                                <div className="flex items-center gap-2 mt-2">
                                    {games.map((_, i) => (
                                        <button
                                            key={i}
                                            onClick={() => { setDirection(i > current ? 1 : -1); setCurrent(i) }}
                                            aria-label={`${i + 1}번째 게임`}
                                            className="shrink-0 rounded-full"
                                            style={{
                                                width: i === current ? 24 : 8,
                                                height: 8,
                                                backgroundColor: i === current ? PRIMARY_COLOR : '#B0BEC5',
                                                transition: 'width 0.3s ease, background-color 0.3s ease',
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
                        className="toss-depth-plastic absolute left-0 top-1/2 -translate-y-1/2 -translate-x-5 md:-translate-x-7 z-10 w-12 h-12 rounded-full flex items-center justify-center transition-all duration-200 ease-in-out hover:scale-110 hover:shadow-lg active:scale-95"
                        style={{
                            backgroundColor: 'rgba(255,255,255,0.8)',
                            backdropFilter: 'blur(12px)',
                            WebkitBackdropFilter: 'blur(12px)',
                            border: '1px solid rgba(255,255,255,0.95)',
                        }}
                    >
                        <ChevronLeft className="w-5 h-5 text-sky-600" />
                    </button>
                    <button
                        onClick={() => go(1)}
                        className="toss-depth-plastic absolute right-0 top-1/2 -translate-y-1/2 translate-x-5 md:translate-x-7 z-10 w-12 h-12 rounded-full flex items-center justify-center transition-all duration-200 ease-in-out hover:scale-110 hover:shadow-lg active:scale-95"
                        style={{
                            backgroundColor: 'rgba(255,255,255,0.8)',
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
    const [hasVideoError, setHasVideoError] = useState(false)

    useEffect(() => {
        setHasVideoError(false)
    }, [game.videoSrc])

    if (game.videoSrc && !hasVideoError) {
        return (
            <video
                ref={videoRef}
                key={game.videoSrc}
                src={game.videoSrc}
                autoPlay
                loop
                muted
                playsInline
                className="absolute inset-0 w-full h-full object-cover"
                onError={() => {
                    setHasVideoError(true)
                }}
            />
        )
    }

    return (
        <Image
            src={game.imageSrc}
            alt={game.name}
            fill
            className="absolute inset-0 object-cover"
            sizes="(max-width: 768px) 100vw, 50vw"
        />
    )
}
