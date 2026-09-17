// dbo-admin Edge Function 요청·응답 타입 — 출처: handoff/openapi-admin.json (2026-08-25)
export type DirectoryRole = 'senior' | 'manager' | 'worksite' | 'master'
export type AdminRole = 'master' | 'worksite'
export type LifeStatus = 'active' | 'ended'

export interface Paged<T> {
  items: T[]
  total: number
  page: number
  size: number
}

export interface ListQuery {
  q?: string
  sort?: string
  page?: number
  size?: number
}

/** 어드민 계정 — 운영관리자(master)와 수요처(worksite)만 */
export interface AdminAccount {
  id: string
  name: string
  email: string | null
  role: AdminRole
  worksite_id: string | null
  status: LifeStatus
  created_at: string
}

/** 사업 — 앱 상단 사업 전환 헤더의 원천 */
export interface Program {
  id: string
  name: string
  color: string
  status: LifeStatus
  created_at: string
}

/** 근무지 — QR 토큰 포함 */
export interface Worksite {
  id: string
  name: string
  program_id: string | null
  address: string | null
  region_code: string | null
  status: LifeStatus
  manager_directory_id: string | null
  qr_token: string | null
}

/** 명부 — 시니어와 담당자만 (어드민 계정은 AdminAccount) */
export interface DirectoryEntry {
  id: string
  name: string
  phone: string | null
  email: string | null
  role: DirectoryRole
  worksite_id: string | null
  status: LifeStatus
  memo: string | null
  created_at: string
}

/** 반복 배정 — shift 생성 크론이 날짜별로 펼친다 */
export interface Assignment {
  id: string
  directory_id: string
  worksite_id: string
  program_id: string | null
  weekdays: number[] // ISO-8601: 1=월 … 7=일
  start_time: string
  end_time: string
  period_start: string | null
  period_end: string | null
  manager_profile_id: string | null
  created_at: string
}

/** 출결 기록 (shift 1건에 최대 1행) */
export interface AttendanceRecord {
  id: string
  status: string
  started_at: string | null
  ended_at: string | null
  method: string
  memo: string | null
  updated_by: string | null
  updated_at: string
}

/** 출결 목록 행 = shift + 조인된 명부·근무지·기록 */
export interface AttendanceShift {
  id: string
  directory_id: string
  worksite_id: string
  work_date: string
  planned_start: string
  planned_end: string
  state: string
  metadata: Record<string, unknown>
  directory: { name: string; phone: string | null } | null
  worksite: { name: string } | null
  /* 배열이 아니다 — attendanceOf() 주석 참고 */
  attendance: AttendanceRecord | null
}

export interface ChatRoom {
  id: string
  title: string
  kind: string
  status: string
  ai_enabled: boolean
  created_by: string | null
  created_at: string
}

export interface ChatMessage {
  id: string
  room_id: string
  body: string
  created_at: string
  [key: string]: unknown
}
