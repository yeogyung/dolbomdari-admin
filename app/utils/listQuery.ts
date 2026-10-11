// 목록의 검색·필터·정렬·페이지를 주소(query)와 주고받는 순수 함수 — `useListQuery` 가 쓴다

export type ListQueryDefaults = Record<string, string | number>

type RawQuery = Record<string, unknown>

function first(v: unknown): string | undefined {
  if (Array.isArray(v)) return typeof v[0] === 'string' ? v[0] : undefined
  return typeof v === 'string' ? v : undefined
}

/**
 * 주소의 값을 **기본값의 타입으로** 읽는다. 숫자 칸은 1 이상의 정수만 받고, 못 읽으면 기본값이다.
 * 사람이 주소를 고치거나 오래된 링크를 열어도 화면이 깨지지 않게 한다.
 */
export function readListQuery<T extends ListQueryDefaults>(query: RawQuery, defaults: T): T {
  const out: Record<string, string | number> = {}
  for (const [key, def] of Object.entries(defaults)) {
    const raw = first(query[key])
    if (raw === undefined) {
      out[key] = def
    } else if (typeof def === 'number') {
      const n = Number.parseInt(raw, 10)
      out[key] = Number.isFinite(n) && n >= 1 ? n : def
    } else {
      out[key] = raw
    }
  }
  return out as T
}

/** 기본값과 다른 것만 주소에 남긴다 — 처음 연 목록의 주소가 깨끗하다. */
export function toListQuery<T extends ListQueryDefaults>(values: T, defaults: T): Record<string, string> {
  const out: Record<string, string> = {}
  for (const [key, def] of Object.entries(defaults)) {
    const v = values[key]
    if (v !== undefined && v !== def) out[key] = String(v)
  }
  return out
}

/**
 * 직전 화면이 그 목록이었는지. vue-router 가 `history.state.back` 에 직전 주소를 둔다.
 * 그렇다면 상세의 「목록」은 뒤로 가기로 돌아가 필터를 지킨다 — 목록 주소로 새로 가면 초기화된다.
 */
export function cameFromList(back: unknown, listPath: string): boolean {
  if (typeof back !== 'string') return false
  const path = back.split('?')[0]
  return path === listPath
}

/**
 * 「검색」을 눌러야 정해지는 칸(검색어)은 입력 중인 값 대신 **마지막으로 정한 값**을 싣는다.
 * 치다 만 검색어가 주소에 남으면 상세에 다녀온 뒤 그 글자로 거른 목록이 나온다.
 */
export function withCommitted<T extends ListQueryDefaults>(values: T, committed: Partial<T>): T {
  return { ...values, ...committed }
}
