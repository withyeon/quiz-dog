'use client'

import { useEffect, useState } from 'react'
import { CheckCircle2, XCircle, Info, X } from 'lucide-react'

type ToastVariant = 'success' | 'error' | 'info'

export type ToastItem = {
  id: number
  message: string
  variant: ToastVariant
}

type Listener = (toasts: ToastItem[]) => void

// 모듈 레벨 스토어 — 라우트 이동(같은 레이아웃 내)에도 토스트가 유지된다.
let toasts: ToastItem[] = []
const listeners = new Set<Listener>()
let nextId = 1

function emit() {
  listeners.forEach((listener) => listener(toasts))
}

function remove(id: number) {
  toasts = toasts.filter((toast) => toast.id !== id)
  emit()
}

function push(message: string, variant: ToastVariant) {
  const id = nextId++
  toasts = [...toasts, { id, message, variant }]
  emit()
  setTimeout(() => remove(id), 3200)
  return id
}

/** 어디서든 호출 가능한 토스트 헬퍼 (alert 대체) */
export const toast = {
  success: (message: string) => push(message, 'success'),
  error: (message: string) => push(message, 'error'),
  info: (message: string) => push(message, 'info'),
}

const VARIANT_STYLE: Record<ToastVariant, { ring: string; icon: typeof CheckCircle2; iconColor: string }> = {
  success: { ring: 'ring-emerald-200', icon: CheckCircle2, iconColor: 'text-emerald-500' },
  error: { ring: 'ring-red-200', icon: XCircle, iconColor: 'text-red-500' },
  info: { ring: 'ring-sky-200', icon: Info, iconColor: 'text-sky-500' },
}

export function Toaster() {
  const [items, setItems] = useState<ToastItem[]>(toasts)

  useEffect(() => {
    const listener: Listener = (next) => setItems([...next])
    listeners.add(listener)
    setItems([...toasts])
    return () => {
      listeners.delete(listener)
    }
  }, [])

  if (items.length === 0) return null

  return (
    <div className="pointer-events-none fixed inset-x-0 top-4 z-[100] flex flex-col items-center gap-2 px-4">
      {items.map((item) => {
        const style = VARIANT_STYLE[item.variant]
        const Icon = style.icon
        return (
          <div
            key={item.id}
            role="status"
            className={`pointer-events-auto flex w-full max-w-md items-start gap-3 rounded-xl bg-white px-4 py-3 shadow-lg ring-1 ${style.ring} animate-in fade-in slide-in-from-top-2`}
          >
            <Icon className={`mt-0.5 h-5 w-5 flex-shrink-0 ${style.iconColor}`} />
            <p className="flex-1 whitespace-pre-line text-sm font-bold leading-5 text-slate-800">
              {item.message}
            </p>
            <button
              type="button"
              onClick={() => remove(item.id)}
              className="flex-shrink-0 rounded-md p-0.5 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
              aria-label="닫기"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        )
      })}
    </div>
  )
}
