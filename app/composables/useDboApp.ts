// 앱 API(dbo) 호출 — 어드민에 없는 기능을 앱 엔드포인트로 쓴다. 공지 발송(QA 2026-10-14 15번)·날씨 휴무
import type { CancelResult, CreateResult, HolidayOverview, RangeCancelResult, RangeCreateResult } from '~/utils/holidays'
import type { ManagerMonthlyReport } from '~/utils/managerReport'
import type { NoticeReader, NoticeReadStats, NoticeResendResult, NoticeUnreadPerson } from '~/utils/managerNotices'
import { NotSentError } from '~/utils/managerKnowledge'

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
    method: 'GET' | 'POST' | 'PATCH',
    path: string,
    body?: Record<string, any>,
  ): Promise<T> {
    const {
      data: { session },
    } = await supabase.auth.getSession()
    // 보내지 않은 것이 확실한 실패는 NotSentError — 쓰기 화면이 「저장됐는지 모름」과 가른다(`isMaybeSaved`)
    if (!session) throw new NotSentError('세션이 없습니다. 다시 로그인해 주세요.')
    if (navigator.onLine === false) throw new NotSentError('인터넷에 연결되어 있지 않습니다. 연결을 확인해 주세요.')
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
    // ── 담당자 PC(QA 2026-11-07 MGR-01·02·05) — 앱과 같은 API·권한이다. 범위는 서버가 맡은 근무지로 정한다

    /** 공지 열람 집계. 보낸 본인은 받은 사람 전체, 지금 담당자는 맡은 근무지 사람만 */
    noticeReadStats: (id: string) => call<NoticeReadStats>('GET', `/notices/${id}/read-stats`),
    /** 미열람자. `cooldownUntil` 이 있으면 그때까지 다시 보낼 수 없다(30분) */
    noticeUnread: (id: string) => call<{ stats: NoticeReadStats; people: NoticeUnreadPerson[] }>('GET', `/notices/${id}/unread`),
    noticeReaders: (id: string) => call<{ stats: NoticeReadStats; people: NoticeReader[] }>('GET', `/notices/${id}/readers`),
    /** 미열람자 다시 알리기 — 아직 안 읽었고 30분 안에 다시 보내지 않은 사람에게만 간다(나머지는 skipped) */
    resendNotice: (id: string, directoryIds: string[]) =>
      post<NoticeResendResult>(`/notices/${id}/resend`, { directoryIds }),
    /** 채팅 보내기 — 본인이 든 방만(서버가 멤버인지 본다) */
    sendMessage: (roomId: string, body: string) =>
      post<{ id: string; created_at: string }>(`/rooms/${roomId}/messages`, { body }),
    /**
     * FAQ 등록 — 검토 중으로 저장되고 master 가 승인해야 AI 답변에 쓰인다. 비슷한 질문은 10개·200자까지.
     * 근무지는 맡은 곳만, 빈 배열은 기관 전체
     */
    createFaq: (body: { question: string; answer: string; category?: string | null; paraphrases?: string[]; worksiteIds?: string[] }) =>
      post<{ id: string }>('/faqs', body),
    /** AI 문서 등록(추출한 글) — 근무지는 맡은 곳만, 빈 배열은 기관 전체. 같은 파일명이면 409 */
    createDocument: (body: { filename: string; body: string; kind?: string; byteSize?: number | null; worksiteIds?: string[] }) =>
      post<{ id: string }>('/documents', body),
    /** 문서 「제외」·「다시 사용」 — 제외해도 검색 조각은 남아 다시 사용하면 바로 근거로 돌아온다 */
    setDocumentExcluded: (id: string, excluded: boolean) =>
      call<{ id: string; excluded: boolean }>('PATCH', `/documents/${id}`, { excluded }),
    /** AI 가 아직 읽지 못한(검색 조각이 없는) 문서 id(결정 D16) */
    preparingDocuments: () => call<{ ids: string[] }>('GET', '/documents/preparing'),
    /** 참여자 메모 — 담당자는 맡은 사람에게 쓴다 */
    addMemberNote: (directoryId: string, body: string) =>
      post<{ id: string; body: string; created_at: string; author_name: string | null }>(`/directory/${directoryId}/notes`, { body }),

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
    /** 기간 휴무 지정(결정 D20) — 시작일은 내일 이후, 최대 31일 */
    createHolidayRange: (from: string, to: string, worksiteIds: string[]) =>
      post<RangeCreateResult>('/holidays/ranges', { from, to, worksiteIds }),
    /** 기간 휴무 취소 — 내일 이후 날만 풀린다 */
    cancelHolidayRange: (id: string) =>
      post<RangeCancelResult>(`/holidays/ranges/${id}/cancel`, {}),
    /**
     * 담당자 월간 리포트 — 앱 내정보 > 리포트와 같은 API(QA 2026-11-07 MGR-04 · 결정 D4). 근무지 1~100곳.
     * 담당자는 맡은 근무지만 세고 맡지 않은 곳은 빼서 `scope.dropped` 로 알린다(서버 판정). 정렬해 보낸다 — 같은 범위가 같은 주소
     */
    monthlyReport: (month: string, worksiteIds: string[]) =>
      call<ManagerMonthlyReport>('GET', `/reports/monthly?month=${month}&worksiteIds=${[...worksiteIds].sort().join(',')}`),
  }
}
