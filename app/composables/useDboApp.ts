// 앱 API(dbo) 호출 — 어드민에 없는 기능을 앱 엔드포인트로 쓴다. 공지 발송(QA 2026-10-14 15번)·날씨 휴무
import type { CreateResult, HolidayOverview } from '~/utils/holidays'

/**
 * `useDboAdmin` 은 주소가 dbo-admin 으로 고정이라 따로 둔다. 인증은 같다 —
 * 앱 함수도 같은 Supabase 세션 토큰을 받고 CORS 가 열려 있다. 권한은 서버가
 * `dbo_profiles.role` 로 판정한다(manager·master 만).
 */
export function useDboApp() {
  const supabase = useSupabase()
  const config = useRuntimeConfig()
  const base = `${config.public.supabaseUrl}/functions/v1/dbo`

  async function call<T>(
    method: 'GET' | 'POST',
    path: string,
    body?: Record<string, any>,
  ): Promise<T> {
    const {
      data: { session },
    } = await supabase.auth.getSession()
    if (!session) throw new Error('세션이 없습니다. 다시 로그인해 주세요.')
    return await $fetch<T>(`${base}${path}`, {
      method,
      body,
      headers: {
        Authorization: `Bearer ${session.access_token}`,
        apikey: config.public.supabaseAnonKey as string,
      },
    })
  }
  const post = <T>(path: string, body: Record<string, any>) => call<T>('POST', path, body)

  return {
    /** 같은 requestId 로 다시 보내면 서버가 먼저 만든 공지를 돌려준다(duplicate: true) */
    createNotice: (body: ReturnType<typeof buildNoticeBody>) =>
      post<{ id: string; duplicate?: boolean }>('/notices', body),
    /** 그 날짜(없으면 내일)의 날씨 판정·근무지별 인원·휴무. master 는 전부, 담당자는 맡은 곳 */
    holidayOverview: (date?: string) =>
      call<HolidayOverview>('GET', date ? `/holidays?date=${date}` : '/holidays'),
    createHolidays: (date: string, worksiteIds: string[]) =>
      post<CreateResult>('/holidays', { date, worksiteIds }),
    cancelHoliday: (id: string) => post<{ canceled: true }>(`/holidays/${id}/cancel`, {}),
  }
}
