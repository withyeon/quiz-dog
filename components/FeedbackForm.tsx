'use client'

import { useState } from 'react'
import { Loader2, Send, CheckCircle2 } from 'lucide-react'

const CATEGORIES = [
  { value: 'general', label: '일반 문의' },
  { value: 'bug', label: '오류/버그' },
  { value: 'question_error', label: '문제 오류' },
  { value: 'payment', label: '결제' },
  { value: 'suggestion', label: '제안' },
  { value: 'other', label: '기타' },
]

export default function FeedbackForm() {
  const [category, setCategory] = useState('general')
  const [message, setMessage] = useState('')
  const [contact, setContact] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [done, setDone] = useState(false)
  const [error, setError] = useState('')

  const submit = async () => {
    if (!message.trim()) {
      setError('내용을 입력해주세요.')
      return
    }
    setSubmitting(true)
    setError('')
    try {
      const res = await fetch('/api/feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          category,
          message,
          contact: contact || null,
          page_url: typeof window !== 'undefined' ? window.location.href : null,
        }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error || '제출 실패')
      setDone(true)
    } catch (e) {
      setError(e instanceof Error ? e.message : '제출에 실패했습니다.')
    } finally {
      setSubmitting(false)
    }
  }

  if (done) {
    return (
      <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-8 text-center">
        <CheckCircle2 className="mx-auto mb-3 h-10 w-10 text-emerald-500" />
        <h3 className="text-lg font-semibold text-emerald-800">접수되었습니다!</h3>
        <p className="mt-1 text-sm text-emerald-700">빠르게 확인 후 답변드리겠습니다. 감사합니다.</p>
      </div>
    )
  }

  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-6 sm:p-8">
      <h2 className="mb-1 text-xl font-bold text-[#1e3a8a]">바로 문의 남기기</h2>
      <p className="mb-5 text-sm text-gray-500">아래 양식으로 보내주시면 이메일/전화로 답변드립니다.</p>

      <div className="space-y-4">
        <div>
          <label className="mb-1.5 block text-sm font-medium text-gray-700">문의 유형</label>
          <div className="flex flex-wrap gap-2">
            {CATEGORIES.map((c) => (
              <button
                key={c.value}
                type="button"
                onClick={() => setCategory(c.value)}
                className={`rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
                  category === c.value
                    ? 'bg-[#1e3a8a] text-white'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                {c.label}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="mb-1.5 block text-sm font-medium text-gray-700">내용</label>
          <textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            rows={5}
            maxLength={2000}
            placeholder="문의하실 내용을 자세히 적어주세요."
            className="w-full resize-none rounded-xl border border-gray-200 px-3 py-2.5 outline-none focus:border-[#1e3a8a] focus:ring-2 focus:ring-blue-100"
          />
        </div>

        <div>
          <label className="mb-1.5 block text-sm font-medium text-gray-700">
            답변 받을 연락처 <span className="font-normal text-gray-400">(선택 · 이메일 또는 전화)</span>
          </label>
          <input
            value={contact}
            onChange={(e) => setContact(e.target.value)}
            placeholder="example@email.com"
            className="w-full rounded-xl border border-gray-200 px-3 py-2.5 outline-none focus:border-[#1e3a8a] focus:ring-2 focus:ring-blue-100"
          />
        </div>

        {error && <p className="text-sm text-red-500">{error}</p>}

        <button
          type="button"
          onClick={submit}
          disabled={submitting}
          className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#1e3a8a] py-3 font-semibold text-white hover:bg-[#1b3275] disabled:opacity-50"
        >
          {submitting ? <Loader2 className="h-5 w-5 animate-spin" /> : <Send className="h-4 w-4" />}
          문의 보내기
        </button>
      </div>
    </div>
  )
}
