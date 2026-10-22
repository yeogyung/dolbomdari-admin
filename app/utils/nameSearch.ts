// 이름 검색 규칙 — 띄어쓰기·대소문자 무시, 이름이 검색어로 시작하는 것을 앞에, 보조 이름(사업)도 찾음, 상한과 나머지 수

/** 비교용으로 띄어쓰기를 빼고 소문자로 바꾼다 */
const norm = (s: string) => s.replace(/\s+/g, '').toLowerCase()

/**
 * 이름(또는 보조 이름 `sub`, 예: 사업 이름)에 검색어가 들어간 것을 찾는다. 빈 검색어는 아무것도
 * 찾지 않는다 — 목록을 띄우지 않기 위해서다.
 * 순서: 이름이 검색어로 시작 → 이름에 들어감 → 보조 이름에만 들어감. 같은 묶음 안은 원래 순서.
 */
export function searchByName<T extends { name: string; sub?: string | null }>(
  items: T[],
  term: string,
  limit = 8,
): { items: T[]; more: number } {
  const word = norm(term)
  if (!word) return { items: [], more: 0 }
  const rank = (it: T) => {
    const name = norm(it.name)
    if (name.startsWith(word)) return 0
    if (name.includes(word)) return 1
    if (it.sub && norm(it.sub).includes(word)) return 2
    return -1
  }
  const ranked = items
    .map((it, i) => ({ it, i, r: rank(it) }))
    .filter((x) => x.r >= 0)
    .sort((a, b) => a.r - b.r || a.i - b.i)
    .map((x) => x.it)
  return { items: ranked.slice(0, limit), more: Math.max(0, ranked.length - limit) }
}
