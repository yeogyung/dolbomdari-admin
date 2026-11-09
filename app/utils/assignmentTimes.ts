// 요일별 근무 시간 — 같은 시간인 요일끼리 배정 묶음으로 나누고 입력을 검사한다(QA 2026-11-07 SHIFT-04 · 결정 D26)
//
// 배정 하나에는 시간이 한 쌍뿐이다(DB 그대로). 요일마다 시간이 다르면 **같은 시간인 요일끼리 묶어 배정 여러 개로 나눠**
// 기존 배정 API 를 차례로 부른다. 배정 목록에 줄이 그만큼 생기고 시니어 알림도 배정마다 간다(사용자 수용, 결정 D26).
import { weekdaysLabel } from './dbo'

/** 요일(ISO 1=월 … 7=일)별 시간. 값이 없는 요일은 공통 시간(startTime·endTime)을 쓴다 */
export type DayTimes = Partial<Record<number, { start: string; end: string }>>

export type AssignmentTimeInput = {
  weekdays: number[]
  /** 공통 시간 — 「모든 요일 같은 시간」이거나, 요일별 시간을 안 넣은 요일의 시간 */
  startTime: string
  endTime: string
  /** 「요일마다 다르게」 */
  perDay?: boolean
  dayTimes?: DayTimes
}

/** 저장할 배정 하나 */
export type TimeGroup = { weekdays: number[]; startTime: string; endTime: string }

/** 그 요일의 시간 */
export function dayTime(f: AssignmentTimeInput, day: number): { start: string; end: string } {
  if (!f.perDay) return { start: f.startTime, end: f.endTime }
  return f.dayTimes?.[day] ?? { start: f.startTime, end: f.endTime }
}

/** 같은 시간인 요일끼리 묶는다. 요일은 월부터, 묶음은 첫 요일 순. 고르지 않은 요일의 시간은 버린다 */
export function timeGroups(f: AssignmentTimeInput): TimeGroup[] {
  const groups = new Map<string, TimeGroup>()
  for (const day of [...f.weekdays].sort((a, b) => a - b)) {
    const t = dayTime(f, day)
    const key = `${t.start}~${t.end}`
    const g = groups.get(key) ?? { weekdays: [], startTime: t.start, endTime: t.end }
    g.weekdays.push(day)
    groups.set(key, g)
  }
  return [...groups.values()]
}

/**
 * 시간 검사(빈 객체면 통과). 종료가 시작보다 늦어야 한다 — 서버는 자정을 넘는 배정을 다루지 않고(겹침 판정이 하루 안의 초로 본다)
 * 시간 순서를 검사하지 않는다. 같은 시간이면 `time`, 요일마다면 고른 요일마다 `days`
 */
export function assignmentTimeErrors(f: AssignmentTimeInput): { time?: string; days?: Partial<Record<number, string>> } {
  const check = (start: string, end: string) =>
    !start || !end ? '시작·종료 시간을 입력해 주세요.' : end <= start ? '종료 시간은 시작 시간보다 늦어야 합니다.' : null
  if (!f.perDay) {
    const time = check(f.startTime, f.endTime)
    return time ? { time } : {}
  }
  const days: Partial<Record<number, string>> = {}
  for (const day of f.weekdays) {
    const t = dayTime(f, day)
    const msg = check(t.start, t.end)
    if (msg) days[day] = msg
  }
  return Object.keys(days).length ? { days } : {}
}

/** 배정 표와 같은 표기 — 「월·수 09:00 – 11:00」 */
export function timeGroupLine(g: TimeGroup): string {
  return `${weekdaysLabel(g.weekdays)} ${g.startTime} – ${g.endTime}`
}

/** 여러 명 × 시간 묶음 저장 결과 — 묶음마다 저장된 수(무엇이 저장됐는지 결과 창에 보인다) */
export function savedPerGroup(groups: TimeGroup[], done: { g: TimeGroup }[]): { line: string; count: number }[] {
  return groups.map((g) => ({ line: timeGroupLine(g), count: done.filter((d) => d.g === g).length }))
}
