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

export type ForecastRow = { fcst_at: string; category: string; value: string }

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

/**
 * 날짜별 요약 — 최저·최고 기온과 비·눈 시간대. 담당자가 그날 근무를 쉬게 할지 한눈에 본다.
 * 칸이 있는 날만, 날짜순으로 낸다.
 */
export function daySummaries(slots: HourSlot[], today: string): DaySummary[] {
  const days = new Map<string, HourSlot[]>()
  for (const s of slots) days.set(s.date, [...(days.get(s.date) ?? []), s])
  return [...days.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, list]) => ({
      date,
      name: dayName(date, today),
      min: Math.min(...list.map((s) => s.temp)),
      max: Math.max(...list.map((s) => s.temp)),
      wetHours: list.filter(isWet).map((s) => s.hour),
    }))
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
