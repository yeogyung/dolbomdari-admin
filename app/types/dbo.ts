// dbo-admin Edge Function 요청·응답 타입 — 출처: handoff/openapi-admin.json (2026-08-25)
export type DirectoryRole = 'senior' | 'manager' | 'worksite' | 'master'
export type AdminRole = 'master' | 'worksite'
export type LifeStatus = 'active' | 'ended'

export interface NoticeSummary {
  id: string
  title: string
  kind: 'normal' | 'urgent'
  status: 'draft' | 'sent' | 'revoked'
  published_at: string | null
  program_id: string | null
  is_special?: boolean
  author_profile_id?: string | null
  author?: { name: string; role: string } | null
}
export interface NoticeAuthor {
  id: string
  name: string
  role: string
}
export interface NoticeDetail extends NoticeSummary {
  body: string
  metadata: { delivery?: { recipients?: number; historyFailed?: number; status?: string } }
  trackedRecipients: number
}
/**
 * 앱 푸시 접수·실제 전달 집계 — GET /dbo-admin/push/summary(서버 2026-11-04, QA PUSH-01). 토큰 하나당 한 줄로 센다.
 * `accepted` 는 Expo 접수(예전 「나갔음」), `delivered`·`failed` 는 15분 뒤 receipt 로 본 실제 결과, `rejected` 는 접수부터 거절.
 * `errors` 는 거절·실패의 이유별 수
 */
export interface PushSummary {
  kind: string | null
  linkId: string | null
  since: string
  tickets: number
  accepted: number
  rejected: number
  delivered: number
  failed: number
  pending: number
  unknown: number
  errors: Record<string, number>
}
export type DeliveryStatus = 'skipped' | 'pending' | 'accepted' | 'failed'
/**
 * 문자의 실제 결과 한 단어(서버 2026-11-04, QA ANOTICE-05). 크론이 보낸 지 10분 뒤부터 솔라피에 물어 채운다.
 * rejected 접수부터 실패 · pending 결과 기다림 · delivered 수신 완료 · failed 수신 실패 · unknown 72시간 안에 못 받음
 */
export type SmsResult = 'rejected' | 'pending' | 'delivered' | 'failed' | 'unknown'
export interface NoticeRecipient {
  notice_id: string
  directory_id: string
  name: string
  phone: string | null
  can_read: boolean
  /** 문자 **접수** 상태 — 실제 도착은 `sms_result` */
  sms_status: DeliveryStatus
  push_status: DeliveryStatus
  read_at: string | null
  read_method: string | null
  /** 첫 발송 문자의 실제 결과·사유. 문자 없는 공지·배포 전 발송이면 null, 옛 서버는 칸이 없다 */
  sms_result?: SmsResult | null
  sms_status_code?: string | null
  sms_reason?: string | null
  sms_checked_at?: string | null
}

/** 문자 결과 목록 한 줄 — GET /dbo-admin/sms/messages(서버 2026-11-04, QA ANOTICE-05). 문자 한 통이 한 줄, 최신순 */
export interface NoticeSms {
  id: string
  notice_id: string
  directory_id: string
  /** 첫 발송 · 다시 알림 */
  source: 'delivery' | 'resend'
  resend_id: string | null
  sms_result: SmsResult
  sms_reason: string | null
  status_code: string | null
  status_message: string | null
  send_error: string | null
  send_detail: string | null
  group_id: string | null
  message_id: string | null
  checked_at: string | null
  /** 보낸 시각 */
  created_at: string
  notice: { title: string; kind: string; published_at: string | null } | null
  senior: { name: string; phone: string | null } | null
}

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
  /** 수요처 담당자(role=worksite). 지정·표시용 — 권한은 명부의 worksite_id 가 정한다 */
  manager_directory_id: string | null
  /** 근무지 담당자(role=manager, 사회복지사). 앱·어드민 담당자 범위의 기준 */
  care_manager_directory_id: string | null
  /**
   * 두 담당자의 이름(서버 2026-11-04, QA PARTNER-05). 목록 응답에만 있다. 지정 전이면 null,
   * 옛 서버거나 서버가 이름을 못 읽었으면 칸이 없다
   */
  manager?: { id: string; name: string | null } | null
  care_manager?: { id: string; name: string | null } | null
  qr_token: string | null
  /** 활동 중 시니어 가운데 지금 유효한 배정이 있는 사람 수. 목록 응답에만 있다(QA 2026-10-14 17번) */
  senior_count?: number
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
  /** 지금 번호로 앱에 로그인한 적이 있는가. 수요처는 null. 서버 조회가 실패하면 없다 */
  app_connected?: boolean | null
  /** 가장 최근 앱 로그인 시각 */
  last_sign_in_at?: string | null
  /**
   * 이 사람의 근무지와 사업(서버 2026-11-07, QA ADMIN-02). 시니어는 지금 유효한 배정의 근무지, 담당자는 맡은 근무지,
   * 수요처는 자기 근무지. 같은 근무지는 한 번, 이름순, 없으면 []. **목록에만 있다**(상세에는 없다). 옛 서버는 칸이 없다
   */
  worksites?: RosterSite[]
}

/**
 * 한 사람이 받은 공지 — GET /directory/{id}/notices(서버 2026-11-07, QA ADMIN-03). 발송 최신순 50건.
 * `read_at` 은 읽은 시각(긴급은 확인), `can_read` 가 false 면 문자로만 받은 분이라 `read_at` 이 늘 null
 */
export interface PersonNotice {
  id: string
  title: string
  kind: 'normal' | 'urgent'
  is_special: boolean
  status: 'draft' | 'sent' | 'revoked'
  published_at: string | null
  read_at: string | null
  can_read: boolean
}

/** 명부 상세의 「참여 중인 채팅방」 한 줄 — master 권한으로 dbo_rooms 를 직접 읽는다 */
export interface PersonRoom {
  id: string
  title: string
  kind: string
  status: string
  ai_enabled: boolean
}

/** 명부 목록 한 줄의 근무지·사업 */
export interface RosterSite {
  id: string
  name: string
  program_id: string | null
  program_name: string | null
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

/** 출퇴근 목록 상단 집계. 서버가 조회 조건 전체를 센다(페이지가 아니다) */
export interface AttendanceSummary {
  /** 퇴근 완료 = 정상 + 지각 */
  done: number
  working: number
  missingCheckout: number
  /** 미기록·결근 = 미출근 + 결석 */
  missing: number
}

/**
 * 출결 조정 요청(서버 2026-11-04, QA PARTNER-01 · PARTNER-02). 수요처가 내고 담당자·master 가 확정·반려한다.
 * `requested_*` 가 null 이면 그 칸은 그대로 두길 바란 것이다. `base_*` 는 요청할 때 본 출결(모두 null 이면 기록 없음)
 */
export type AttendanceRequestStatus = 'pending' | 'approved' | 'rejected'
export interface AttendanceRequest {
  id: string
  status: AttendanceRequestStatus
  /** 기록 없는 근무가 정리되면 null */
  shift_id: string | null
  directory_id: string
  worksite_id: string
  work_date: string
  requested_status: string | null
  requested_started_at: string | null
  requested_ended_at: string | null
  reason: string
  base_status: string | null
  base_started_at: string | null
  base_ended_at: string | null
  base_updated_at: string | null
  requested_by: string | null
  requested_by_name: string | null
  decided_by: string | null
  decided_by_name: string | null
  decided_at: string | null
  decision_memo: string | null
  created_at: string
}
/** 목록·상세 한 줄. `current` 는 지금 출결, `stale` 은 기다리는 요청인데 요청 뒤 출결이 바뀜(확정하면 409) */
export interface AttendanceRequestItem extends AttendanceRequest {
  senior: { name: string } | null
  worksite: { name: string } | null
  shift: { planned_start: string | null; planned_end: string | null } | null
  current: { status: string; started_at: string | null; ended_at: string | null; updated_at: string } | null
  stale: boolean
}

/** 출결 변경 전·후. 서버 트리거(dbo_attendance_changes)가 떠 둔다. 키 이름은 DB 칸 그대로다 */
export interface AttendanceSnapshot {
  status: string | null
  started_at: string | null
  ended_at: string | null
  memo: string | null
}

export interface AttendanceChange {
  id: string
  shift_id: string
  created_at: string
  changed_by_name: string | null
  changed_by_role: string | null
  /** 처음 기록이면 null */
  before: AttendanceSnapshot | null
  after: AttendanceSnapshot
}

/**
 * 지운 출결의 기록(dbo_attendance_deletions). 고치거나 지울 수 없다.
 * 이름은 기록에 없고 서버가 명부·근무지에서 붙여 준다 — 그 행이 없으면 null 이다.
 */
export interface AttendanceDeletion {
  id: string
  attendance_id: string
  shift_id: string
  directory_id: string
  worksite_id: string
  work_date: string
  status: string
  started_at: string | null
  ended_at: string | null
  method: string | null
  memo: string | null
  deleted_by_directory_id: string
  deleted_by_role: string
  reason: string
  deleted_at: string
  senior: { name: string; phone: string | null } | null
  worksite: { name: string } | null
  deleted_by: { name: string } | null
}

export interface ChatRoom {
  id: string
  title: string
  kind: string
  status: string
  ai_enabled: boolean
  created_by: string | null
  created_at: string
  /** 마지막 메시지 시각, 없으면 null(서버 2026-11-04, QA CHAT-02). 옛 서버는 칸이 없다 */
  last_message_at?: string | null
  /** 멤버 수(서버 2026-11-09, 결정 D30). 2명이면 1:1 이다. 옛 서버는 칸이 없다 */
  member_count?: number
}

/** 대화 보기 메시지의 첨부(서버 2026-11-04, QA CHAT-04). `url` 은 1시간짜리 서명 주소, 못 만들었으면 null */
export interface ChatAttachment {
  id: string
  kind: 'image' | 'file'
  filename: string
  byte_size: number
  created_at: string
  url: string | null
}

export interface ChatMessage {
  id: string
  room_id: string
  body: string
  created_at: string
  /** 올린 순서, 없으면 []. 옛 서버는 칸이 없다 */
  attachments?: ChatAttachment[]
  [key: string]: unknown
}

/** FAQ 승인 상태 — 담당자가 앱에서 올리면 pending, 승인은 웹 어드민에서만 한다 */
export type FaqStatus = 'pending' | 'approved' | 'rejected'

/** dbo_faqs 행 + 적용 범위 embed (범위 행이 없으면 기관 전체) */
export interface Faq {
  id: string
  question: string
  answer: string
  /** 비슷한 질문. AI 프롬프트에 함께 실린다. 비었으면 null 일 수 있다(QA 2026-11-02 DOC-01) */
  paraphrases: string[] | null
  enabled: boolean
  sort: number
  status: FaqStatus
  category: string | null
  created_by: string | null
  created_at: string
  dbo_faq_worksites: { worksite_id: string; dbo_worksites: { id: string; name: string } | null }[]
}

/** AI 문서 상태 — 저장값이 아니라 서버가 발효일·종료일·제외 여부로 계산한다. AI 근거는 현행뿐 */
export type DocumentState = '현행' | '발효예정' | '만료' | '미정' | '제외함'

/** GET /dbo-admin/documents 행 — 본문 없음. 적용 범위가 비면 기관 전체 */
export interface DocumentListItem {
  id: string
  filename: string
  kind: string
  version: string | null
  effective_date: string | null
  expiry_date: string | null
  updated_at: string
  state: DocumentState
  excluded_at: string | null
  byte_size: number | null
  created_by: string | null
  /**
   * 올린 사람·마지막으로 고친 사람의 그때 이름과 고친 사람 id(서버 2026-11-04, QA DOC-03).
   * 모르면 null(시드·예전 어드민 등록), 옛 서버는 칸이 없다. 고친 시각은 `updated_at`
   */
  created_by_name?: string | null
  updated_by?: string | null
  updated_by_name?: string | null
  dbo_document_worksites: { worksite_id: string }[]
  /**
   * 판 계보(서버 2026-11-04, QA DOC-02) — 첫 판의 id. 이어 올린 판이 없으면 null, 옛 서버는 칸이 없다.
   * `superseded_by` 는 날짜로는 현행인데 같은 계보의 더 늦은 판 때문에 AI 가 쓰지 않는 문서의 그 새 판. 보통 null
   */
  lineage_id?: string | null
  superseded_by?: { id: string; filename: string; version: string | null } | null
  /** AI 가 읽었는가 — false 면 「준비 중」(서버 2026-11-09, 결정 D16). 옛 서버는 칸이 없다 */
  indexed?: boolean
}

/** GET /dbo-admin/documents/{id}/versions 한 줄(오래된 판부터). `in_use` = 지금 AI 가 쓰는 판 */
export interface DocumentVersionItem {
  id: string
  filename: string
  kind: string
  version: string | null
  effective_date: string | null
  expiry_date: string | null
  excluded_at: string | null
  updated_at: string
  created_by_name: string | null
  state: DocumentState
  in_use: boolean
}
export interface DocumentVersions {
  lineageId: string
  inUseId: string | null
  items: DocumentVersionItem[]
}
/** POST /dbo-admin/documents/{id}/versions 201. `previous.expiry_date` 는 고친 뒤 이전 판의 종료일 */
export interface DocumentVersionCreated {
  id: string
  indexed: boolean
  lineageId: string
  previous: { id: string; expiry_date: string | null }
}

/** GET /dbo-admin/documents/{id} — 본문과 색인 청크 수(0 이면 색인 전) */
export interface DocumentDetail extends DocumentListItem {
  body: string
  chunks: number
}

/** PATCH /dbo-admin/documents/{id} — 보낸 항목만 고친다. expiryDate: null 은 종료일 삭제(무기한) */
export interface DocumentPatch {
  body?: string
  version?: string
  effectiveDate?: string
  expiryDate?: string | null
}

/** 월간 리포트 — GET /dbo-admin/reports/monthly. 원값만 온다(비율은 utils/reports.ts) */
export interface ReportBreakdown {
  shifts: number
  checkedIn: number
  late: number
  absent: number
  excused: number
  missing: number
}
export interface NoticeCategoryStats {
  noticeCount: number
  readable: number
  read: number
  avgReadSeconds: number | null
  /** 받은 사람 전체(서버 2026-11-04, QA REPORT-02). `recipients - readable` = 앱 미연결. 옛 서버는 칸이 없다 */
  recipients?: number
}
export interface MonthlyReport {
  month: string
  firstDay: string
  through: string
  attendance: {
    shifts: number
    byStatus: { present: number; late: number; absent: number; excused: number; missing: number; other: number }
    checkedIn: number
    workedMinutes: number
    workedCount: number
    byMethod: { qr: number; manual: number; other: number }
    daily: { date: string; shifts: number; checkedIn: number; absent: number; missing: number }[]
    byWorksite: (ReportBreakdown & { worksiteId: string; name: string; programId: string | null })[]
    byProgram: (ReportBreakdown & { programId: string | null; name: string })[]
    topAbsentees: { directoryId: string; name: string; worksiteName: string; shifts: number; absent: number; missing: number }[]
  }
  people: {
    activeSeniors: number
    activeManagers: number
    activeWorksites: number
    seniorsWithApp: number
    workedSeniors: number
    newSeniors: number
  }
  notices: {
    untracked: number
    normal: NoticeCategoryStats
    special: NoticeCategoryStats
    urgent: NoticeCategoryStats
    delivery: { sms: { accepted: number; failed: number }; push: { accepted: number; failed: number } }
    /** 문자의 실제 결과(서버 2026-11-04, QA ANOTICE-05) — 첫 발송만, `delivery.sms` 와 같은 대상. 옛 서버는 칸이 없다 */
    smsResults?: SmsResultsSummary
    lowest: { id: string; title: string; publishedAt: string; readable: number; read: number; recipients?: number }[]
  }
  /**
   * 그달 AI 자동응답(서버 2026-11-04, QA REPORT-01). `questions = autoAnswered + handedOver`. 옛 서버는 칸이 없다
   */
  ai?: AiReplyStats
}
/** 그달 공지 문자의 실제 결과 집계. `reasons` 는 실패 사유별(접수 실패 + 수신 실패), 많은 것부터 */
export interface SmsResultsSummary {
  messages: number
  rejected: number
  delivered: number
  failed: number
  pending: number
  unknown: number
  reasons: { code: string; label: string; count: number }[]
}
export interface AiReplyStats {
  /** AI 가 받은 질문 수 — 자동응답률의 분모 */
  questions: number
  /** 승인 FAQ·문서 근거로 AI 가 답한 수 — 분자 */
  autoAnswered: number
  /** 「담당자에게 연결해 드릴게요.」로 넘긴 수 */
  handedOver: number
}
