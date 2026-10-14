// 화면 데이터를 탭 메모리에 일정 시간 보관하는 캐시 — 대시보드·리포트가 메뉴를 오갈 때 다시 요청하지 않게 한다

/** 기본 보관 기간 5분. 그동안 숫자가 바뀌어도 안 보이므로 화면에 「HH:MM 기준」과 새로고침을 같이 둔다 */
export const CACHE_TTL_MS = 5 * 60_000

type Entry = { at: number; value: Promise<unknown> }

export function createTtlCache(now: () => number = Date.now) {
  const store = new Map<string, Entry>()

  /**
   * 보관 기간 안이면 받아 둔 값을, 아니면 새로 받는다. `at` 은 그 값을 받은 시각이다.
   * 요청 중인 Promise 를 보관하므로 같은 키를 동시에 불러도 한 번만 나간다.
   * 실패는 보관하지 않는다 — 일부만 실패한 화면이 그 실패를 보관 기간 내내 붙잡지 않게.
   */
  async function get<T>(
    key: string,
    fetcher: () => Promise<T>,
    opts: { ttlMs?: number; force?: boolean } = {},
  ): Promise<{ value: T; at: number }> {
    const ttl = opts.ttlMs ?? CACHE_TTL_MS
    let entry = store.get(key)
    if (!entry || opts.force || now() - entry.at >= ttl) {
      entry = { at: now(), value: fetcher() }
      store.set(key, entry)
    }
    const current = entry
    try {
      return { value: (await current.value) as T, at: current.at }
    } catch (e) {
      // 그사이 새 요청으로 바뀌었으면 그 항목은 건드리지 않는다
      if (store.get(key) === current) store.delete(key)
      throw e
    }
  }

  return { get, clear: () => store.clear() }
}

/** 어드민 화면 공용 캐시. 로그아웃·권한 거부 때 `useAdminRole().clear()` 가 비운다 */
export const screenCache = createTtlCache()

/** 캐시 시각 표기 — 'HH:MM 기준' (서울) */
export function cachedAtLabel(at: number): string {
  const hm = new Intl.DateTimeFormat('ko-KR', {
    timeZone: 'Asia/Seoul',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(at)
  return `${hm} 기준`
}
