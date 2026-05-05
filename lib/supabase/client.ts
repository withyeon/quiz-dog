import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/types/database.types'

const SUPABASE_PUBLIC_KEY_ENV_HINT =
  'NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY (or legacy NEXT_PUBLIC_SUPABASE_ANON_KEY)'

// 환경 변수 가져오기 (클라이언트/서버 모두에서 동작)
const getSupabaseUrl = () => process.env.NEXT_PUBLIC_SUPABASE_URL

const getSupabasePublicKey = () =>
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

const supabaseUrl = getSupabaseUrl()
const supabasePublicKey = getSupabasePublicKey()

// 환경 변수 확인 및 디버깅
if (typeof window !== 'undefined') {
  if (!supabaseUrl || !supabasePublicKey) {
    console.error('❌ Supabase 환경 변수 누락:', {
      hasUrl: !!supabaseUrl,
      hasKey: !!supabasePublicKey,
      url: supabaseUrl ? `${supabaseUrl.substring(0, 20)}...` : 'undefined',
      allEnvKeys: Object.keys(process.env).filter(key => key.includes('SUPABASE')),
    })
  } else {
    console.log('✅ Supabase 환경 변수 로드 성공:', {
      url: supabaseUrl.substring(0, 30) + '...',
      keyLength: supabasePublicKey.length,
    })
  }
}

// 환경 변수가 있을 때만 제대로 타입이 전파되도록 클라이언트 생성
export const supabase: SupabaseClient<Database> = supabaseUrl && supabasePublicKey
  ? createClient<Database>(supabaseUrl, supabasePublicKey, {
      realtime: {
        params: {
          eventsPerSecond: 10,
        },
      },
      auth: {
        persistSession: true,
        autoRefreshToken: true,
      },
    })
  : createClient<Database>(
      'https://placeholder.supabase.co',
      'placeholder-key',
      {
        realtime: {
          params: {
            eventsPerSecond: 10,
          },
        },
      }
    )

/** 클라우드·로컬 CLI 등에서 쓰는 Supabase REST URL인지 확인 */
function isAllowedSupabaseApiUrl(url: string): boolean {
  try {
    const u = new URL(url)
    const host = u.hostname
    if (host === 'localhost' || host === '127.0.0.1') {
      return u.protocol === 'http:' || u.protocol === 'https:'
    }
    if (host.endsWith('.supabase.co') && u.protocol === 'https:') return true
    return false
  } catch {
    return false
  }
}

function isLocalSupabaseUrl(url: string): boolean {
  return url.includes('127.0.0.1') || url.includes('localhost')
}

function isLegacySupabaseJwtKey(key: string): boolean {
  return key.startsWith('eyJ') && key.split('.').length === 3
}

function isAllowedSupabasePublicKey(key: string, url: string): boolean {
  if (key.startsWith('sb_secret_')) return false
  if (isLocalSupabaseUrl(url)) return key.length >= 32
  if (key.startsWith('sb_publishable_')) return key.length > 'sb_publishable_'.length
  return isLegacySupabaseJwtKey(key)
}

// 환경 변수 확인 헬퍼 함수
export function checkSupabaseConfig(): { isValid: boolean; error?: string } {
  const url = getSupabaseUrl()
  const key = getSupabasePublicKey()
  
  if (!url || !key) {
    return {
      isValid: false,
      error: `Supabase 환경 변수가 설정되지 않았습니다. NEXT_PUBLIC_SUPABASE_URL과 ${SUPABASE_PUBLIC_KEY_ENV_HINT}를 .env.local 파일에 설정해주세요.`,
    }
  }

  if (url.includes('placeholder.supabase.co') || key === 'placeholder-key') {
    return {
      isValid: false,
      error:
        `Supabase가 기본 placeholder로 연결되어 있습니다. .env.local에 실제 NEXT_PUBLIC_SUPABASE_URL과 ${SUPABASE_PUBLIC_KEY_ENV_HINT}를 넣은 뒤 개발 서버를 다시 시작하세요.`,
    }
  }
  
  // URL 형식 검증 (클라우드: https://xxx.supabase.co, 로컬: http://127.0.0.1:54321 등)
  if (!isAllowedSupabaseApiUrl(url)) {
    return {
      isValid: false,
      error:
        'Supabase URL 형식이 올바르지 않습니다. 클라우드: https://your-project.supabase.co, 로컬 CLI: http://127.0.0.1:54321',
    }
  }
  
  if (key.startsWith('sb_secret_')) {
    return {
      isValid: false,
      error:
        '브라우저 공개용 키에는 secret key를 사용할 수 없습니다. NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY 또는 legacy NEXT_PUBLIC_SUPABASE_ANON_KEY를 사용해주세요.',
    }
  }

  // 새 publishable key(sb_publishable_...)와 legacy anon JWT 모두 허용
  if (!isAllowedSupabasePublicKey(key, url)) {
    return {
      isValid: false,
      error:
        'Supabase 공개 키 형식이 올바르지 않습니다. sb_publishable_... 또는 legacy anon JWT를 확인해주세요.',
    }
  }
  
  return { isValid: true }
}

// Supabase 연결 테스트 함수
export async function testSupabaseConnection(): Promise<{ success: boolean; error?: string }> {
  try {
    const configCheck = checkSupabaseConfig()
    if (!configCheck.isValid) {
      return { success: false, error: configCheck.error }
    }

    // 간단한 쿼리로 연결 테스트
    const { data, error } = await supabase
      .from('rooms')
      .select('room_code')
      .limit(1)

    if (error) {
      console.error('Supabase 연결 테스트 실패:', error)
      return {
        success: false,
        error: `Supabase 연결 실패: ${error.message || '알 수 없는 오류'}`,
      }
    }

    console.log('✅ Supabase 연결 테스트 성공')
    return { success: true }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : '알 수 없는 오류'
    console.error('Supabase 연결 테스트 중 예외 발생:', error)
    return {
      success: false,
      error: `연결 테스트 실패: ${errorMessage}`,
    }
  }
}
