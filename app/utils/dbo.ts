// 시니어 어드민 공용 포맷·라벨 유틸 — 요일·출결 상태·시간(Asia/Seoul) 표기
import type { AttendanceRecord, AttendanceShift, LifeStatus } from '~/types/dbo'

/**
 * 출결 목록 행에서 출결 기록을 꺼낸다.
 *
 * **응답의 attendance 는 배열이 아니라 객체(기록이 없으면 null)다.** dbo_attendance.shift_id
 * 에 unique 제약이 있어서 PostgREST 가 이 조인을 to-one 으로 판정하고 배열 대신 단일 객체를
 * 내려 준다(2026-09-17 실측). 배열로 읽으면 QR 출퇴근이 DB 에 멀쩡히 들어와 있어도
 * 출근·퇴근·상태 칸이 조용히 전부 빈 채로 보인다.
 */
export function attendanceOf(
  shift: Pick<AttendanceShift, 'attendance'>,
): AttendanceRecord | null {
  return shift.attendance ?? null
}

/** ISO-8601 요일 번호 (1=월 … 7=일) */
export const WEEKDAYS: { value: number; label: string }[] = [
  { value: 1, label: '월' },
  { value: 2, label: '화' },
  { value: 3, label: '수' },
  { value: 4, label: '목' },
  { value: 5, label: '금' },
  { value: 6, label: '토' },
  { value: 7, label: '일' },
]

export function weekdaysLabel(days: number[] | null | undefined): string {
  if (!days?.length) return '—'
  return [...days]
    .sort((a, b) => a - b)
    .map((d) => WEEKDAYS.find((w) => w.value === d)?.label ?? d)
    .join('·')
}

/**
 * 출결 상태 코드.
 *
 * **서버·앱이 실제로 쓰는 값에 맞췄다.** 2026-09-06 에 운영 DB 를 실측했다 —
 * present 204 · absent 11 · late 9 · excused 6 이고 checked_in · checked_out 은 0건이다.
 * 서버의 QR 출퇴근이 status='present' 를 쓰고(check-in · check-out 모두),
 * 담당자 대리 기록(PATCH /dbo/attendance/{shiftId})이 late · absent · excused 를 받는다.
 *
 * 예전 어휘(checked_in · checked_out)는 이 화면에만 있어서 present 와 excused 가
 * 라벨을 못 찾고 코드 그대로 표시됐다.
 *
 * 출근·퇴근 시각은 status 가 아니라 started_at · ended_at 로 구분한다 —
 * 「퇴근」이 별도 상태가 아니라 ended_at 이 찼는지의 문제다.
 */
export const ATTENDANCE_STATUSES = [
  { value: 'present', label: '출근' },
  { value: 'late', label: '지각' },
  { value: 'absent', label: '결석' },
  { value: 'excused', label: '인정 결석' },
] as const

export function attendanceLabel(status: string | null | undefined): string {
  if (!status) return '미기록'
  return ATTENDANCE_STATUSES.find((s) => s.value === status)?.label ?? status
}

export function attendanceTone(status: string | null | undefined): 'green' | 'red' | 'amber' | 'blue' | 'gray' {
  switch (status) {
    case 'present':
      return 'green'
    case 'late':
      return 'amber'
    case 'absent':
      return 'red'
    // 인정 결석은 결석과 뜻이 다르다. 사전 연락된 것이라 붉게 칠하지 않는다.
    case 'excused':
      return 'gray'
    default:
      return 'gray'
  }
}

export function lifeStatusLabel(status: LifeStatus | string): string {
  return status === 'active' ? '활성' : status === 'ended' ? '종료' : status
}

export function lifeStatusTone(status: LifeStatus | string): 'green' | 'gray' {
  return status === 'active' ? 'green' : 'gray'
}

export const ROLE_LABELS: Record<string, string> = {
  senior: '시니어',
  manager: '담당자',
  worksite: '수요처',
  master: '운영관리자',
}

/** 'HH:MM:SS' → 'HH:MM' */
export function hhmm(time: string | null | undefined): string {
  if (!time) return '—'
  return time.slice(0, 5)
}

/**
 * 근무시간 — 목업 W4 의 「3시간 58분」 칸.
 *
 * 출근·퇴근 시각의 차이로만 낸다. 예정 시간(planned)이 아니라 실제 기록이다.
 * 퇴근 전이면 아직 확정된 값이 없으므로 빈 값을 낸다 — 0분으로 쓰면
 * 근무하지 않은 것처럼 보인다.
 */
export function workedDuration(
  startedAt: string | null | undefined,
  endedAt: string | null | undefined,
): string {
  if (!startedAt || !endedAt) return '—'
  const ms = new Date(endedAt).getTime() - new Date(startedAt).getTime()
  if (Number.isNaN(ms) || ms < 0) return '—'
  const mins = Math.round(ms / 60000)
  const h = Math.floor(mins / 60)
  const m = mins % 60
  if (h === 0) return `${m}분`
  return `${h}시간 ${String(m).padStart(2, '0')}분`
}

/** 운영 일자는 항상 Asia/Seoul 기준 */
export function todaySeoul(): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Seoul' }).format(new Date())
}

export function daysAgoSeoul(days: number): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Seoul' }).format(
    new Date(Date.now() - days * 86400000),
  )
}

/** ISO 타임스탬프 → 'MM.DD HH:MM' (Asia/Seoul) */
export function fmtStamp(iso: string | null | undefined): string {
  if (!iso) return '—'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return '—'
  return new Intl.DateTimeFormat('ko-KR', {
    timeZone: 'Asia/Seoul',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(d)
}

/** ISO 타임스탬프 → 'HH:MM' (Asia/Seoul) */
export function fmtClock(iso: string | null | undefined): string {
  if (!iso) return '—'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return '—'
  return new Intl.DateTimeFormat('ko-KR', {
    timeZone: 'Asia/Seoul',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(d)
}

/** ISO → <input type="datetime-local"> 값 (브라우저 로컬 타임존 기준) */
export function toLocalInput(iso: string | null | undefined): string | null {
  if (!iso) return null
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return null
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

/** <input type="datetime-local"> 값 → ISO 문자열 */
export function fromLocalInput(value: string | null | undefined): string | null {
  if (!value) return null
  const d = new Date(value)
  return Number.isNaN(d.getTime()) ? null : d.toISOString()
}

/** 전화번호 하이픈 표기 (010-1234-5678) */
export function fmtPhone(phone: string | null | undefined): string {
  if (!phone) return '—'
  const digits = phone.replace(/\D/g, '')
  if (digits.length === 11) return `${digits.slice(0, 3)}-${digits.slice(3, 7)}-${digits.slice(7)}`
  if (digits.length === 10) return `${digits.slice(0, 3)}-${digits.slice(3, 6)}-${digits.slice(6)}`
  return phone
}
