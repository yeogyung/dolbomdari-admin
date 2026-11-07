// 대시보드 날씨 카드의 기상청 단기예보 규칙 — 코드 → 날씨 종류, 시간대 묶기, 날짜별 요약
//
// **앱(`db-operation-rn/lib/weather.ts`)과 같은 규칙이다.** 한쪽을 고치면 다른 쪽도 고친다.
// 조회는 `components/WeatherCard.vue` 가 브라우저에서 바로 한다(RLS 로 범위가 좁혀진다).

const SEOUL_OFFSET_MS = 9 * 60 * 60 * 1000
const HOUR_MS = 60 * 60 * 1000

export type WeatherKind =
  | 'clear'
  | 'clear-night'
  | 'partly'
  | 'cloudy'
  | 'rain'
  | 'sleet'
  | 'snow'
  | 'shower'

const LABELS: Record<WeatherKind, string> = {
  clear: '맑음',
  'clear-night': '맑음',
  partly: '구름많음',
  cloudy: '흐림',
  rain: '비',
  sleet: '비/눈',
  snow: '눈',
  shower: '소나기',
}

export const weatherLabel = (kind: WeatherKind) => LABELS[kind]

/**
 * 기상청 코드 → 날씨 종류. **강수 형태(PTY)가 하늘 상태(SKY)보다 앞선다** — 흐리고 비가
 * 오면 「비」다. PTY 0 없음 · 1 비 · 2 비/눈 · 3 눈 · 4 소나기, SKY 1 맑음 · 3 구름많음 · 4 흐림.
 * 밤(19~6시) 맑음은 달로 그린다. 모르는 코드는 흐림 — 빈 아이콘보다 낫다.
 */
export function weatherKind(sky: string | null, pty: string | null, hour: number): WeatherKind {
  if (pty === '1') return 'rain'
  if (pty === '2') return 'sleet'
  if (pty === '3') return 'snow'
  if (pty === '4') return 'shower'
  if (sky === '1') return hour >= 19 || hour <= 6 ? 'clear-night' : 'clear'
  if (sky === '3') return 'partly'
  return 'cloudy'
}

/** `base_at` 은 그 값을 실어 온 기상청 발표 시각(UTC ISO) — 발표 시각 표시에만 쓴다 */
export type ForecastRow = { fcst_at: string; category: string; value: string; base_at?: string | null }

export type HourSlot = {
  /** 예보 시각(UTC ISO) */
  at: string
  /** 서울 날짜 'YYYY-MM-DD' */
  date: string
  /** 서울 시(0~23) */
  hour: number
  temp: number
  /** 강수 확률(%). 없으면 null */
  pop: number | null
  pty: string | null
  kind: WeatherKind
}

function num(v: string | undefined): number | null {
  if (v === undefined) return null
  const n = Number(v)
  return Number.isFinite(n) ? n : null
}

/** 카테고리 행을 시각별 한 칸으로 묶는다. 기온이 없는 시각은 버린다 — 빈 칸을 그리지 않는다 */
export function buildHourly(rows: ForecastRow[]): HourSlot[] {
  const byAt = new Map<string, Record<string, string>>()
  for (const r of rows) {
    const key = new Date(r.fcst_at).toISOString()
    const cell = byAt.get(key) ?? {}
    cell[r.category] = r.value
    byAt.set(key, cell)
  }
  const slots: HourSlot[] = []
  for (const [at, cell] of byAt) {
    const temp = num(cell.TMP)
    if (temp === null) continue
    const local = new Date(Date.parse(at) + SEOUL_OFFSET_MS)
    const hour = local.getUTCHours()
    slots.push({
      at,
      date: local.toISOString().slice(0, 10),
      hour,
      temp,
      pop: num(cell.POP),
      pty: cell.PTY ?? null,
      kind: weatherKind(cell.SKY ?? null, cell.PTY ?? null, hour),
    })
  }
  return slots.sort((a, b) => a.at.localeCompare(b.at))
}

/** 지금이 속한 시각의 칸, 없으면 가장 가까운 다음 칸. 모두 지났으면 null — 낡은 예보를 지금으로 보이지 않는다 */
export function currentSlot(slots: HourSlot[], now = Date.now()): HourSlot | null {
  return slots.find((s) => Date.parse(s.at) + HOUR_MS > now) ?? null
}

/** 오늘·내일·모레, 그 뒤는 'M월 D일'. 날짜 차이는 UTC 자정끼리 빼서 센다(서울 날짜 문자열 기준) */
export function dayName(date: string, today: string): string {
  const diff = Math.round((Date.parse(date) - Date.parse(today)) / 86_400_000)
  if (diff === 0) return '오늘'
  if (diff === 1) return '내일'
  if (diff === 2) return '모레'
  const [, m, d] = date.split('-')
  return `${Number(m)}월 ${Number(d)}일`
}

/** 강조할 칸 — 비·눈이 오거나 강수 확률 30% 이상. 담당자가 휴일을 판단하는 근거다 */
export function isWet(slot: HourSlot): boolean {
  return (slot.pty !== null && slot.pty !== '0') || (slot.pop ?? 0) >= 30
}

export type DaySummary = {
  date: string
  name: string
  min: number
  max: number
  /** 비·눈 또는 강수 확률 30% 이상인 시(서울). 없으면 빈 배열 */
  wetHours: number[]
}

/** 서울 날짜별 기상청 일 최저(TMN)·최고(TMX). 숫자가 아닌 값은 버린다 */
export type DayExtremes = Map<string, { tmn: number[]; tmx: number[] }>

/**
 * 예보 행에서 날짜별 TMN·TMX 를 모은다(QA 2026-11-07 NOTI-04). TMN 은 그날 6시, TMX 는 15시 예보 시각에 실려 온다.
 * 서버 휴무 판정(`dolbomdari-server/apps/dbo/_domain/holiday.ts` 의 `byDate`)과 같이 예보 시각의 서울 날짜로 묶는다
 */
export function dayExtremes(rows: ForecastRow[]): DayExtremes {
  const out: DayExtremes = new Map()
  for (const r of rows) {
    if (r.category !== 'TMN' && r.category !== 'TMX') continue
    const v = num(r.value)
    if (v === null) continue
    const date = new Date(Date.parse(r.fcst_at) + SEOUL_OFFSET_MS).toISOString().slice(0, 10)
    const day = out.get(date) ?? { tmn: [], tmx: [] }
    ;(r.category === 'TMN' ? day.tmn : day.tmx).push(v)
    out.set(date, day)
  }
  return out
}

/**
 * 날짜별 요약 — 최저·최고 기온과 비·눈 시간대. 담당자가 그날 근무를 쉬게 할지 한눈에 본다.
 * 칸이 있는 날만, 날짜순으로 낸다.
 *
 * 최저는 시간별 기온과 TMN 가운데 낮은 값, 최고는 시간별 기온과 TMX 가운데 높은 값이다 — 서버 휴무 판정과 같은 규칙.
 * 시간별 기온만 보면 휴무 관리 화면과 1도씩 어긋났다(QA 2026-11-07 NOTI-04, 대시보드 4° · 휴무 관리 3°).
 * 앱(`lib/weather.ts`)은 아직 시간별 기온만 본다 — 앱도 같은 규칙으로 맞춰야 한다
 */
export function daySummaries(slots: HourSlot[], today: string, extremes: DayExtremes = new Map()): DaySummary[] {
  const days = new Map<string, HourSlot[]>()
  for (const s of slots) days.set(s.date, [...(days.get(s.date) ?? []), s])
  return [...days.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, list]) => {
      const temps = list.map((s) => s.temp)
      const ext = extremes.get(date)
      return {
        date,
        name: dayName(date, today),
        min: Math.min(...temps, ...(ext?.tmn ?? [])),
        max: Math.max(...temps, ...(ext?.tmx ?? [])),
        wetHours: list.filter(isWet).map((s) => s.hour),
      }
    })
}

/** 받은 예보 가운데 가장 늦은 발표 시각(`base_at`). 없으면 null */
export function latestBaseAt(rows: { base_at?: string | null }[]): string | null {
  let best: string | null = null
  let bestMs = -Infinity
  for (const r of rows) {
    const ms = r.base_at ? Date.parse(r.base_at) : NaN
    if (Number.isFinite(ms) && ms > bestMs) {
      bestMs = ms
      best = r.base_at!
    }
  }
  return best
}

/** 발표 시각 문구 — 「기상청 11시 발표」. 오늘(서울) 발표가 아니면 「어제」·「M월 D일」을 붙인다 */
export function issueLabel(baseAt: string, today: string): string {
  const local = new Date(Date.parse(baseAt) + SEOUL_OFFSET_MS)
  const date = local.toISOString().slice(0, 10)
  const hour = local.getUTCHours()
  const diff = Math.round((Date.parse(today) - Date.parse(date)) / 86_400_000)
  const day = diff === 0 ? '' : diff === 1 ? '어제 ' : `${Number(date.slice(5, 7))}월 ${Number(date.slice(8, 10))}일 `
  return `기상청 ${day}${hour}시 발표`
}

/** 비·눈 시간대 문구. 이어진 시간은 묶는다 — [9,10,11,15] → '9~12시, 15~16시' */
export function wetHoursLabel(hours: number[]): string {
  if (hours.length === 0) return '비·눈 소식 없음'
  const runs: [number, number][] = []
  for (const h of hours) {
    const last = runs[runs.length - 1]
    if (last && h === last[1] + 1) last[1] = h
    else runs.push([h, h])
  }
  return `비·눈 가능 ${runs.map(([a, b]) => `${a}~${b + 1}시`).join(', ')}`
}

/** 표 한 줄 — 날짜 하나의 0~23시. 예보가 없는 시는 null */
export function hourRow(slots: HourSlot[], date: string): (HourSlot | null)[] {
  const row: (HourSlot | null)[] = Array.from({ length: 24 }, () => null)
  for (const s of slots) if (s.date === date) row[s.hour] = s
  return row
}

/** 오늘부터 n 일의 서울 날짜 'YYYY-MM-DD' */
export function seoulDates(n: number, now = Date.now()): string[] {
  return Array.from({ length: n }, (_, i) =>
    new Date(now + SEOUL_OFFSET_MS + i * 86_400_000).toISOString().slice(0, 10),
  )
}
