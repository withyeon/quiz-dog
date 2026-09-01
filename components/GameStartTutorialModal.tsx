'use client'

import { useEffect } from 'react'
import Image from 'next/image'
import { ArrowLeft, ArrowRight, Check, EyeOff, Play, X } from 'lucide-react'
import { getGameModeConfig, type GameModeId } from '@/lib/game/modes'
import { getGameTutorial } from '@/lib/game/tutorials'
import GoldQuestTutorialDemo from '@/components/GoldQuestTutorialDemo'
import { GAME_DEMO_REGISTRY } from '@/components/tutorial/gameDemos'
import { TutorialStepProvider } from '@/components/tutorial/TutorialDemoFrame'

type GameStartTutorialModalProps = {
  gameMode: GameModeId
  isOpen: boolean
  stepIndex: number
  role: 'teacher' | 'student'
  hideNextTime?: boolean
  onHideNextTimeChange?: (value: boolean) => void
  onStepChange?: (stepIndex: number) => void
  onStart?: () => void
  onClose?: () => void
}

export default function GameStartTutorialModal({
  gameMode,
  isOpen,
  stepIndex,
  role,
  hideNextTime = false,
  onHideNextTimeChange,
  onStepChange,
  onStart,
  onClose,
}: GameStartTutorialModalProps) {
  const tutorial = getGameTutorial(gameMode)
  const mode = getGameModeConfig(gameMode)
  const safeStepIndex = Math.min(Math.max(stepIndex, 0), Math.max(tutorial.slides.length - 1, 0))
  const slide = tutorial.slides[safeStepIndex]
  const isTeacher = role === 'teacher'
  const isFirst = safeStepIndex === 0
  const isLast = safeStepIndex >= tutorial.slides.length - 1
  const lastStep = Math.max(tutorial.slides.length - 1, 0)
  // 선생님만 슬라이드를 넘긴다. 학생 화면은 tutorial:slide 이벤트로 따라온다.
  const canControlSteps = isTeacher && Boolean(onStepChange)

  // 교실 TV에서는 리모컨/키보드로 넘기는 편이 편하다.
  useEffect(() => {
    if (!isOpen || !canControlSteps) return

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'ArrowRight' || event.key === 'PageDown') {
        event.preventDefault()
        onStepChange?.(Math.min(safeStepIndex + 1, lastStep))
      } else if (event.key === 'ArrowLeft' || event.key === 'PageUp') {
        event.preventDefault()
        onStepChange?.(Math.max(safeStepIndex - 1, 0))
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [canControlSteps, isOpen, lastStep, onStepChange, safeStepIndex])

  if (!isOpen || !slide) return null

  const goToStep = (nextStep: number) => {
    onStepChange?.(Math.min(Math.max(nextStep, 0), tutorial.slides.length - 1))
  }

  // 전체화면 + 자동 재생 플레이 영상 데모 (게임별)
  const DemoComponent = gameMode === 'gold_quest' ? GoldQuestTutorialDemo : GAME_DEMO_REGISTRY[gameMode]
  if (DemoComponent) {
    return (
      <div className="fixed inset-0 z-[60] flex flex-col bg-[#071821] text-white">
        {/* 헤더 */}
        <div className="flex items-center justify-between gap-4 border-b border-white/10 px-5 py-4 sm:px-8">
          <div className="flex min-w-0 items-center gap-4">
            <div className="relative flex h-14 w-20 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-white/5 ring-1 ring-white/10">
              {mode.image ? (
                <Image src={mode.image} alt={mode.label} fill className="object-contain p-1.5" sizes="80px" />
              ) : (
                <span className="text-3xl">{mode.emoji}</span>
              )}
            </div>
            <div className="min-w-0">
              <p className="text-xs font-black tracking-wide text-amber-400 sm:text-sm">
                {isTeacher ? '게임 시작 전 — 이렇게 플레이해요' : '선생님이 플레이 방법을 보여주는 중'}
              </p>
              <h2 className="mt-0.5 truncate text-2xl font-black tracking-normal text-white sm:text-3xl">
                {tutorial.title}
              </h2>
              <p className="hidden text-sm font-bold text-white/60 sm:block">{tutorial.subtitle}</p>
            </div>
          </div>
          {isTeacher && onClose && (
            <button
              type="button"
              onClick={onClose}
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-white/60 transition hover:bg-white/10 hover:text-white"
              aria-label="튜토리얼 닫기"
            >
              <X className="h-5 w-5" />
            </button>
          )}
        </div>

        {/* 본문: 좌측 플레이 영상 / 우측 규칙 요약 */}
        <div className="flex min-h-0 flex-1 flex-col gap-5 overflow-y-auto p-5 sm:p-8 lg:flex-row lg:overflow-hidden">
          {/* 왼쪽 영상은 오른쪽 규칙과 같은 순서로 움직인다 */}
          <div className="relative min-h-[560px] flex-1 lg:min-h-0">
            <TutorialStepProvider value={{ stepIndex: safeStepIndex, stepCount: tutorial.slides.length }}>
              <DemoComponent />
            </TutorialStepProvider>
          </div>

          <div className="flex w-full flex-col gap-4 lg:w-[400px] lg:shrink-0">
            <div className="flex items-center gap-1.5">
              {tutorial.slides.map((item, index) => (
                <div
                  key={item.title}
                  className={`h-1.5 flex-1 rounded-full transition-colors ${
                    index <= safeStepIndex ? 'bg-amber-400' : 'bg-white/20'
                  }`}
                />
              ))}
            </div>

            <div className="flex items-center justify-between">
              <p className="text-sm font-black text-amber-400">핵심 규칙</p>
              <p className="text-sm font-black text-white/45">
                {safeStepIndex + 1} / {tutorial.slides.length}
              </p>
            </div>

            {/* 지금 설명할 규칙 한 장만 크게 */}
            <div className="rounded-2xl border border-white/10 bg-white/[0.06] p-6">
              <div className="flex items-start gap-3">
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-amber-400 text-xl font-black text-[#17262a]">
                  {safeStepIndex + 1}
                </span>
                <h3 className="mt-1 text-2xl font-black leading-tight text-white sm:text-3xl">{slide.title}</h3>
              </div>
              <p className="mt-4 text-lg font-bold leading-8 text-white/75 sm:text-xl">{slide.body}</p>
            </div>

            {!isLast && (
              <div className="rounded-2xl border border-white/5 bg-white/[0.02] px-5 py-3">
                <p className="text-xs font-black tracking-wide text-white/35">다음</p>
                <p className="mt-1 truncate text-base font-black text-white/50">
                  {tutorial.slides[safeStepIndex + 1].title}
                </p>
              </div>
            )}
          </div>
        </div>

        {/* 푸터 컨트롤 */}
        <div className="flex flex-col gap-4 border-t border-white/10 px-5 py-4 sm:px-8 lg:flex-row lg:items-center lg:justify-between">
          {isTeacher ? (
            <label className="flex cursor-pointer items-center gap-3 text-sm font-bold text-white/70">
              <input
                type="checkbox"
                checked={hideNextTime}
                onChange={(event) => onHideNextTimeChange?.(event.target.checked)}
                className="h-4 w-4 rounded border-white/30 bg-transparent text-amber-400 focus:ring-amber-400"
              />
              앞으로 이 게임은 튜토리얼 안보기
            </label>
          ) : (
            <div className="flex items-center gap-2 rounded-xl bg-white/10 px-3 py-2 text-sm font-black text-white/70">
              <EyeOff className="h-4 w-4" />
              선생님이 시작할 때까지 기다려주세요
            </div>
          )}

          {isTeacher && (
            <div className="flex flex-wrap items-center gap-2">
              <span className="mr-1 hidden text-xs font-bold text-white/35 xl:inline">← → 키로도 넘겨요</span>
              <button
                type="button"
                onClick={() => goToStep(safeStepIndex - 1)}
                disabled={isFirst}
                className="inline-flex h-12 w-12 items-center justify-center rounded-xl border border-white/15 text-white/70 transition hover:bg-white/10 hover:text-white disabled:cursor-not-allowed disabled:opacity-30"
                aria-label="이전 규칙"
              >
                <ArrowLeft className="h-5 w-5" />
              </button>
              <button
                type="button"
                onClick={() => goToStep(safeStepIndex + 1)}
                disabled={isLast}
                className="inline-flex h-12 items-center justify-center gap-2 rounded-xl border border-white/15 px-5 text-base font-black text-white transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-30"
              >
                다음
                <ArrowRight className="h-5 w-5" />
              </button>
              <button
                type="button"
                onClick={onStart}
                className="inline-flex h-12 items-center justify-center gap-2 rounded-xl bg-amber-400 px-6 text-base font-black text-[#17262a] shadow-lg shadow-amber-500/20 transition hover:bg-amber-300"
              >
                <Play className="h-5 w-5" fill="currentColor" />
                게임 시작
              </button>
            </div>
          )}
        </div>
      </div>
    )
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/70 px-4 py-6 backdrop-blur-sm">
      <div className="flex max-h-[92vh] w-full max-w-4xl flex-col overflow-hidden rounded-lg bg-white shadow-2xl ring-1 ring-black/10">
        <div className="flex items-start justify-between gap-4 border-b border-slate-100 px-5 py-4 sm:px-6">
          <div className="flex min-w-0 items-start gap-4">
            <div className="relative flex h-16 w-24 shrink-0 items-center justify-center rounded-lg bg-slate-50 ring-1 ring-slate-200">
              {mode.image ? (
                <Image
                  src={mode.image}
                  alt={mode.label}
                  fill
                  className="object-contain p-2"
                  sizes="96px"
                />
              ) : (
                <span className="text-4xl">{mode.emoji}</span>
              )}
            </div>
            <div className="min-w-0">
              <p className="text-sm font-black text-sky-500">
                {isTeacher ? '게임 시작 전 튜토리얼' : '선생님이 튜토리얼을 보여주는 중'}
              </p>
              <h2 className="mt-1 text-2xl font-black tracking-normal text-black sm:text-3xl">
                {tutorial.title}
              </h2>
              <p className="mt-1 text-sm font-bold leading-6 text-slate-500">{tutorial.subtitle}</p>
            </div>
          </div>
          {isTeacher && onClose && (
            <button
              type="button"
              onClick={onClose}
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-slate-400 transition hover:bg-slate-100 hover:text-black"
              aria-label="튜토리얼 닫기"
            >
              <X className="h-5 w-5" />
            </button>
          )}
        </div>

        <div className="overflow-y-auto px-5 py-5 sm:px-6">
          <div className="mb-5 flex items-center gap-2">
            {tutorial.slides.map((item, index) => (
              <div
                key={item.title}
                className={`h-2 flex-1 rounded-full ${index <= safeStepIndex ? 'bg-sky-500' : 'bg-slate-200'}`}
              />
            ))}
          </div>

          <div className="grid gap-6 lg:grid-cols-[220px_minmax(0,1fr)]">
            <div className="rounded-lg bg-slate-50 p-4 ring-1 ring-slate-200">
              <div className="text-sm font-black text-slate-400">
                SLIDE {safeStepIndex + 1} / {tutorial.slides.length}
              </div>
              <div className="mt-3 text-xl font-black text-black">{slide.title}</div>
              <div className="mt-4 grid h-28 place-items-center rounded-lg bg-white text-sky-500 ring-1 ring-slate-200">
                {safeStepIndex === 0 ? (
                  <Play className="h-12 w-12" />
                ) : safeStepIndex === 1 ? (
                  <Check className="h-12 w-12" />
                ) : (
                  <ArrowRight className="h-12 w-12" />
                )}
              </div>
            </div>

            <div className="rounded-lg border border-slate-200 bg-white p-5">
              <h3 className="text-2xl font-black tracking-normal text-black">{slide.title}</h3>
              <p className="mt-3 text-base font-bold leading-7 text-slate-600">{slide.body}</p>
              {slide.points && slide.points.length > 0 && (
                <div className="mt-5 grid gap-3 sm:grid-cols-3">
                  {slide.points.map((point, index) => (
                    <div key={point} className="rounded-lg bg-slate-50 p-4 ring-1 ring-slate-200">
                      <div className="mb-2 flex h-7 w-7 items-center justify-center rounded-lg bg-sky-500 text-sm font-black text-white">
                        {index + 1}
                      </div>
                      <p className="text-sm font-black leading-6 text-slate-700">{point}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="flex flex-col gap-4 border-t border-slate-100 bg-white px-5 py-4 sm:px-6 lg:flex-row lg:items-center lg:justify-between">
          {isTeacher ? (
            <label className="flex cursor-pointer items-center gap-3 text-sm font-bold text-slate-600">
              <input
                type="checkbox"
                checked={hideNextTime}
                onChange={(event) => onHideNextTimeChange?.(event.target.checked)}
                className="h-4 w-4 rounded border-slate-300 text-black focus:ring-black"
              />
              앞으로 이 게임은 튜토리얼 안보기
            </label>
          ) : (
            <div className="flex items-center gap-2 rounded-lg bg-slate-100 px-3 py-2 text-sm font-black text-slate-500">
              <EyeOff className="h-4 w-4" />
              선생님이 시작할 때까지 기다려주세요
            </div>
          )}

          <div className="flex flex-wrap gap-2">
            {isTeacher && (
              <>
                <button
                  type="button"
                  onClick={onStart}
                  className="inline-flex h-11 items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white px-4 text-sm font-black text-slate-600 transition hover:bg-slate-50 hover:text-black"
                >
                  <Play className="h-4 w-4" />
                  바로 시작
                </button>
                <button
                  type="button"
                  onClick={() => goToStep(safeStepIndex - 1)}
                  disabled={isFirst}
                  className="inline-flex h-11 w-11 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
                  aria-label="이전 슬라이드"
                >
                  <ArrowLeft className="h-5 w-5" />
                </button>
                {isLast ? (
                  <button
                    type="button"
                    onClick={onStart}
                    className="inline-flex h-11 items-center justify-center gap-2 rounded-lg bg-black px-5 text-sm font-black text-white transition hover:bg-neutral-800"
                  >
                    <Check className="h-4 w-4" />
                    게임 시작
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => goToStep(safeStepIndex + 1)}
                    className="inline-flex h-11 items-center justify-center gap-2 rounded-lg bg-black px-5 text-sm font-black text-white transition hover:bg-neutral-800"
                  >
                    다음
                    <ArrowRight className="h-4 w-4" />
                  </button>
                )}
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
