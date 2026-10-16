'use client'

import { useEffect, useState } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { getTeacherAccessToken } from '@/lib/services/questionImages'

export type TeacherPlanInfo = {
  plan: 'free' | 'pro'
  /** 프로가 끝나는 때(ISO). 무료면 null */
  proUntil: string | null
}

export type TeacherPlanState = TeacherPlanInfo & {
  /** 아직 서버에서 확인하지 못했으면 true (그동안은 무료로 본다) */
  loading: boolean
}

/** 이용 코드 등록 등으로 요금제가 바뀌었을 때 화면 곳곳(사이드바·요금제 페이지)에 알리는 이벤트 */
export const TEACHER_PLAN_UPDATED_EVENT = 'teacher-plan:updated'

const FREE: TeacherPlanInfo = { plan: 'free', proUntil: null }

// 같은 선생님의 요금제는 한 번만 묻는다. 사이드바·헤더·요금제 페이지가 각자 불러도 요청은 하나.
let cache: { userId: string; info: TeacherPlanInfo } | null = null
let inflight: { userId: string; promise: Promise<TeacherPlanInfo> } | null = null

async function fetchTeacherPlan(userId: string): Promise<TeacherPlanInfo> {
  if (cache?.userId === userId) return cache.info
  if (inflight?.userId === userId) return inflight.promise
  const promise = (async () => {
    try {
      const token = await getTeacherAccessToken()
      if (!token) return FREE
      const res = await fetch('/api/teacher/plan', { headers: { Authorization: `Bearer ${token}` }, cache: 'no-store' })
      if (!res.ok) return FREE
      const data = (await res.json()) as Partial<TeacherPlanInfo>
      const info: TeacherPlanInfo = data.plan === 'pro' ? { plan: 'pro', proUntil: data.proUntil ?? null } : FREE
      cache = { userId, info }
      return info
    } catch {
      return FREE
    } finally {
      if (inflight?.userId === userId) inflight = null
    }
  })()
  inflight = { userId, promise }
  return promise
}

/** 요금제가 바뀐 뒤 부른다. 캐시를 비우고 쓰는 화면들이 다시 읽게 한다. 알고 있는 새 값은 바로 넣는다. */
export function notifyTeacherPlanChanged(next?: TeacherPlanInfo) {
  cache = null
  inflight = null
  if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent(TEACHER_PLAN_UPDATED_EVENT, { detail: next ?? null }))
}

/**
 * 로그인한 선생님의 요금제(프로/무료, 만료일). 프로 배지·요금제 페이지의 "현재 플랜" 표시에 쓴다.
 * 요금제 조회가 실패하면 무료로 본다 — 표시용이라 수업을 막으면 안 된다.
 */
export function useTeacherPlan(): TeacherPlanState {
  const { user } = useAuth()
  const userId = user?.id ?? null
  const [state, setState] = useState<TeacherPlanState>(() =>
    userId && cache?.userId === userId ? { ...cache.info, loading: false } : { ...FREE, loading: Boolean(userId) },
  )

  useEffect(() => {
    if (!userId) {
      setState({ ...FREE, loading: false })
      return
    }
    let cancelled = false
    const load = () => {
      void fetchTeacherPlan(userId).then((info) => {
        if (!cancelled) setState({ ...info, loading: false })
      })
    }
    load()
    const onUpdated = (e: Event) => {
      const next = (e as CustomEvent<TeacherPlanInfo | null>).detail
      if (next) {
        cache = { userId, info: next }
        setState({ ...next, loading: false })
      } else {
        load()
      }
    }
    window.addEventListener(TEACHER_PLAN_UPDATED_EVENT, onUpdated)
    return () => {
      cancelled = true
      window.removeEventListener(TEACHER_PLAN_UPDATED_EVENT, onUpdated)
    }
  }, [userId])

  return state
}
