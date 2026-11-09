// 앱 API(dbo) 호출 — 어드민에 없는 기능을 앱 엔드포인트로 쓴다. 공지 발송(QA 2026-10-14 15번)·날씨 휴무
import type { CancelResult, CreateResult, HolidayOverview } from '~/utils/holidays'
import type { ManagerMonthlyReport } from '~/utils/managerReport'

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
    /**
     * 같은 requestId 로 다시 보내면 서버가 먼저 만든 공지를 돌려준다(duplicate: true).
     * 개인 공지(`directoryIds`)의 201 에는 `excluded`(고른 사람 중 받지 않은 명부 id)가 붙는다(서버 2026-11-04)
     */
    createNotice: (body: ReturnType<typeof buildNoticeBody>) =>
      post<{ id: string; duplicate?: boolean; excluded?: string[] }>('/notices', body),
    /**
     * 그 근무지 공지의 받는 사람 수. 발송과 같은 함수로 센다(서버 `noticeRecipients`).
     * 근무지 하나씩만 받는다 — 여러 곳은 `recipientTotal` 을 먼저 쓰고, 그 길이 없는 옛 서버에서만 이것으로 센다.
     */
    recipientCount: (worksiteId: string) =>
      call<{ total: number; withoutPush: number }>('GET', `/worksites/${worksiteId}/recipients`),
    /**
     * 여러 근무지의 받는 사람 수를 한 번에(서버 2026-11-04). 두 곳 이상에 배정된 분은 한 번만 센다 — 발송과 같다.
     * 1~100곳. 옛 서버에는 없는 길이라 404 다.
     */
    recipientTotal: (worksiteIds: string[]) =>
      call<{ total: number; withoutPush: number }>('GET', `/worksites/recipients?worksiteIds=${worksiteIds.join(',')}`),
    /**
     * 개인으로 고른 받는 사람 수(서버 2026-11-04, QA ANOTICE-03). 발송과 같이 활성 시니어만 센다. 1~100명.
     * 옛 서버는 404(경로 없음)거나 400(근무지 칸 없음)이다 — `peopleCountFailure`
     */
    recipientTotalPeople: (directoryIds: string[]) =>
      call<{ total: number; withoutPush: number }>('GET', `/worksites/recipients?directoryIds=${directoryIds.join(',')}`),
    /** 그 날짜(없으면 내일)의 날씨 판정·근무지별 인원·휴무. master 는 전부, 담당자는 맡은 곳 */
    holidayOverview: (date?: string) =>
      call<HolidayOverview>('GET', date ? `/holidays?date=${date}` : '/holidays'),
    createHolidays: (date: string, worksiteIds: string[]) =>
      post<CreateResult>('/holidays', { date, worksiteIds }),
    cancelHoliday: (id: string) =>
      post<CancelResult>(`/holidays/${id}/cancel`, {}),
    /**
     * 담당자 월간 리포트 — 앱 내정보 > 리포트와 같은 API(QA 2026-11-07 MGR-04 · 결정 D4). 근무지 1~100곳.
     * 담당자는 맡은 근무지만 세고 맡지 않은 곳은 빼서 `scope.dropped` 로 알린다(서버 판정). 정렬해 보낸다 — 같은 범위가 같은 주소
     */
    monthlyReport: (month: string, worksiteIds: string[]) =>
      call<ManagerMonthlyReport>('GET', `/reports/monthly?month=${month}&worksiteIds=${[...worksiteIds].sort().join(',')}`),
  }
}
