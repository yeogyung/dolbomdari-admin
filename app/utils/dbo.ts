// 시니어 어드민 공용 포맷·라벨 유틸 — 요일·출결 상태·시간(Asia/Seoul) 표기
import type { LifeStatus } from '~/types/dbo'

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

/** 출결 상태 코드 — 서버는 문자열로 열어 두었고 화면은 이 어휘를 쓴다 */
export const ATTENDANCE_STATUSES = [
  { value: 'checked_in', label: '출근' },
  { value: 'checked_out', label: '퇴근' },
  { value: 'late', label: '지각' },
  { value: 'absent', label: '결근' },
] as const

export function attendanceLabel(status: string | null | undefined): string {
  if (!status) return '미기록'
  return ATTENDANCE_STATUSES.find((s) => s.value === status)?.label ?? status
}

export function attendanceTone(status: string | null | undefined): 'green' | 'red' | 'amber' | 'blue' | 'gray' {
  switch (status) {
    case 'checked_out':
      return 'green'
    case 'checked_in':
      return 'blue'
    case 'late':
      return 'amber'
    case 'absent':
      return 'red'
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
