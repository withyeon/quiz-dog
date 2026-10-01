'use client'

import Link from 'next/link'
import Image from 'next/image'
import { motion } from 'framer-motion'
import { Globe, ListChecks, Lock, Pencil, Play, Plus } from 'lucide-react'

interface SaveSuccessPanelProps {
  setId: string
  title: string
  questionCount: number
  subject: string
  grade: string
  isPublic: boolean
  onCreateAnother: () => void
}

/**
 * 저장 직후 화면. 예전에는 목록으로 바로 보내 버려서 "이제 어디서 게임을 시작하지?"가 됐다.
 * 선생님이 다음에 하고 싶은 일(게임 시작 · 더 고치기 · 하나 더 만들기)을 바로 고르게 한다.
 */
export default function SaveSuccessPanel({
  setId,
  title,
  questionCount,
  subject,
  grade,
  isPublic,
  onCreateAnother,
}: SaveSuccessPanelProps) {
  return (
    <main className="text-black">
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        className="mx-auto max-w-2xl"
      >
        <div className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
          <div className="bg-gradient-to-b from-sky-50 to-white px-6 pb-6 pt-8 text-center">
            <Image
              src="/assets/icons/mascot-pome-clap-320.webp"
              alt=""
              width={128}
              height={128}
              unoptimized
              className="mx-auto h-32 w-32 object-contain"
              priority
            />
            <h1 className="mt-2 text-2xl font-black tracking-tight text-slate-900 sm:text-3xl">문제집을 저장했어요</h1>
            <p className="mt-3 text-lg font-black text-slate-800">{title}</p>
            <div className="mt-2 flex flex-wrap items-center justify-center gap-1.5 text-xs font-bold">
              <span className="rounded-full bg-slate-100 px-2.5 py-1 text-slate-700">{questionCount}문제</span>
              {grade && <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-emerald-700">{grade}</span>}
              {subject && <span className="rounded-full bg-sky-50 px-2.5 py-1 text-sky-700">{subject}</span>}
              <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 ${isPublic ? 'bg-amber-50 text-amber-700' : 'bg-slate-100 text-slate-600'}`}>
                {isPublic ? <Globe className="h-3 w-3" /> : <Lock className="h-3 w-3" />}
                {isPublic ? '자료실 공개' : '나만 보기'}
              </span>
            </div>
          </div>

          <div className="grid gap-3 px-6 pb-6 sm:grid-cols-2">
            <Link
              href={`/teacher/play?set=${encodeURIComponent(setId)}`}
              className="flex h-14 items-center justify-center gap-2 rounded-xl bg-sky-500 text-base font-black text-white shadow-sm shadow-sky-200 transition hover:bg-sky-600 sm:col-span-2"
            >
              <Play className="h-5 w-5" />
              이 문제집으로 게임 시작
            </Link>
            <Link
              href={`/teacher/sets/${encodeURIComponent(setId)}/edit`}
              className="flex h-12 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white text-sm font-black text-slate-700 transition hover:border-sky-300 hover:text-sky-700"
            >
              <Pencil className="h-4 w-4" />
              문제 더 고치기
            </Link>
            <button
              type="button"
              onClick={onCreateAnother}
              className="flex h-12 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white text-sm font-black text-slate-700 transition hover:border-sky-300 hover:text-sky-700"
            >
              <Plus className="h-4 w-4" />
              새 문제집 만들기
            </button>
            <Link
              href="/teacher"
              className="flex h-11 items-center justify-center gap-2 text-sm font-bold text-slate-400 transition hover:text-slate-700 sm:col-span-2"
            >
              <ListChecks className="h-4 w-4" />
              내 문제집 목록으로
            </Link>
          </div>
        </div>
      </motion.div>
    </main>
  )
}
