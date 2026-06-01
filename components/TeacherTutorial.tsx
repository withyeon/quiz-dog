'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import {
  BarChart3,
  BookOpen,
  Check,
  Library,
  PlayCircle,
  Plus,
  X,
} from 'lucide-react'

const TUTORIAL_STORAGE_KEY = 'quizdog.teacherTutorial.hidden'

type TeacherTutorialProps = {
  openSignal: number
}

const tutorialSteps = [
  {
    title: '문제집 만들기',
    description: '직접 쓰거나 AI 초안으로 시작해서 오늘 수업에 맞는 퀴즈를 저장합니다.',
    icon: Plus,
  },
  {
    title: '자료실에서 고르기',
    description: '바로 쓸 수 있는 샘플을 담아 수정하거나 그대로 게임을 열 수 있습니다.',
    icon: Library,
  },
  {
    title: '게임 시작',
    description: '문제집과 게임 모드를 고른 뒤 학생에게 입장 코드를 보여주세요.',
    icon: PlayCircle,
  },
  {
    title: '결과 확인',
    description: '끝난 게임은 히스토리에 남고, 학생별 정답 흐름을 다시 볼 수 있습니다.',
    icon: BarChart3,
  },
]

export default function TeacherTutorial({ openSignal }: TeacherTutorialProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [hideNextTime, setHideNextTime] = useState(false)

  useEffect(() => {
    const hidden = window.localStorage.getItem(TUTORIAL_STORAGE_KEY) === 'true'
    if (!hidden) {
      setIsOpen(true)
    }
  }, [])

  useEffect(() => {
    if (openSignal > 0) {
      setHideNextTime(false)
      setIsOpen(true)
    }
  }, [openSignal])

  const closeTutorial = () => {
    if (hideNextTime) {
      window.localStorage.setItem(TUTORIAL_STORAGE_KEY, 'true')
    }
    setIsOpen(false)
  }

  const showNextTime = () => {
    window.localStorage.removeItem(TUTORIAL_STORAGE_KEY)
    setHideNextTime(false)
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 px-4 py-6">
      <div className="w-full max-w-3xl overflow-hidden rounded-lg bg-white shadow-2xl ring-1 ring-black/10">
        <div className="flex items-start justify-between border-b border-slate-100 px-6 py-5">
          <div className="flex items-start gap-4">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-sky-50 text-sky-600">
              <BookOpen className="h-6 w-6" />
            </div>
            <div>
              <p className="text-sm font-black text-slate-400">선생님 튜토리얼</p>
              <h2 className="mt-1 text-2xl font-black tracking-normal text-black">
                퀴즈독 수업 흐름 한눈에 보기
              </h2>
              <p className="mt-2 text-sm font-bold leading-6 text-slate-500">
                문제집을 만들고, 게임을 열고, 결과를 확인하는 기본 순서입니다.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={closeTutorial}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-slate-400 transition hover:bg-slate-100 hover:text-black"
            aria-label="튜토리얼 닫기"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="grid gap-3 px-6 py-5 sm:grid-cols-2">
          {tutorialSteps.map((step, index) => (
            <div key={step.title} className="rounded-lg border border-slate-200 bg-slate-50 p-4">
              <div className="flex items-start gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-white text-slate-700 ring-1 ring-slate-200">
                  <step.icon className="h-5 w-5" />
                </div>
                <div>
                  <div className="text-xs font-black text-slate-400">STEP {index + 1}</div>
                  <h3 className="mt-1 text-base font-black text-black">{step.title}</h3>
                  <p className="mt-1 text-sm font-medium leading-6 text-slate-500">{step.description}</p>
                </div>
              </div>
            </div>
          ))}
        </div>

        <div className="flex flex-col gap-4 border-t border-slate-100 bg-white px-6 py-5 sm:flex-row sm:items-center sm:justify-between">
          <label className="flex cursor-pointer items-center gap-3 text-sm font-bold text-slate-600">
            <input
              type="checkbox"
              checked={hideNextTime}
              onChange={(event) => setHideNextTime(event.target.checked)}
              className="h-4 w-4 rounded border-slate-300 text-black focus:ring-black"
            />
            다음부터 자동으로 띄우지 않기
          </label>

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={showNextTime}
              className="flex h-10 items-center justify-center rounded-lg px-4 text-sm font-black text-slate-500 transition hover:bg-slate-100 hover:text-black"
            >
              계속 자동으로 보기
            </button>
            <Link
              href="/teacher/create"
              onClick={closeTutorial}
              className="flex h-10 items-center justify-center gap-2 rounded-lg bg-black px-4 text-sm font-black text-white transition hover:bg-neutral-800"
            >
              <Check className="h-4 w-4" />
              시작하기
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}
