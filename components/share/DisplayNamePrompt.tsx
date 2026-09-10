'use client'

import { useEffect, useState } from 'react'
import { Loader2 } from 'lucide-react'
import { toast } from '@/components/ui/Toaster'
import { useAuth } from '@/contexts/AuthContext'
import { getMyDisplayName, saveMyDisplayName } from '@/lib/services/profiles'

const DISMISS_KEY = 'quizdog_display_name_prompt_dismissed'

/**
 * 표시 이름이 아직 없는 선생님에게 한 번 물어본다.
 *
 * 표시 이름은 공유 링크와 자료실에서 "원작: OO 선생님"으로 쓰인다.
 * 이름이 안 붙으면 공유할 이유가 약해지므로, 가입 이전에 만들어진 계정에도
 * 한 번은 물어봐야 한다. 다만 매번 뜨면 방해가 되니 "다음에"를 누르면 기억한다.
 */
export default function DisplayNamePrompt() {
  const { user, loading } = useAuth()
  const [open, setOpen] = useState(false)
  const [value, setValue] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (loading || !user) return

    let cancelled = false
    void (async () => {
      try {
        if (window.localStorage.getItem(DISMISS_KEY) === '1') return
      } catch {
        // localStorage 를 못 쓰는 브라우저면 그냥 물어본다.
      }

      const name = await getMyDisplayName()
      if (!cancelled && !name) setOpen(true)
    })()

    return () => { cancelled = true }
  }, [loading, user])

  const dismiss = () => {
    try {
      window.localStorage.setItem(DISMISS_KEY, '1')
    } catch {
      // 기억하지 못해도 동작에는 문제가 없다.
    }
    setOpen(false)
  }

  const save = async () => {
    if (saving) return
    const trimmed = value.trim()
    if (!trimmed) {
      toast.error('표시 이름을 입력해 주세요.')
      return
    }

    setSaving(true)
    try {
      await saveMyDisplayName(trimmed)
      toast.success('표시 이름을 저장했어요.')
      setOpen(false)
    } catch (error) {
      console.error('표시 이름 저장 실패:', error)
      toast.error('저장하지 못했어요. 잠시 후 다시 시도해 주세요.')
    } finally {
      setSaving(false)
    }
  }

  if (!open) return null

  return (
    <div className="fixed inset-0 z-[95] flex items-center justify-center bg-slate-950/[0.6] p-4">
      <div
        className="w-full max-w-md rounded-3xl bg-white p-6 shadow-xl"
        role="dialog"
        aria-modal="true"
        aria-label="표시 이름 설정"
      >
        <h2 className="text-xl font-black text-slate-900">어떤 이름으로 표시할까요?</h2>
        <p className="mt-2 text-sm font-medium leading-relaxed text-slate-600">
          문제집을 공유하면 <b>&quot;원작: OO 선생님&quot;</b>으로 표시돼요.
          다른 선생님이 누가 만든 자료인지 알 수 있어요.
        </p>

        <input
          type="text"
          value={value}
          onChange={(event) => setValue(event.target.value.slice(0, 20))}
          onKeyDown={(event) => { if (event.key === 'Enter') void save() }}
          placeholder="예: 위드현"
          maxLength={20}
          autoFocus
          className="mt-5 w-full rounded-xl border-2 border-slate-200 px-4 py-3 text-base font-semibold text-slate-900 placeholder-slate-400 outline-none transition focus:border-sky-400"
        />

        <div className="mt-5 flex gap-3">
          <button
            type="button"
            onClick={dismiss}
            className="flex-1 rounded-xl border-2 border-slate-200 py-3 font-bold text-slate-600 transition hover:bg-slate-50"
          >
            다음에
          </button>
          <button
            type="button"
            onClick={save}
            disabled={saving}
            className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl bg-sky-500 py-3 font-black text-white transition hover:bg-sky-600 disabled:opacity-60"
          >
            {saving && <Loader2 className="h-4 w-4 animate-spin" />}
            저장하기
          </button>
        </div>
      </div>
    </div>
  )
}
