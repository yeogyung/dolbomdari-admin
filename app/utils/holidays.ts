// 휴무 관리 화면 규칙 — 서버 응답 타입, 대시보드 띠 문구, 시각 묶기, 근무지 검색, 오류 문구, 직접 알릴 분
//
// **앱(`db-operation-rn/lib/holidays.ts`)과 같은 규칙이다.** 한쪽을 고치면 다른 쪽도 고친다.
// 판정은 서버(`GET /dbo/holidays`)가 한다. 여기는 받은 값을 그리는 규칙만 정한다.
import { searchByName } from './nameSearch'

export type HolidayKind = 'heat' | 'cold' | 'rain'
export type HolidayReason = HolidayKind | 'manual'

export type HolidayDay = {
  date: string
  low: number
  high: number
  /** `rain` 은 1시간 강수량(mm, 없으면 0·「1mm 미만」0.5). `hit` 은 판정 기준을 넘은 시각 — 화면이 강조한다 */
  hours: { hour: number; temp: number; rain: number; hit: boolean }[]
}

/** 근무지 구역에 발효 중인 특보 — 판정에 쓰였다 */
export type HolidayWarning = {
  kind: HolidayKind
  /** '폭염경보' · '호우주의보' … */
  name: string
  /** '서울서북권' */
  zone: string
  areaCode: string
  since: string
}

export type HolidayWorksite = {
  id: string
  name: string
  program: string | null
  grid: string | null
  alert: HolidayKind | null
  /** 그날 근무가 있는 시니어 수 */
  people: number
  holiday: { id: string; reason: HolidayReason; createdAt: string } | null
}

export type HolidayOverview = {
  date: string
  today: string
  /** 내일 이후면 지정·취소할 수 있다 */
  editable: boolean
  /** 특보 수집이 멈춰 예보로만 판정했다. 특보를 싣기 전 서버는 없다 */
  warningsStale?: boolean
  /** 격자마다 하나. 예보가 없으면 kind null · days [] · warnings [] */
  weather: {
    grid: string
    kind: HolidayKind | null
    days: HolidayDay[]
    warnings: HolidayWarning[]
  }[]
  worksites: HolidayWorksite[]
  upcoming: { date: string; worksites: number }[]
}

/** 시니어 알림 결과. `pushed` 는 나간 앱 푸시 수(토큰 기준), `aborted` 는 알림 단계가 중간에 멈춤 */
export type PushOutcome = { pushed: number; failed: number; aborted: boolean }

/**
 * 받는 방법 — 서버 `receiveChannel`. none 앱 계정 없음 · noPush 앱 알림 꺼짐 · push 앱 알림 받음.
 * 직접 알릴 분 명단에 push 가 섞이는 것은 이번 알림이 실패했을 때다.
 */
export type Channel = 'none' | 'noPush' | 'push'

export type ContactPerson = { directoryId: string; name: string; phone: string | null; channel: Channel }

/**
 * 직접 알릴 분 — 앱 알림을 못 받는 시니어를 근무지별로(알림 단계가 통째로 실패했으면 전원).
 * 서버가 명단을 못 읽었으면 null 이다.
 */
export type HolidayContacts = { worksiteId: string; worksite: string; people: ContactPerson[] }[]

export type CreateResult = {
  created: { worksiteId: string; holidayId: string; people: number }[]
  skipped: { worksiteId: string; reason: 'exists' }[]
  push: PushOutcome
  /** 특보·명단을 싣기 전 서버(2026-10-27 이전 배포)는 없다 */
  contacts?: HolidayContacts | null
}

export type CancelResult = { canceled: true; push: PushOutcome; contacts?: HolidayContacts | null }

const WEEKDAYS = ['일', '월', '화', '수', '목', '금', '토']
const DAY_MS = 86_400_000

const addDays = (date: string, n: number) =>
  new Date(Date.parse(`${date}T00:00:00Z`) + n * DAY_MS).toISOString().slice(0, 10)

/** 'YYYY-MM-DD' 의 다음 날 */
export const nextDate = (date: string) => addDays(date, 1)

/** '2026-10-28' → '10/28(수)' */
export function shortDate(date: string): string {
  const d = new Date(`${date}T00:00:00Z`)
  return `${d.getUTCMonth() + 1}/${d.getUTCDate()}(${WEEKDAYS[d.getUTCDay()]})`
}

/** 조건이 있고 아직 휴무가 아니며 그날 근무가 있는 근무지 */
export function pendingAlerts(o: HolidayOverview): HolidayWorksite[] {
  return o.worksites.filter((s) => s.alert !== null && s.holiday === null && s.people > 0)
}

/** 이어진 시각을 묶는다 — [12,13,14,16] → '12~14시, 16시'. 서버 `hoursLabel` 과 같은 결과다 */
export function hoursLabel(hours: number[]): string {
  const runs: [number, number][] = []
  for (const h of [...hours].sort((a, b) => a - b)) {
    const last = runs[runs.length - 1]
    if (last && h === last[1] + 1) last[1] = h
    else runs.push([h, h])
  }
  return runs.map(([a, b]) => (a === b ? `${a}시` : `${a}~${b}시`)).join(', ')
}

export const hitHours = (day: HolidayDay) => day.hours.filter((h) => h.hit).map((h) => h.hour)

const KIND_TITLE: Record<HolidayKind, string> = { heat: '폭염', cold: '한파', rain: '많은 비' }

/**
 * 대시보드 띠 문구. 조건이 남은 근무지가 없으면 null. **특보만으로 조건이 된 날은 특보를 말한다** —
 * 예보가 기준 아래인데 기준을 넘었다고 지어내지 않는다.
 */
export function alertHeadline(
  o: HolidayOverview,
): { kind: HolidayKind; title: string; detail: string; count: number } | null {
  const pending = pendingAlerts(o)
  const first = pending[0]
  if (!first || !first.alert) return null
  const kind = first.alert
  const when = o.date === addDays(o.today, 1) ? '내일' : shortDate(o.date)
  const weather = o.weather.find((w) => w.grid === first.grid)
  // 특보를 싣기 전 서버는 `warnings` 가 없다
  const warning = (weather?.warnings ?? []).find((w) => w.kind === kind)
  const warned = warning ? `${warning.zone} ${warning.name} 발효 중` : null
  const day = weather?.days.find((d) => d.date === o.date)
  const hits = day ? hitHours(day) : []
  const headline = (detail: string) => ({
    kind,
    // 모르는 종류(서버가 새로 더한)면 「날씨」 — 다른 조건으로 지어내지 않는다
    title: `${when} ${KIND_TITLE[kind] ?? '날씨'} 예보`,
    detail,
    count: pending.length,
  })

  if (kind === 'cold') {
    // 예보로 한파면 전날·그날 두 칸이 온다
    return headline(
      warned && (weather?.days.length ?? 0) < 2
        ? warned
        : `${shortDate(addDays(o.date, -1))}·${shortDate(o.date)} 영하 10도 이하`,
    )
  }
  if (kind === 'rain') {
    return headline(
      hits.length ? `${shortDate(o.date)} ${hoursLabel(hits)} 시간당 10mm 이상` : (warned ?? `${shortDate(o.date)} 많은 비 예보`),
    )
  }
  if (hits.length) return headline(`${shortDate(o.date)} ${hoursLabel(hits)} 30도 이상`)
  if (warned && !(day && day.high >= 30)) return headline(warned)
  return headline(
    day
      ? `${shortDate(o.date)} 최고 ${day.high}도`
      : // 그날 칸이 없으면 기온을 지어내지 않는다
        `${shortDate(o.date)} 30도 이상 예보`,
  )
}

/** 특보 발효 시각 → '10/27 11시'(분이 있으면 '11시 30분'). 읽지 못하면 빈 글자 */
export function sinceLabel(iso: string): string {
  const at = Date.parse(iso)
  if (Number.isNaN(at)) return ''
  const d = new Date(at + 9 * 60 * 60 * 1000)
  const minutes = d.getUTCMinutes()
  return `${d.getUTCMonth() + 1}/${d.getUTCDate()} ${d.getUTCHours()}시${minutes ? ` ${minutes}분` : ''}`
}

/** 시각 칸의 강수량 글자(mm 생략). 없으면 줄표, 「1mm 미만」은 <1 */
export function rainLabel(mm: number): string {
  if (mm <= 0) return '–'
  if (mm < 1) return '<1'
  return String(mm)
}

const CHANNEL_LABEL: Record<Channel, string> = {
  none: '앱 미설치',
  noPush: '앱 알림 꺼짐',
  push: '앱 알림 실패',
}

export const channelLabel = (channel: Channel) => CHANNEL_LABEL[channel]

/** 직접 알릴 분 수 — 근무지를 가로질러 센다 */
export function contactCount(contacts: HolidayContacts | null | undefined): number {
  return (contacts ?? []).reduce((n, g) => n + g.people.length, 0)
}

/**
 * 시니어에게 몇 건이 닿았는지. **앱 알림을 못 받는 분이 있으면 직접 알리라고 말한다** — 운영 시니어
 * 대부분이 아직 앱 알림을 켜지 않아(2026-10-26 1,599명 중 5명), 숫자 없이 「정했습니다」만 보이면
 * 알렸다고 여기게 된다. 앱(`lib/holidays.ts`)과 같은 규칙이고 말투만 합니다체다.
 */
function reachText(people: number, push: PushOutcome): string {
  if (push.aborted) return '시니어 알림을 보내지 못했습니다. 직접 알려 주세요.'
  const parts = [`시니어 ${people}명 중 앱 알림 ${push.pushed}건이 나갔습니다.`]
  if (push.failed) parts.push(`앱 알림 ${push.failed}건은 보내지 못했습니다.`)
  if (push.pushed < people) parts.push('앱 알림을 못 받는 분께는 직접 알려 주세요.')
  return parts.join(' ')
}

export function createNotice(result: CreateResult): string {
  const people = result.created.reduce((n, c) => n + c.people, 0)
  const parts = [`${result.created.length}곳을 휴무로 정했습니다.`]
  if (result.skipped.length) parts.push(`${result.skipped.length}곳은 이미 휴무였습니다.`)
  parts.push(reachText(people, result.push))
  return parts.join(' ')
}

export function cancelNotice(worksite: string, people: number, push: PushOutcome): string {
  return `${worksite} 휴무를 취소했습니다. ${reachText(people, push)}`
}

/** 근무지 검색 — 이름·사업 이름, 띄어쓰기 무시. 빈 검색어면 전부 */
export function filterWorksites(list: HolidayWorksite[], q: string): HolidayWorksite[] {
  if (!q.trim()) return list
  return searchByName(
    list.map((s) => ({ ...s, sub: s.program })),
    q,
    list.length,
  ).items.map(({ sub: _sub, ...s }) => s)
}

/** 서버 오류 코드 → 문구. 어드민 말투(합니다체)다 — 앱과 뜻은 같고 끝맺음만 다르다 */
export function holidayErrorMessage(code: string | null | undefined): string {
  if (code === 'not_editable') return '오늘과 지난 날은 바꿀 수 없습니다.'
  if (code === 'already_canceled') return '이미 취소된 휴무입니다.'
  if (code === 'forbidden') return '맡은 근무지만 휴무로 정할 수 있습니다.'
  if (code === 'not_found') return '근무지를 찾지 못했습니다. 새로고침해 주세요.'
  return '처리하지 못했습니다. 새로고침해서 결과를 확인한 뒤 다시 시도해 주세요.'
}

/** `$fetch` 오류에서 문구를 고른다. 서버는 `{ error: 코드 }` 를 준다 */
export function holidayErrorOf(e: any): string {
  const status: number | undefined = e?.status ?? e?.statusCode
  if (status === 401) return '로그인이 만료되었습니다. 다시 로그인해 주세요.'
  return holidayErrorMessage(e?.data?.error)
}
