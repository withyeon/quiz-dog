'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { AlertTriangle } from 'lucide-react'

export type ConfirmOptions = {
  title?: string
  message: string
  confirmLabel?: string
  cancelLabel?: string
  /** 삭제 등 되돌릴 수 없는 작업이면 true — 확인 버튼이 빨간색이 된다 */
  destructive?: boolean
}

type PendingConfirm = ConfirmOptions & { resolve: (ok: boolean) => void }

let requestConfirm: ((options: ConfirmOptions) => Promise<boolean>) | null = null

/**
 * 네이티브 confirm() 대체. Provider가 마운트돼 있지 않으면 안전하게 false를 반환한다
 * (되돌릴 수 없는 작업이 사용자 확인 없이 실행되지 않도록).
 */
export function confirmAsync(options: ConfirmOptions): Promise<boolean> {
  if (!requestConfirm) {
    console.warn('[confirm:not-mounted]', options.message)
    return Promise.resolve(false)
  }
  return requestConfirm(options)
}

export function ConfirmDialogProvider({ children }: { children: React.ReactNode }) {
  const [pending, setPending] = useState<PendingConfirm | null>(null)
  const pendingRef = useRef<PendingConfirm | null>(null)

  const open = useCallback((options: ConfirmOptions) => {
    return new Promise<boolean>((resolve) => {
      // 이전 요청이 남아 있으면 취소 처리
      pendingRef.current?.resolve(false)
      const next = { ...options, resolve }
      pendingRef.current = next
      setPending(next)
    })
  }, [])

  useEffect(() => {
    requestConfirm = open
    return () => { requestConfirm = null }
  }, [open])

  const answer = useCallback((ok: boolean) => {
    const current = pendingRef.current
    pendingRef.current = null
    setPending(null)
    current?.resolve(ok)
  }, [])

  // ESC로 취소
  useEffect(() => {
    if (!pending) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') answer(false) }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [pending, answer])

  return (
    <>
      {children}
      <AnimatePresence>
        {pending && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[110] flex items-center justify-center bg-slate-950/60 p-5 backdrop-blur-sm"
            onClick={() => answer(false)}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.94, y: -16 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.97, y: 10 }}
              transition={{ type: 'spring', damping: 22 }}
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-sm rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl"
              role="alertdialog"
              aria-modal="true"
            >
              <div className="mb-4 flex items-start gap-3">
                <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${pending.destructive ? 'bg-rose-100' : 'bg-sky-100'}`}>
                  <AlertTriangle className={`h-5 w-5 ${pending.destructive ? 'text-rose-600' : 'text-sky-600'}`} />
                </div>
                <div className="flex-1">
                  <h2 className="text-base font-black text-slate-900">
                    {pending.title ?? '확인이 필요해요'}
                  </h2>
                  <p className="mt-1 text-sm font-medium leading-snug text-slate-600">
                    {pending.message}
                  </p>
                </div>
              </div>

              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => answer(false)}
                  className="rounded-xl border-2 border-slate-200 bg-white px-4 py-2 text-sm font-black text-slate-700 transition hover:bg-slate-50"
                >
                  {pending.cancelLabel ?? '취소'}
                </button>
                <button
                  type="button"
                  autoFocus
                  onClick={() => answer(true)}
                  className={`rounded-xl px-4 py-2 text-sm font-black text-white shadow-lg transition ${
                    pending.destructive
                      ? 'bg-rose-600 shadow-rose-200 hover:bg-rose-700'
                      : 'bg-sky-600 shadow-sky-200 hover:bg-sky-700'
                  }`}
                >
                  {pending.confirmLabel ?? '확인'}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  )
}
