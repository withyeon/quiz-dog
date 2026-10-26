'use client'

import { useEffect, useState } from 'react'
import VocabStudyApp from '@/components/vocab/study/VocabStudyApp'
import VocabEditor from '@/components/vocab/VocabEditor'

/**
 * 단어장 미리보기 — DB 없이 학생 공부 화면(app/cards/[code])과 선생님 편집기를 띄워 본다.
 * ?view=study(기본)|editor
 * 공부 기록은 진짜 화면처럼 localStorage(quizdog:vocab:dev-vocab)에 남는다. ?reset=1 이면 지우고 시작.
 */

const CARDS = [
  ['apple', '사과'],
  ['library', '도서관'],
  ['brave', '용감한'],
  ['borrow', '빌리다'],
  ['island', '섬'],
  ['journey', '여행, 여정'],
  ['ancient', '고대의'],
  ['whisper', '속삭이다'],
  ['tomorrow', '내일'],
  ['neighbor', '이웃'],
].map(([term, definition], index) => ({ id: `card-${index}`, term, definition }))

export default function VocabPreviewPage() {
  const [view, setView] = useState<'study' | 'editor' | null>(null)

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    if (params.get('reset') === '1') {
      try { window.localStorage.removeItem('quizdog:vocab:dev-vocab') } catch { /* 저장소 막힘 */ }
    }
    setView(params.get('view') === 'editor' ? 'editor' : 'study')
  }, [])

  if (view === 'editor') {
    return (
      <div className="min-h-dvh bg-slate-50 p-6">
        <VocabEditor initial={{ title: '중1 영어 3단원 단어', subject: '', grade: '', isPublic: true, cards: CARDS.slice(0, 3) }} />
      </div>
    )
  }
  if (view === 'study') {
    return (
      <VocabStudyApp
        set={{ id: 'dev-vocab', title: '중1 영어 3단원 단어', subject: '영어', grade: '중1', ownerName: '퀴즈독', cards: CARDS }}
      />
    )
  }
  return null
}
