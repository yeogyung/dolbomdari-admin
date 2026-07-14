// 브라우저 전용 Supabase(anon) 클라이언트 — 로그인/세션 관리에만 사용 (데이터 접근은 자체 서버 API)
import { createClient, type SupabaseClient } from '@supabase/supabase-js'

let client: SupabaseClient | null = null

export function useSupabase(): SupabaseClient {
  if (client) return client
  const config = useRuntimeConfig()
  client = createClient(
    config.public.supabaseUrl as string,
    config.public.supabaseAnonKey as string,
    {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: false,
      },
    },
  )
  return client
}
