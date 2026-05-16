'use client'

import { useCallback, useEffect, useState } from 'react'
import { supabase, checkSupabaseConfig } from '@/lib/supabase/client'
import type { PuppyChaosEvent } from '@/lib/services/강아지대소동Events'

type RefreshOptions = {
  silent?: boolean
}

export function usePuppyChaosEvents(sessionId: string, enabled = true) {
  const [events, setEvents] = useState<PuppyChaosEvent[]>([])
  const [loading, setLoading] = useState(true)

  const refreshEvents = useCallback(async ({ silent = false }: RefreshOptions = {}) => {
    if (!enabled || !sessionId) {
      setEvents([])
      setLoading(false)
      return
    }

    const configCheck = checkSupabaseConfig()
    if (!configCheck.isValid) {
      setEvents([])
      setLoading(false)
      return
    }

    if (!silent) setLoading(true)
    const { data, error } = await (supabase
      .from('events') as any)
      .select('*')
      .eq('session_id', sessionId)
      .order('created_at', { ascending: false })
      .limit(30)

    if (!error) {
      setEvents((data ?? []) as PuppyChaosEvent[])
    }
    setLoading(false)
  }, [enabled, sessionId])

  useEffect(() => {
    if (!enabled || !sessionId) {
      setEvents([])
      setLoading(false)
      return
    }

    void refreshEvents()

    const channel = supabase
      .channel(`puppy-chaos-events:${sessionId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'events',
          filter: `session_id=eq.${sessionId}`,
        },
        (payload) => {
          if (!payload.new) return
          setEvents((prev) => [payload.new as PuppyChaosEvent, ...prev].slice(0, 30))
        },
      )
      .subscribe((status) => {
        if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
          void refreshEvents({ silent: true })
        }
      })

    return () => {
      supabase.removeChannel(channel)
    }
  }, [enabled, refreshEvents, sessionId])

  return { events, loading, refreshEvents }
}
