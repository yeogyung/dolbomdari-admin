// 출퇴근 표시 상태와 「수정됨」 판정, 변경 이력 한 줄 문구(QA 2026-10-14 11·12·13번)
import type { AttendanceChange, AttendanceRecord, AttendanceShift } from '~/types/dbo'
import { attendanceLabel, fmtClock, fmtStamp, ROLE_LABELS } from './dbo'

export type AttendanceDisplay =
  | 'normal'
  | 'late'
  | 'not_arrived'
  | 'missing_checkout'
  | 'working'
  | 'absent'
  | 'excused'
  | 'scheduled'

const DISPLAY: Record<AttendanceDisplay, { label: string; tone: 'green' | 'red' | 'amber' | 'blue' | 'gray' }> = {
  normal: { label: '정상', tone: 'green' },
  late: { label: '지각', tone: 'amber' },
  not_arrived: { label: '미출근', tone: 'red' },
  missing_checkout: { label: '퇴근 누락', tone: 'amber' },
  working: { label: '근무 중', tone: 'blue' },
  absent: { label: '결석', tone: 'red' },
  // 인정 결석은 사전 연락된 것이라 붉게 칠하지 않는다
  excused: { label: '인정 결석', tone: 'gray' },
  scheduled: { label: '출근 전', tone: 'gray' },
}

export const attendanceDisplayLabel = (d: AttendanceDisplay) => DISPLAY[d].label
export const attendanceDisplayTone = (d: AttendanceDisplay) => DISPLAY[d].tone

function seoulDate(now: Date): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Seoul' }).format(now)
}

/** 근무일 + 예정 출근(서울 'HH:MM[:SS]') → epoch ms. 브라우저 시간대와 무관하게 +09:00 으로 고정한다 */
function plannedStartMs(workDate: string, plannedStart: string | null | undefined): number | null {
  if (!plannedStart) return null
  const hms = plannedStart.length === 5 ? `${plannedStart}:00` : plannedStart.slice(0, 8)
  const ms = new Date(`${workDate}T${hms}+09:00`).getTime()
  return Number.isNaN(ms) ? null : ms
}

/**
 * 목록에 보일 상태. 서버는 QR 출근을 언제나 present 로 저장하고 지각을 판정하지 않으므로
 * 여기서 시각으로 가른다. 규칙(사용자 결정 2026-10-14):
 * - 결석·인정 결석은 사람이 정한 값이라 그대로
 * - 지각 = 예정 출근보다 1분 이상 늦음, 또는 저장된 status 가 late.
 *   사람이 「출근」으로 정정한 기록(method manual)은 정정을 따른다
 * - 퇴근이 없으면 오늘은 근무 중, 지난 날은 퇴근 누락
 * - 출근이 없으면 지난 날·예정 시각 지난 오늘은 미출근, 그 밖은 출근 전
 * 자정을 넘기는 근무는 따로 다루지 않는다 — 다음 날 0시부터 퇴근 누락으로 보인다.
 */
export function attendanceDisplay(
  row: Pick<AttendanceShift, 'work_date' | 'planned_start' | 'attendance'>,
  now: Date = new Date(),
): AttendanceDisplay {
  const rec = row.attendance
  if (rec?.status === 'absent') return 'absent'
  if (rec?.status === 'excused') return 'excused'
  const today = seoulDate(now)

  if (rec?.started_at) {
    if (!rec.ended_at) return row.work_date < today ? 'missing_checkout' : 'working'
    if (rec.status === 'late') return 'late'
    return isLateByTime(row) ? 'late' : 'normal'
  }

  if (row.work_date < today) return 'not_arrived'
  if (row.work_date > today) return 'scheduled'
  const planned = plannedStartMs(row.work_date, row.planned_start)
  return planned !== null && now.getTime() >= planned ? 'not_arrived' : 'scheduled'
}

/** 지각 판정에서 퇴근 유무는 상관없다. attendanceDisplay 의 지각 규칙만 떼어 본다 */
function isLateByTime(row: Pick<AttendanceShift, 'work_date' | 'planned_start' | 'attendance'>): boolean {
  const rec = row.attendance
  if (!rec?.started_at || rec.method === 'manual') return false
  const planned = plannedStartMs(row.work_date, row.planned_start)
  return planned !== null && new Date(rec.started_at).getTime() - planned >= 60_000
}

/**
 * 「기록 수정」 창의 상태 기본값. QR 출근은 늘 present 로 저장되고 지각은 시각으로만 보이므로,
 * 그대로 열면 퇴근 시각만 채워 저장해도 지각이 「출근」으로 덮여 사라진다.
 * 목록에 지각으로 보이는 기록은 지각으로 연다. 정상으로 바꾸려면 사람이 직접 고른다.
 */
export function editDefaultStatus(
  row: Pick<AttendanceShift, 'work_date' | 'planned_start' | 'attendance'>,
): string {
  const status = row.attendance?.status ?? 'present'
  return status === 'present' && isLateByTime(row) ? 'late' : status
}

/**
 * 사람이 고친 기록인가. `updated_by` 는 QR 출퇴근도 채워서 쓸 수 없다.
 * 시니어가 아닌 사람이 남긴 이력이 있으면 'edited'. 이력은 2026-10-11 부터만 쌓여서,
 * 그 전에 사람이 고친 기록(method manual)은 이력 없이 'legacy' 로 둔다.
 */
export function isHumanEdited(
  changes: AttendanceChange[] | undefined,
  rec: Pick<AttendanceRecord, 'method'> | null,
): 'edited' | 'legacy' | null {
  if (changes?.some((c) => c.changed_by_role !== 'senior')) return 'edited'
  if (!changes?.length && rec?.method === 'manual') return 'legacy'
  return null
}

/** 근무별로 묶는다. 들어온 순서(최근 것부터)를 지킨다 */
export function groupChangesByShift(changes: AttendanceChange[]): Map<string, AttendanceChange[]> {
  const map = new Map<string, AttendanceChange[]>()
  for (const c of changes) {
    const list = map.get(c.shift_id)
    if (list) list.push(c)
    else map.set(c.shift_id, [c])
  }
  return map
}

function statusText(s: string | null): string {
  return s ? attendanceLabel(s) : '기록 없음'
}

/** 전에 없던 칸은 새 값만, 지운 칸은 「→ 없음」, 바뀐 칸은 전후를 적는다. 그대로면 null */
function timePart(label: string, before: string | null, after: string | null): string | null {
  if (before === after) return null
  if (!before) return `${label} ${fmtClock(after)}`
  return `${label} ${fmtClock(before)} → ${after ? fmtClock(after) : '없음'}`
}

/**
 * 이력 한 줄 — 앱 `lib/attendanceHistory.ts` 의 describeChange 를 어드민 어휘(출근·퇴근)로 옮겼다.
 * 사유는 사람이 고친 줄에만 붙인다. 수기로 고친 뒤 시니어가 QR 로 퇴근하면 memo 가 남은 채
 * 다시 쓰이는데, 그 줄에 붙이면 본인이 사유를 적은 것처럼 읽힌다.
 */
export function describeChange(c: AttendanceChange): {
  when: string
  who: string
  what: string
  memo: string | null
} {
  const name = c.changed_by_name ?? '알 수 없음'
  const role = c.changed_by_role
  const who =
    role === 'senior' ? `${name} (본인 QR)` : role && ROLE_LABELS[role] ? `${name} (${ROLE_LABELS[role]})` : name

  const b = c.before
  const a = c.after
  const parts: string[] = []
  if (!b) parts.push(statusText(a.status))
  else if (b.status !== a.status) parts.push(`${statusText(b.status)} → ${statusText(a.status)}`)
  const started = timePart('출근', b?.started_at ?? null, a.started_at)
  const ended = timePart('퇴근', b?.ended_at ?? null, a.ended_at)
  if (started) parts.push(started)
  if (ended) parts.push(ended)
  if (parts.length === 0) parts.push('사유 수정')

  const memo = role !== 'senior' && a.memo?.trim() ? a.memo.trim() : null
  return { when: fmtStamp(c.created_at), who, what: parts.join(' · '), memo }
}
