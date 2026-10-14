// 앱 API(dbo) 호출 — 어드민에 없는 기능을 앱 엔드포인트로 쓴다. 지금은 공지 발송 하나(QA 2026-10-14 15번)

/**
 * `useDboAdmin` 은 주소가 dbo-admin 으로 고정이라 따로 둔다. 인증은 같다 —
 * 앱 함수도 같은 Supabase 세션 토큰을 받고 CORS 가 열려 있다. 권한은 서버가
 * `dbo_profiles.role` 로 판정한다(manager·master 만).
 */
export function useDboApp() {
  const supabase = useSupabase()
  const config = useRuntimeConfig()
  const base = `${config.public.supabaseUrl}/functions/v1/dbo`

  async function post<T>(path: string, body: Record<string, any>): Promise<T> {
    const {
      data: { session },
    } = await supabase.auth.getSession()
    if (!session) throw new Error('세션이 없습니다. 다시 로그인해 주세요.')
    return await $fetch<T>(`${base}${path}`, {
      method: 'POST',
      body,
      headers: {
        Authorization: `Bearer ${session.access_token}`,
        apikey: config.public.supabaseAnonKey as string,
      },
    })
  }

  return {
    /** 같은 requestId 로 다시 보내면 서버가 먼저 만든 공지를 돌려준다(duplicate: true) */
    createNotice: (body: ReturnType<typeof buildNoticeBody>) =>
      post<{ id: string; duplicate?: boolean }>('/notices', body),
  }
}
