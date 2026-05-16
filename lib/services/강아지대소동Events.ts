import { supabase } from '@/lib/supabase/client'
import type { Database } from '@/types/database.types'

export type PuppyChaosEvent = Database['public']['Tables']['events']['Row']
export type PuppyChaosEventInsert = Database['public']['Tables']['events']['Insert']

export async function createPuppyChaosEvent(payload: PuppyChaosEventInsert): Promise<void> {
  const { error } = await (supabase
    .from('events') as any)
    .insert(payload)

  if (error) throw error
}
