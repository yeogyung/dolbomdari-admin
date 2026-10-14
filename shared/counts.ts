// 목록 집계 컬럼의 셈 — 대상 행을 부모 id 별로 센다(서버 attachCounts 가 조회, 여기는 순수 계산)

/**
 * `ids` 마다 `fk` 가 그 id 인 행 수를 센다. `distinct` 를 주면 그 컬럼의 서로 다른 값 수다
 * (같은 종사자를 여러 번 열람한 기록이 「종사자 수」를 부풀리지 않게). 행이 없는 id 는 0.
 */
export function tallyCounts(
  rows: Record<string, unknown>[],
  ids: string[],
  fk: string,
  distinct?: string,
): Map<string, number> {
  const seen = new Map<string, Set<unknown> | number>(ids.map((id) => [id, distinct ? new Set() : 0]))
  for (const r of rows) {
    const key = r[fk] as string
    const cur = seen.get(key)
    if (cur === undefined) continue
    if (cur instanceof Set) {
      if (r[distinct!] !== null && r[distinct!] !== undefined) cur.add(r[distinct!])
    } else seen.set(key, cur + 1)
  }
  return new Map([...seen].map(([id, v]) => [id, v instanceof Set ? v.size : v]))
}
