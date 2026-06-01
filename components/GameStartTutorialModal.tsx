'use client'

import Image from 'next/image'
import { ArrowLeft, ArrowRight, Check, EyeOff, Play, X } from 'lucide-react'
import { getGameModeConfig, type GameModeId } from '@/lib/game/modes'
import { getGameTutorial } from '@/lib/game/tutorials'

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

  if (!isOpen || !slide) return null

  const goToStep = (nextStep: number) => {
    onStepChange?.(Math.min(Math.max(nextStep, 0), tutorial.slides.length - 1))
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
