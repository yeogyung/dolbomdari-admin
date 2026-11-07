// 출퇴근 표시 상태와 「수정됨」 판정, 변경 이력 한 줄 문구(QA 2026-10-14 11·12·13번)
import type { AttendanceChange, AttendanceRecord, AttendanceShift } from '~/types/dbo'
import { attendanceLabel, attendanceOf, fmtClock, fmtStamp, ROLE_LABELS } from './dbo'

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

/**
 * 상태 필터 선택지. 서버가 같은 규칙(DB 함수 dbo_display_state)으로 걸러 준다 —
 * 아래 attendanceDisplay 를 고치면 서버 마이그레이션도 같이 고친다.
 */
export const ATTENDANCE_DISPLAY_OPTIONS = (Object.keys(DISPLAY) as AttendanceDisplay[]).map((value) => ({
  value,
  label: DISPLAY[value].label,
}))
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
 *
 * **같은 규칙이 서버 DB 함수 `dbo_display_state` 에도 있다**(상태 필터용). 고치면 둘 다 고친다.
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

export type DayTally = {
  total: number
  /** 퇴근까지 찍음(정상·지각) */
  done: number
  /** 출근만 찍고 아직 근무 중 */
  working: number
  /** 예정 시각이 지났는데 출근 기록이 없음, 또는 퇴근 누락 */
  missing: number
  /** 결석(인정 결석은 넣지 않는다 — 사전 연락된 것이다) */
  absent: number
  /** 아직 예정 시각 전. 미기록·결근에 넣지 않는다 */
  scheduled: number
}

/**
 * 대시보드 「오늘 출결」 숫자. **출퇴근 기록 화면과 같은 판정(`attendanceDisplay`)으로 센다.**
 *
 * 예전에는 「출결 기록이 없으면 미기록」으로 따로 세어, 14:00 시작 근무가 10:46 에 미기록으로 잡혔다.
 * 출퇴근 기록 화면은 같은 근무를 「출근 전」으로 보였다 — 두 화면 숫자가 갈렸다(QA 2026-11-02 ADM-03).
 */
export function tallyDay(
  rows: Pick<AttendanceShift, 'work_date' | 'planned_start' | 'attendance'>[],
  now: Date = new Date(),
): DayTally {
  const out: DayTally = { total: rows.length, done: 0, working: 0, missing: 0, absent: 0, scheduled: 0 }
  for (const row of rows) {
    const d = attendanceDisplay(row, now)
    if (d === 'normal' || d === 'late') out.done++
    else if (d === 'working') out.working++
    else if (d === 'not_arrived' || d === 'missing_checkout') out.missing++
    else if (d === 'absent') out.absent++
    else if (d === 'scheduled') out.scheduled++
  }
  return out
}

/** 확인이 필요한 순서 — 미출근·퇴근 누락, 결석, 지각, 나머지(출근 전 포함). 대시보드 목록이 쓴다 */
export function attentionRank(
  row: Pick<AttendanceShift, 'work_date' | 'planned_start' | 'attendance'>,
  now: Date = new Date(),
): number {
  const d = attendanceDisplay(row, now)
  if (d === 'not_arrived' || d === 'missing_checkout') return 0
  if (d === 'absent') return 1
  if (d === 'late') return 2
  return 3
}

/**
 * 대시보드 「확인이 필요한 근무」의 사업·근무지 필터(QA 2026-11-07 ADMIN-06). 근무에는 근무지만 있어 사업은
 * 그 근무지의 사업(`programOf`, 근무지 id → 사업 id)으로 본다. 근무지를 골랐으면 그 근무지만 — 근무지가 사업보다 좁다.
 * 빈 값('')은 거르지 않는다
 */
export function filterShiftsByScope<T extends Pick<AttendanceShift, 'worksite_id'>>(
  rows: T[],
  scope: { programId: string; worksiteId: string },
  programOf: Map<string, string | null>,
): T[] {
  if (scope.worksiteId) return rows.filter((r) => r.worksite_id === scope.worksiteId)
  if (scope.programId) return rows.filter((r) => programOf.get(r.worksite_id) === scope.programId)
  return rows
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

/**
 * 수정 창을 연 뒤 다른 곳에서 그 근무를 고쳤는가(QA 2026-11-02 ADM-02).
 *
 * 옛 서버 수정 API 는 나중 저장이 앞 저장을 그대로 덮는다. 변경 이력(`dbo_attendance_changes`)은 모든
 * 저장마다 한 줄씩 쌓이므로, 창을 열 때 본 「가장 최근 이력」과 저장 직전에 다시 읽은 것이 다르면
 * 그 사이 누군가 고친 것이다(다른 관리자든 시니어의 QR 이든).
 *
 * 새 서버(2026-11-04)는 `expectedUpdatedAt`(`attendanceVersion`)으로 직접 막는다. 이 검사는 서버가
 * 배포되기 전의 방어로 남긴다 — 배포 뒤에는 겹쳐 막을 뿐이라 걷어도 된다.
 *
 * @param baseline 창을 열 때 본 가장 최근 이력 id. 이력이 없었으면 null, **모르면 undefined** —
 *                 목록의 이력 조회가 실패했으면 비교하지 않는다(매번 충돌로 오판하지 않게)
 * @param latest   저장 직전에 다시 읽은 그 근무의 이력, 최근 것부터
 */
export function changedSince(
  baseline: string | null | undefined,
  latest: Pick<AttendanceChange, 'id'>[],
): boolean {
  if (baseline === undefined) return false
  return (latest[0]?.id ?? null) !== baseline
}

/**
 * 저장 본문의 `expectedUpdatedAt`(QA 2026-11-02 ADM-02, 서버 2026-11-04). 창을 열 때 본 출결의 `updated_at` 을
 * **받은 그대로** 보낸다 — 서버가 밀리초까지 비교하고, 그사이 누가 고쳤으면 저장하지 않고 409 다.
 *
 * - 기록이 없던 근무면 null — 그사이 기록이 생겼으면 충돌이다.
 * - 기록은 있는데 시각 칸이 없으면 undefined(칸을 싣지 않는다). null 로 보내면 「기록 없음」으로 읽혀 매번 막힌다.
 * - 옛 서버는 모르는 칸이라 버린다 — 예전처럼 덮어쓴다.
 */
export function attendanceVersion(row: Pick<AttendanceShift, 'attendance'>): string | null | undefined {
  const rec = attendanceOf(row)
  if (!rec) return null
  return rec.updated_at || undefined
}

/** 서버가 동시 수정을 잡았는가 — 409 `attendance_conflict`. 저장하지 않았다 */
export function isAttendanceConflict(e: any): boolean {
  return (e?.status ?? e?.statusCode) === 409 && e?.data?.error === 'attendance_conflict'
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
