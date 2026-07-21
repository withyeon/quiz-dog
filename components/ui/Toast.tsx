'use client'

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { AlertTriangle, CheckCircle2, Info, X, XCircle } from 'lucide-react'

export type ToastTone = 'success' | 'error' | 'warning' | 'info'

export type ToastOptions = {
  /** 자동으로 사라지기까지의 시간(ms). 0이면 수동으로 닫을 때까지 유지 */
  durationMs?: number
}

type ToastItem = {
  id: number
  message: string
  tone: ToastTone
}

type ToastContextValue = {
  showToast: (message: string, tone?: ToastTone, options?: ToastOptions) => void
  dismissToast: (id: number) => void
}

const ToastContext = createContext<ToastContextValue | null>(null)

/**
 * 훅을 쓸 수 없는 곳(이벤트 핸들러 유틸, 클래스 밖 함수 등)에서도
 * 토스트를 띄울 수 있도록 하는 모듈 레벨 버스.
 * ToastProvider가 마운트되면 실제 구현이 연결된다.
 */
let emitToast: ((message: string, tone: ToastTone, options?: ToastOptions) => void) | null = null

export function notify(message: string, tone: ToastTone = 'info', options?: ToastOptions): void {
  if (emitToast) emitToast(message, tone, options)
  else console.warn('[toast:not-mounted]', message)
}

const TONE_STYLE: Record<ToastTone, { icon: typeof Info; ring: string; bg: string; text: string }> = {
  success: { icon: CheckCircle2, ring: 'border-emerald-300', bg: 'bg-emerald-50', text: 'text-emerald-900' },
  error: { icon: XCircle, ring: 'border-rose-300', bg: 'bg-rose-50', text: 'text-rose-900' },
  warning: { icon: AlertTriangle, ring: 'border-amber-300', bg: 'bg-amber-50', text: 'text-amber-900' },
  info: { icon: Info, ring: 'border-sky-300', bg: 'bg-sky-50', text: 'text-sky-900' },
}

/**
 * 네이티브 alert() 대체용 토스트.
 * alert은 JS 스레드를 막아 실시간 게임(타이머·realtime 수신)을 멈추게 하므로,
 * 학생/교사 대상 피드백은 모두 이 토스트를 사용한다.
 */
export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([])
  const seqRef = useRef(0)
  const timersRef = useRef(new Map<number, ReturnType<typeof setTimeout>>())

  const dismissToast = useCallback((id: number) => {
    setToasts((prev) => prev.filter((t) => t.id !== id))
    const timer = timersRef.current.get(id)
    if (timer) {
      clearTimeout(timer)
      timersRef.current.delete(id)
    }
  }, [])

  const showToast = useCallback((
    message: string,
    tone: ToastTone = 'info',
    options: ToastOptions = {},
  ) => {
    const { durationMs = 3600 } = options
    const id = ++seqRef.current
    setToasts((prev) => [...prev.slice(-2), { id, message, tone }])
    if (durationMs > 0) {
      timersRef.current.set(id, setTimeout(() => dismissToast(id), durationMs))
    }
  }, [dismissToast])

  // 모듈 레벨 notify()가 이 Provider로 연결되도록 등록
  useEffect(() => {
    emitToast = showToast
    return () => { emitToast = null }
  }, [showToast])

  const value = useMemo(() => ({ showToast, dismissToast }), [showToast, dismissToast])

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div
        className="pointer-events-none fixed inset-x-0 top-3 z-[100] flex flex-col items-center gap-2 px-3"
        role="status"
        aria-live="polite"
      >
        <AnimatePresence initial={false}>
          {toasts.map((toast) => {
            const style = TONE_STYLE[toast.tone]
            const Icon = style.icon
            return (
              <motion.div
                key={toast.id}
                initial={{ opacity: 0, y: -16, scale: 0.96 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -12, scale: 0.97 }}
                transition={{ type: 'spring', damping: 22, stiffness: 320 }}
                className={`pointer-events-auto flex w-full max-w-md items-start gap-3 rounded-2xl border-2 ${style.ring} ${style.bg} px-4 py-3 shadow-xl shadow-slate-900/10`}
              >
                <Icon className={`mt-0.5 h-5 w-5 shrink-0 ${style.text}`} />
                <p className={`flex-1 text-sm font-bold leading-snug ${style.text}`}>{toast.message}</p>
                <button
                  type="button"
                  onClick={() => dismissToast(toast.id)}
                  className={`shrink-0 rounded-lg p-1 transition hover:bg-black/5 ${style.text}`}
                  aria-label="알림 닫기"
                >
                  <X className="h-4 w-4" />
                </button>
              </motion.div>
            )
          })}
        </AnimatePresence>
      </div>
    </ToastContext.Provider>
  )
}

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext)
  if (!ctx) {
    // Provider 밖에서 호출돼도 앱이 죽지 않도록 콘솔 폴백
    return {
      showToast: (message) => console.warn('[toast:no-provider]', message),
      dismissToast: () => {},
    }
  }
  return ctx
}
