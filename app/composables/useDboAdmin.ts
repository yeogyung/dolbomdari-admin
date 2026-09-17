// 돌봄다리 운영센터 어드민 API(dbo-admin Edge Function) 클라이언트 — 세션 토큰 + anon key로 직접 호출
import type {
  AdminAccount,
  AdminRole,
  Assignment,
  AttendanceShift,
  ChatMessage,
  ChatRoom,
  DirectoryEntry,
  LifeStatus,
  ListQuery,
  Paged,
  Program,
  Worksite,
  NoticeSummary,
  NoticeDetail,
  NoticeRecipient,
} from '~/types/dbo'

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
      method?: 'GET' | 'POST' | 'PATCH' | 'DELETE'
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
    listNotices: (q: ListQuery = {}) => req<Paged<NoticeSummary>>('/notices', { query: clean(q) }),
    getNotice: (id: string) => req<NoticeDetail>(`/notices/${id}`),
    listNoticeRecipients: (id: string, q: ListQuery & { channel?: string; read?: string } = {}) =>
      req<Paged<NoticeRecipient>>(`/notices/${id}/recipients`, { query: clean(q) }),
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
    listWorksites: (q: ListQuery = {}) => req<Paged<Worksite>>('/worksites', { query: clean(q) }),
    createWorksite: (body: {
      name: string
      programId?: string | null
      address?: string | null
      regionCode?: string | null
      managerDirectoryId?: string | null
    }) => req<{ id: string; qrToken: string }>('/worksites', { method: 'POST', body }),
    updateWorksite: (
      id: string,
      body: {
        name?: string
        programId?: string | null
        address?: string | null
        regionCode?: string | null
        managerDirectoryId?: string | null
        status?: LifeStatus
      },
    ) => req<{ ok: true }>(`/worksites/${id}`, { method: 'PATCH', body }),
    rotateWorksiteQr: (id: string) =>
      req<{ qrToken: string; rotatedAt: string }>(`/worksites/${id}/qr`, { method: 'POST' }),

    /* 명부(시니어·담당자) — master 전용 */
    listDirectory: (q: ListQuery & { status?: LifeStatus } = {}) =>
      req<Paged<DirectoryEntry>>('/directory', { query: clean(q) }),
    getDirectory: (id: string) => req<DirectoryEntry>(`/directory/${id}`),
    createDirectory: (body: {
      name: string
      phone: string
      role?: 'senior' | 'manager'
      memo?: string | null
    }) => req<{ id: string }>('/directory', { method: 'POST', body }),
    updateDirectory: (
      id: string,
      body: { name?: string; phone?: string; memo?: string | null; status?: LifeStatus },
    ) => req<{ ok: true }>(`/directory/${id}`, { method: 'PATCH', body }),
    endDirectory: (id: string) => req<{ ok: true }>(`/directory/${id}/end`, { method: 'POST' }),

    /* 반복 배정 — 읽기는 worksite 범위 제한, 쓰기는 master 전용 */
    listAssignments: (q: { page?: number; size?: number; directoryId?: string } = {}) =>
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
      managerProfileId?: string | null
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
      q: ListQuery & { from?: string; to?: string; worksiteId?: string } = {},
    ) => req<Paged<AttendanceShift>>('/attendance', { query: clean(q) }),
    patchAttendance: (
      shiftId: string,
      body: {
        status: string
        startedAt?: string | null
        endedAt?: string | null
        method?: string
        memo?: string | null
      },
    ) => req<{ id: string }>(`/attendance/${shiftId}`, { method: 'PATCH', body }),

    /* 채팅방 열람 — master 전용 */
    listRooms: (q: ListQuery = {}) => req<Paged<ChatRoom>>('/rooms', { query: clean(q) }),
    updateRoom: (id: string, body: { status: 'active' | 'closed' }) =>
      req<{ ok: true }>(`/rooms/${id}`, { method: 'PATCH', body }),
    listRoomMessages: (id: string) => req<{ items: ChatMessage[] }>(`/rooms/${id}/messages`),
  }
}
