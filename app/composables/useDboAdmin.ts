// 돌봄다리 운영센터 어드민 API(dbo-admin Edge Function) 클라이언트 — 세션 토큰 + anon key로 직접 호출
import type {
  AdminAccount,
  AdminRole,
  Assignment,
  AttendanceDeletion,
  AttendanceRequest,
  AttendanceRequestItem,
  AttendanceRequestStatus,
  AttendanceShift,
  AttendanceSummary,
  ChatMessage,
  ChatRoom,
  DirectoryEntry,
  LifeStatus,
  ListQuery,
  Paged,
  Program,
  Worksite,
  NoticeAuthor,
  NoticeSummary,
  NoticeDetail,
  NoticeRecipient,
  NoticeSms,
  PushSummary,
  FaqStatus,
  DocumentListItem,
  DocumentDetail,
  DocumentPatch,
  DocumentState,
  DocumentVersions,
  DocumentVersionCreated,
  MonthlyReport,
} from '~/types/dbo'
import type { DocumentCreateBody } from '~/utils/documentImport'
import type { RoomFilterQuery } from '~/utils/roomFilters'
import type { AttendanceDisplay } from '~/utils/attendanceState'
import { fetchAllPages } from '~/utils/paging'

/** Edge Function 오류 응답({ error })과 상태 코드를 사람이 읽는 한국어로 바꾼다 */
export function dboErrorMessage(e: any, fallback = '요청을 처리하지 못했습니다.'): string {
  const code: string | undefined = e?.data?.error
  const status: number | undefined = e?.status ?? e?.statusCode
  const suffix = code ? ` (${code})` : ''
  if (status === 401) return '로그인이 만료되었습니다. 다시 로그인해 주세요.'
  if (status === 403) return `권한이 없습니다. 운영관리자(master) 계정으로 로그인해 주세요.${suffix}`
  if (status === 404) return `대상을 찾을 수 없습니다.${suffix}`
  if (status === 409) return `이미 사용 중인 값입니다.${suffix}`
  if (status === 400) return `입력값을 확인해 주세요.${suffix}`
  return `${fallback}${suffix || (e?.message ? ` (${e.message})` : '')}`
}

export function useDboAdmin() {
  const supabase = useSupabase()
  const config = useRuntimeConfig()
  const base = `${config.public.supabaseUrl}/functions/v1/dbo-admin`

  async function req<T>(
    path: string,
    opts: {
      method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE'
      query?: Record<string, any>
      body?: Record<string, any>
    } = {},
  ): Promise<T> {
    const {
      data: { session },
    } = await supabase.auth.getSession()
    if (!session) throw new Error('세션이 없습니다. 다시 로그인해 주세요.')
    return await $fetch<T>(`${base}${path}`, {
      method: opts.method ?? 'GET',
      query: opts.query,
      body: opts.body,
      headers: {
        Authorization: `Bearer ${session.access_token}`,
        apikey: config.public.supabaseAnonKey as string,
      },
    })
  }

  // 빈 문자열·null 쿼리는 보내지 않는다 (서버 zod 검증에서 걸린다)
  function clean(q: Record<string, any>): Record<string, any> {
    const out: Record<string, any> = {}
    for (const [k, v] of Object.entries(q)) {
      if (v !== undefined && v !== null && v !== '') out[k] = v
    }
    return out
  }

  return {
    /* 공지 발송 채널·열람 관리 — master 전용 */
    listNotices: (q: ListQuery & { type?: string; authorId?: string } = {}) =>
      req<Paged<NoticeSummary>>('/notices', { query: clean(q) }),
    listNoticeAuthors: () => req<NoticeAuthor[]>('/notices/authors'),
    getNotice: (id: string) => req<NoticeDetail>(`/notices/${id}`),
    listNoticeRecipients: (id: string, q: ListQuery & { channel?: string; read?: string } = {}) =>
      req<Paged<NoticeRecipient>>(`/notices/${id}/recipients`, { query: clean(q) }),
    /**
     * 앱 푸시 접수·실제 전달 집계(서버 2026-11-04, QA PUSH-01). 공지 하나는 `kind=notice&linkId=<공지 id>`.
     * `since` 가 없으면 서버가 지난 7일만 센다. 옛 서버는 404
     */
    pushSummary: (q: { kind: string; linkId: string; since?: string }) =>
      req<PushSummary>('/push/summary', { query: clean(q) }),
    /**
     * 공지 문자 결과 목록(서버 2026-11-04, QA ANOTICE-05). `from`·`to` 는 보낸 날(서울), `result=failed` 는 접수 실패 + 수신 실패.
     * 옛 서버는 404
     */
    listSmsMessages: (
      q: { from?: string; to?: string; result?: 'all' | 'failed' | 'delivered' | 'pending' | 'unknown'; page?: number; size?: number } = {},
    ) => req<Paged<NoticeSms>>('/sms/messages', { query: clean(q) }),
    /* AI 문서 — master 전용. 상태(state)는 서버가 날짜로 계산한다. 본문을 고친 경우에만 재색인(indexed) */
    listDocuments: (q: ListQuery = {}) => req<Paged<DocumentListItem>>('/documents', { query: clean(q) }),
    getDocument: (id: string) => req<DocumentDetail>(`/documents/${id}`),
    createDocument: (body: DocumentCreateBody) =>
      req<{ id: string; indexed: boolean }>('/documents', { method: 'POST', body: { ...body } }),
    updateDocument: (id: string, body: DocumentPatch) =>
      req<{ ok: true; state: DocumentState; indexed?: boolean }>(`/documents/${id}`, { method: 'PATCH', body }),
    /**
     * 새 판 올리기·판 이력(서버 2026-11-04, QA DOC-02). `{id}` 는 이을 이전 판이고 본문은 등록과 같다. 서버가 이전 판의
     * 적용 범위를 잇고 종료일을 새 판 발효 전날로 적는다. 옛 서버는 404
     */
    createDocumentVersion: (id: string, body: DocumentCreateBody) =>
      req<DocumentVersionCreated>(`/documents/${id}/versions`, { method: 'POST', body: { ...body } }),
    listDocumentVersions: (id: string) => req<DocumentVersions>(`/documents/${id}/versions`),
    /* FAQ 승인·반려 — master 전용. 조회는 useFaqs(PostgREST 직접). enabled 는 서버가 status 에 맞춰 켜고 끈다 */
    updateFaqStatus: (id: string, status: FaqStatus) =>
      req<{ ok: true }>(`/faqs/${id}`, { method: 'PATCH', body: { status } }),
    /**
     * 질문·답변 고치기와 「사용 안 함 · 다시 사용」(QA 2026-11-07 ADMIN-10). 보낸 칸만 고친다. 서버는 FAQ 를 지우지 않는다 —
     * AI 답변에서 빼려면 enabled=false. 비슷한 질문은 받지 않고, 동시 수정 검사(expectedUpdatedAt)도 없다
     */
    updateFaq: (id: string, body: { question?: string; answer?: string; enabled?: boolean }) =>
      req<{ ok: true }>(`/faqs/${id}`, { method: 'PATCH', body }),
    /* 사업 — master 전용 */
    listPrograms: () => req<{ items: Program[] }>('/programs'),
    createProgram: (body: { name: string; color?: string }) =>
      req<{ id: string }>('/programs', { method: 'POST', body }),
    updateProgram: (id: string, body: { name?: string; color?: string; status?: LifeStatus }) =>
      req<{ ok: true }>(`/programs/${id}`, { method: 'PATCH', body }),

    /* 어드민 계정 — master 전용 */
    listAccounts: () => req<{ items: AdminAccount[] }>('/accounts'),
    createAccount: (body: {
      email: string
      password: string
      name: string
      role: AdminRole
      worksiteId?: string | null
    }) => req<{ directoryId: string; profileId: string }>('/accounts', { method: 'POST', body }),
    updateAccount: (
      id: string,
      body: { name?: string; worksiteId?: string | null; status?: LifeStatus },
    ) => req<{ ok: true }>(`/accounts/${id}`, { method: 'PATCH', body }),
    endAccount: (id: string) => req<{ ok: true }>(`/accounts/${id}`, { method: 'DELETE' }),

    /* 근무지 — 읽기는 master 전체·worksite 담당 한 곳, 쓰기는 master 전용 */
    listWorksites: (q: ListQuery & { programId?: string } = {}) =>
      req<Paged<Worksite>>('/worksites', { query: clean(q) }),
    /** 근무지 전부 — 서버 페이지 상한(100)을 넘어 이어 받는다. 고르는 화면은 이걸 쓴다 */
    listAllWorksites: () =>
      fetchAllPages(
        (page, size) => req<Paged<Worksite>>('/worksites', { query: { page, size, sort: 'name' } }),
        (w) => w.id,
      ),
    createWorksite: (body: {
      name: string
      programId?: string | null
      address?: string | null
      regionCode?: string | null
      managerDirectoryId?: string | null
      careManagerDirectoryId?: string | null
    }) => req<{ id: string; qrToken: string }>('/worksites', { method: 'POST', body }),
    updateWorksite: (
      id: string,
      body: {
        name?: string
        programId?: string | null
        address?: string | null
        regionCode?: string | null
        managerDirectoryId?: string | null
        careManagerDirectoryId?: string | null
        status?: LifeStatus
      },
    ) => req<{ ok: true }>(`/worksites/${id}`, { method: 'PATCH', body }),
    rotateWorksiteQr: (id: string) =>
      req<{ qrToken: string; rotatedAt: string }>(`/worksites/${id}/qr`, { method: 'POST' }),

    /* 명부(시니어·담당자) — master 전용 */
    listDirectory: (
      q: ListQuery & {
        status?: LifeStatus
        role?: 'senior' | 'manager' | 'worksite'
        /** 정렬 방향. 서버 기본 asc. 명부 목록만 받는다 */
        dir?: 'asc' | 'desc'
        /** 그 근무지에 이어진 사람만 — 배정된 시니어 · 근무지 담당자 · 수요처 계정 */
        worksiteId?: string
      } = {},
    ) =>
      req<Paged<DirectoryEntry>>('/directory', { query: clean(q) }),
    getDirectory: (id: string) => req<DirectoryEntry>(`/directory/${id}`),
    createDirectory: (body: {
      name: string
      phone: string
      role?: 'senior' | 'manager' | 'worksite'
      memo?: string | null
      /** role=manager — 맡을 수요처들 */
      worksiteIds?: string[]
      /** role=worksite — 근무지 1곳(필수) */
      worksiteId?: string
    }) => req<{ id: string }>('/directory', { method: 'POST', body }),
    updateDirectory: (
      id: string,
      body: { name?: string; phone?: string; memo?: string | null; status?: LifeStatus },
    ) => req<{ ok: true }>(`/directory/${id}`, { method: 'PATCH', body }),
    endDirectory: (id: string) => req<{ ok: true }>(`/directory/${id}/end`, { method: 'POST' }),
    /** 담당자가 맡을 수요처 전체 — 보낸 목록이 곧 결과다 */
    setManagerWorksites: (id: string, worksiteIds: string[]) =>
      req<{ ok: true }>(`/directory/${id}/worksites`, { method: 'PUT', body: { worksiteIds } }),
    /** 수요처 담당자(role=worksite)의 담당 수요처 1곳 — 권한 칸과 근무지의 수요처 담당자 표시를 함께 맞춘다 */
    setContactWorksite: (id: string, worksiteId: string | null) =>
      req<{ ok: true }>(`/directory/${id}/worksite`, { method: 'PUT', body: { worksiteId } }),

    /* 반복 배정 — 읽기는 worksite 범위 제한, 쓰기는 master 전용 */
    listAssignments: (
      q: { page?: number; size?: number; directoryId?: string; worksiteId?: string } = {},
    ) =>
      req<Paged<Assignment>>('/assignments', { query: clean(q) }),
    createAssignment: (body: {
      directoryId: string
      worksiteId: string
      programId?: string | null
      weekdays: number[]
      startTime: string
      endTime: string
      periodStart?: string | null
      periodEnd?: string | null
    }) => req<{ id: string }>('/assignments', { method: 'POST', body }),
    updateAssignment: (
      id: string,
      body: {
        weekdays?: number[]
        startTime?: string
        endTime?: string
        periodStart?: string | null
        periodEnd?: string | null
        programId?: string | null
      },
    ) => req<{ ok: true }>(`/assignments/${id}`, { method: 'PATCH', body }),
    deleteAssignment: (id: string) => req<{ ok: true }>(`/assignments/${id}`, { method: 'DELETE' }),

    /* 출결 — 읽기는 worksite 범위 제한, 수정은 master 전용 */
    listAttendance: (
      q: ListQuery & {
        from?: string
        to?: string
        worksiteId?: string
        display?: AttendanceDisplay
        /** '1' 이면 조회 조건 전체의 상태별 건수를 함께 받는다. 전 페이지를 도는 호출은 보내지 않는다 */
        summary?: '1'
      } = {},
    ) => req<Paged<AttendanceShift> & { summary?: AttendanceSummary }>('/attendance', { query: clean(q) }),
    patchAttendance: (
      shiftId: string,
      body: {
        status: string
        startedAt?: string | null
        endedAt?: string | null
        method?: string
        memo?: string | null
        /** 창을 열 때 본 출결의 updated_at(기록이 없었으면 null). 그사이 고쳤으면 409 attendance_conflict. 옛 서버는 버린다 */
        expectedUpdatedAt?: string | null
      },
    ) => req<{ id: string }>(`/attendance/${shiftId}`, { method: 'PATCH', body }),
    /* 출결 삭제 — master·담당자, 오늘 활동만. 지운 내용·삭제자·사유가 삭제 기록에 남는다 */
    deleteAttendance: (shiftId: string, reason: string) =>
      // 응답은 남긴 기록 그대로다. 이름(senior·worksite·deleted_by)은 목록에서만 붙는다
      req<Omit<AttendanceDeletion, 'senior' | 'worksite' | 'deleted_by'>>(`/attendance/${shiftId}/delete`, {
        method: 'POST',
        body: { reason },
      }),
    /* 출결 삭제 기록 — master 전용 */
    listAttendanceDeletions: (q: ListQuery & { from?: string; to?: string } = {}) =>
      req<Paged<AttendanceDeletion>>('/attendance-deletions', { query: clean(q) }),
    /**
     * 출결 조정 요청(서버 2026-11-04, QA PARTNER-01 · PARTNER-02). 요청은 수요처만(자기 근무지), 목록은 수요처·담당자·master 가
     * 각자 범위로, 확정·반려는 출결 수정과 같은 권한(담당자는 맡은 근무지, master 전체). 옛 서버는 모두 404
     */
    createAttendanceRequest: (
      shiftId: string,
      body: { status?: string; startedAt?: string; endedAt?: string; reason: string },
    ) => req<AttendanceRequest>(`/attendance/${shiftId}/requests`, { method: 'POST', body }),
    listAttendanceRequests: (
      q: { status?: AttendanceRequestStatus; worksiteId?: string; from?: string; to?: string; page?: number; size?: number } = {},
    ) => req<Paged<AttendanceRequestItem>>('/attendance-requests', { query: clean(q) }),
    approveAttendanceRequest: (id: string, memo: string | null) =>
      req<{ ok: true; request: AttendanceRequest }>(`/attendance-requests/${id}/approve`, { method: 'POST', body: { memo } }),
    rejectAttendanceRequest: (id: string, memo: string | null) =>
      req<{ ok: true; request: AttendanceRequest }>(`/attendance-requests/${id}/reject`, { method: 'POST', body: { memo } }),

    /* 채팅방 열람 — master 전용. 상태·종류·AI 필터(서버 2026-11-07, QA ADMIN-01)는 DB 값 그대로, 그 밖은 400 */
    listRooms: (q: ListQuery & RoomFilterQuery = {}) => req<Paged<ChatRoom>>('/rooms', { query: clean(q) }),
    /**
     * 단체방 만들기(서버 2026-11-04, QA CHAT-01). 참여자는 **프로필 id**. 만든 master 는 멤버로 들어가지 않는다.
     * 넣을 수 없는 사람이 하나라도 있으면 아무것도 만들지 않고 400 bad_member(`invalid`). 옛 서버는 404
     */
    createRoom: (body: { title: string; profileIds: string[]; aiEnabled: boolean }) =>
      req<{ roomId: string; members: number }>('/rooms', { method: 'POST', body }),
    /**
     * 참여자 추가·내보내기(서버 2026-11-04, QA CHAT-03). 이미 멤버인 사람은 건너뛰고 `added` 에 세지 않는다.
     * 종료된 방·1:1 방은 409, 마지막 한 사람은 내보낼 수 없다(409 last_member). 옛 서버는 404
     */
    addRoomMembers: (id: string, profileIds: string[]) =>
      req<{ ok: true; added: number }>(`/rooms/${id}/members`, { method: 'POST', body: { profileIds } }),
    removeRoomMember: (id: string, profileId: string) =>
      req<{ ok: true }>(`/rooms/${id}/members/${profileId}`, { method: 'DELETE' }),
    updateRoom: (id: string, body: { status: 'active' | 'closed' }) =>
      req<{ ok: true }>(`/rooms/${id}`, { method: 'PATCH', body }),
    listRoomMessages: (id: string) => req<{ items: ChatMessage[] }>(`/rooms/${id}/messages`),
    /* 월간 리포트 — master 전용, 기관 전체 */
    getMonthlyReport: (month: string) => req<MonthlyReport>('/reports/monthly', { query: { month } }),
  }
}
