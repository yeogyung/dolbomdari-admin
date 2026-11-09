// 담당자 월간 리포트의 응답 모양·범위 고르기·숫자 표기 — 앱 내정보 > 리포트(`db-operation-rn/lib/report.ts`)와 같은 셈(QA 2026-11-07 MGR-04 · 결정 D4)
//
// 담당자는 `dbo-admin` 리포트(master 전용, 기관 전체)를 못 부른다. 앱과 같은 `GET /dbo/reports/monthly` 를 담당자 토큰으로
// 부르고, 맡은 근무지만 세는 판정은 서버가 한다(`decideReportAccess`·`scopeWorksites`). 서버는 원값만 주므로 반올림·문구를
// 앱과 같은 규칙으로 여기서 정한다 — 갈리면 앱과 PC 의 숫자가 다르게 보인다.
import { recentMonths } from './reports'

export type NoticeCategory = 'normal' | 'special' | 'urgent'

export type CategoryStats = {
  noticeCount: number
  readable: number
  read: number
  avgReadSeconds: number | null
}

/** `GET /dbo/reports/monthly` 응답(서버 `MonthlyReportRoute`). 어드민 master 리포트(`MonthlyReport`)와 모양이 다르다 */
export type ManagerMonthlyReport = {
  month: string
  through: string
  scope: { requested: number; counted: number; dropped: number }
  attendance: {
    total: { total: number; recorded: number }
    worksites: { worksiteId: string; name: string; total: number; recorded: number }[]
  }
  weeks: { week: number; startDay: number; endDay: number; missed: number }[]
  notices: { untracked: number } & Record<NoticeCategory, CategoryStats>
}

/** 응답 모양 검사 — 배포본이 다른 길로 덮였을 때 화면이 깨지는 대신 「다시 시도」 안내가 되게(앱 `getMonthlyReport` 와 같은 검사) */
export function isManagerReport(x: any): x is ManagerMonthlyReport {
  return !!x?.attendance?.total && Array.isArray(x.attendance.worksites) && Array.isArray(x.weeks) && !!x.notices
}

/** 운영 데이터가 있는 첫 달(앱 `REPORT_FIRST_MONTH` 와 같다). 그 전 달은 고를 수 없다 */
export const REPORT_FIRST_MONTH = '2026-08'

/** 고를 수 있는 달 — 이번 달부터 거꾸로 12개월, 첫 달 아래로 내려가지 않는다(앱 `reportMonths` 와 같다) */
export function managerReportMonths(today: string): { label: string; value: string }[] {
  return recentMonths(today).filter((m) => m.value >= REPORT_FIRST_MONTH)
}

/** 서버 `MAX_WORKSITES` 와 같다 — 넘으면 400 이라 보내기 전에 막는다 */
export const MAX_REPORT_WORKSITES = 100
/** 근무지별 출석률이 접혀 있을 때 보이는 수(앱과 같다) */
export const ATTENDANCE_ROWS_FOLDED = 5

/**
 * 「96.2%」. 분모 0 은 「—」.
 * **반올림이 100 이어도 전원이 아니면 99.9 / 99 로 내린다** — 빠진 사람이 있는데 완벽해 보이지 않게(앱과 같다)
 */
export function formatPercent(num: number, den: number, digits: 0 | 1): string {
  if (den === 0) return '—'
  const unit = digits === 1 ? 10 : 1
  let v = Math.round((num / den) * 100 * unit) / unit
  if (v >= 100 && num < den) v = 100 - 1 / unit
  return `${v.toFixed(digits)}%`
}

/** 「1분 미만」·「47분」·「6시간」·「1일」. 올린 결과가 단위를 넘으면 큰 단위로 넘긴다(앱과 같다) */
export function formatDuration(seconds: number | null): string {
  if (seconds === null) return '—'
  if (seconds < 60) return '1분 미만'
  const minutes = Math.round(seconds / 60)
  if (minutes < 60) return `${minutes}분`
  const hours = Math.round(seconds / 3600)
  if (hours < 24) return `${hours}시간`
  return `${Math.round(seconds / 86400)}일`
}

/** 0 보다 큰 막대의 최소 높이. 1건이 안 보이면 0건과 구분되지 않는다 */
const MIN_BAR = 4

/** 세로 막대 높이(px). 최대값과 같은 막대는 **모두** 강조한다 — 하나만 고르면 순서가 결과를 정한다 */
export function barLayout(values: number[], maxHeight: number): { height: number; highlight: boolean }[] {
  const max = Math.max(0, ...values)
  return values.map((v) => ({
    height: v <= 0 || max === 0 ? 0 : Math.max(MIN_BAR, Math.round((v / max) * maxHeight)),
    highlight: max > 0 && v === max,
  }))
}

type WorksiteRow = ManagerMonthlyReport['attendance']['worksites'][number]

/** 활동 0건 근무지는 뺀다. 출석률 낮은 순(챙길 곳 먼저), 같으면 이름순. 접으면 5곳 */
export function attendanceRows(worksites: WorksiteRow[], expanded: boolean): { rows: WorksiteRow[]; hidden: number } {
  const sorted = worksites
    .filter((w) => w.total > 0)
    .sort((a, b) => a.recorded / a.total - b.recorded / b.total || a.name.localeCompare(b.name, 'ko'))
  if (expanded) return { rows: sorted, hidden: 0 }
  return { rows: sorted.slice(0, ATTENDANCE_ROWS_FOLDED), hidden: Math.max(0, sorted.length - ATTENDANCE_ROWS_FOLDED) }
}

/** 공지 열람 한 줄. 확인율은 긴급에만 있다(긴급은 「확인」을 누른 사람만 센다) */
export function noticeLine(cat: NoticeCategory, s: CategoryStats): string {
  if (s.noticeCount === 0) return '공지 없음'
  const label = cat === 'urgent' ? '확인율' : '열람률'
  return `${label} ${formatPercent(s.read, s.readable, 0)} · 평균 ${formatDuration(s.avgReadSeconds)}`
}

/** 카드 위 알림 줄 — 셈에서 뺀 것 */
export function reportNotes(r: ManagerMonthlyReport): string[] {
  const out: string[] = []
  if (r.scope.dropped > 0) out.push(`맡지 않은 근무지 ${r.scope.dropped}곳은 뺐습니다.`)
  if (r.notices.untracked > 0) out.push(`발송 기록이 없는 옛 공지 ${r.notices.untracked}건은 빼고 셌습니다.`)
  return out
}

/** 담당자가 맡은 근무지 — 앱 `listMyWorksites` 와 같은 조회(RLS)로 받는다 */
export type ReportWorksite = { id: string; name: string; programId: string | null; programName: string | null }

/** 사업이 없거나 이름을 못 읽은 근무지를 묶는 칸(앱 `OTHER_PROGRAM` 과 같다). 사업 id(uuid)와 겹치지 않는다 */
const OTHER_PROGRAM = '__other__'

/** 앱 `groupByProgram` 과 같은 순서 — 사업 이름순, 「기타」는 맨 끝, 근무지는 이름순 */
function groupByProgram(worksites: ReportWorksite[]): { key: string; name: string; worksites: ReportWorksite[] }[] {
  const byKey = new Map<string, { key: string; name: string; worksites: ReportWorksite[] }>()
  for (const w of worksites) {
    const key = w.programId && w.programName ? w.programId : OTHER_PROGRAM
    const group = byKey.get(key) ?? { key, name: key === OTHER_PROGRAM ? '기타' : w.programName!, worksites: [] }
    group.worksites.push(w)
    byKey.set(key, group)
  }
  const ko = (a: string, b: string) => a.localeCompare(b, 'ko')
  const groups = [...byKey.values()]
  for (const g of groups) g.worksites.sort((a, b) => ko(a.name, b.name))
  return groups.sort((a, b) => (a.key === OTHER_PROGRAM ? 1 : b.key === OTHER_PROGRAM ? -1 : ko(a.name, b.name)))
}

/**
 * 범위 고르기 선택지 — 앱과 같은 「사업 › 근무지」. 값은 `p:{사업}`(그 사업 전체) · `w:{근무지 id}`.
 * 근무지가 하나뿐인 사업은 「전체」를 두지 않는다(같은 범위가 두 줄이 된다). **「전체 사업」은 없다**(앱 결정) — 첫 줄이 기본이다
 */
export function reportScopes(worksites: ReportWorksite[]): { value: string; label: string }[] {
  return groupByProgram(worksites).flatMap((g) => [
    ...(g.worksites.length > 1 ? [{ value: `p:${g.key}`, label: `${g.name} 전체` }] : []),
    ...g.worksites.map((w) => ({ value: `w:${w.id}`, label: `${g.name} · ${w.name}` })),
  ])
}

/** 고른 범위의 근무지 id. 맡은 목록에 없는 범위면 빈 목록 — 남의 근무지 id 를 그대로 보내지 않는다 */
export function scopeWorksiteIds(scope: string, worksites: ReportWorksite[]): string[] {
  if (scope.startsWith('w:')) {
    const id = scope.slice(2)
    return worksites.some((w) => w.id === id) ? [id] : []
  }
  if (scope.startsWith('p:')) {
    const group = groupByProgram(worksites).find((g) => g.key === scope.slice(2))
    return group ? group.worksites.map((w) => w.id) : []
  }
  return []
}

/**
 * 리포트를 못 받은 까닭. `retryable` 이 거짓이면 다시 눌러도 같은 결과라 화면이 「다시 시도」를 숨긴다(앱 `reportErrorFor` 와 같은 갈래)
 */
export function managerReportError(e: any): { message: string; retryable: boolean } {
  const status: number | undefined = e?.status ?? e?.statusCode
  const code: string | undefined = e?.data?.error
  if (status === 401) return { message: '로그인이 만료되었습니다. 다시 로그인해 주세요.', retryable: false }
  if (status === 403) return { message: '맡은 근무지의 리포트만 볼 수 있습니다.', retryable: false }
  if (status === 400 && code === 'bad_month') return { message: '고를 수 없는 달입니다.', retryable: false }
  if (status === 400) return { message: '근무지를 다시 골라 주세요.', retryable: false }
  return { message: '리포트를 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.', retryable: true }
}
