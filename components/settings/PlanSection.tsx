'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { Loader2, Ticket } from 'lucide-react'
import { toast } from '@/components/ui/Toaster'
import { getTeacherAccessToken } from '@/lib/services/questionImages'

type PlanInfo = { plan: 'free' | 'pro'; proUntil: string | null }

function formatDate(value: string) {
  return new Date(value).toLocaleDateString('ko-KR', { year: 'numeric', month: 'long', day: 'numeric' })
}

/**
 * 내 정보 → 내 플랜. 지금 요금제와 이용 코드 등록.
 * 이용 코드는 위드현에듀테크 납품 때 계정마다 1개씩 드리는 프로 1개월 코드다(납품정보서·메일에 적혀 있음).
 * quizdog.kr/redeem?code=… 로 들어오면 코드를 채워 두고 이 칸으로 내려 준다 — 선생님은 '등록'만 누르면 된다.
 */
export default function PlanSection({
  initialCode,
  inputClass,
}: {
  initialCode: string
  inputClass: string
}) {
  const [planInfo, setPlanInfo] = useState<PlanInfo | null>(null)
  const [code, setCode] = useState(initialCode)
  const [saving, setSaving] = useState(false)
  const ref = useRef<HTMLElement>(null)

  const loadPlan = useCallback(async () => {
    const token = await getTeacherAccessToken()
    if (!token) return
    try {
      const res = await fetch('/api/teacher/plan', { headers: { Authorization: `Bearer ${token}` } })
      if (res.ok) setPlanInfo(await res.json())
    } catch {
      // 요금제 표시는 실패해도 코드 등록은 할 수 있다
    }
  }, [])

  useEffect(() => {
    void loadPlan()
  }, [loadPlan])

  useEffect(() => {
    if (initialCode) ref.current?.scrollIntoView({ behavior: 'smooth', block: 'center' })
  }, [initialCode])

  const handleRedeem = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!code.trim()) return
    setSaving(true)
    try {
      const token = await getTeacherAccessToken()
      if (!token) {
        toast.error('다시 로그인한 뒤 시도해 주세요.')
        return
      }
      const res = await fetch('/api/teacher/promo-code', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ code }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        toast.error(data.error || '등록하지 못했어요. 잠시 후 다시 시도해 주세요.')
        return
      }
      setCode('')
      if (data.proUntil) setPlanInfo({ plan: 'pro', proUntil: data.proUntil })
      toast.success(data.proUntil ? `등록했어요. ${formatDate(data.proUntil)}까지 프로를 이용할 수 있어요.` : '등록했어요.')
    } catch {
      toast.error('등록하지 못했어요. 잠시 후 다시 시도해 주세요.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <section ref={ref} id="plan" className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      <div className="flex items-center gap-2">
        <Ticket className="h-5 w-5 text-slate-400" />
        <h2 className="text-lg font-black text-slate-900">내 플랜</h2>
      </div>
      <div className="mt-3 rounded-lg bg-slate-50 px-4 py-3 text-sm font-bold text-slate-700">
        {planInfo === null
          ? '확인하는 중…'
          : planInfo.plan === 'pro' && planInfo.proUntil
            ? `Pro · ${formatDate(planInfo.proUntil)}까지`
            : 'Free'}
      </div>

      <form onSubmit={handleRedeem} className="mt-4">
        <label className="mb-1.5 block text-sm font-bold text-slate-700">이용 코드 등록</label>
        <p className="mb-3 text-sm font-medium text-slate-500">
          위드현에듀테크에서 받은 코드를 입력하면 Pro 기간이 더해져요.
        </p>
        <div className="flex flex-col gap-3 sm:flex-row">
          <input
            type="text"
            value={code}
            onChange={(e) => setCode(e.target.value)}
            placeholder="PXXX-XXXX-XXXX-XXXX"
            autoComplete="off"
            spellCheck={false}
            className={`${inputClass} font-mono uppercase`}
          />
          <button
            type="submit"
            disabled={saving || !code.trim()}
            className="flex shrink-0 items-center justify-center gap-2 whitespace-nowrap rounded-lg bg-black px-5 py-2.5 text-sm font-black text-white transition hover:bg-neutral-800 disabled:opacity-50"
          >
            {saving && <Loader2 className="h-4 w-4 animate-spin" />}
            등록
          </button>
        </div>
      </form>
    </section>
  )
}
