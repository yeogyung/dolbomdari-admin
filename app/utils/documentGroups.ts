// AI 문서 목록의 「최신 판만」 묶기 — 같은 문서(판 계보)의 판 가운데 가장 늦은 판 하나를 대표로 보인다(QA 2026-11-07 ADMIN-12, 결정 D22)
import type { DocumentListItem } from '~/types/dbo'

type Doc = Pick<DocumentListItem, 'id' | 'lineage_id' | 'effective_date'>

/** 판 계보 열쇠 — 첫 판의 id(`lineage_id`). 이어 올린 판이 없으면 자기 id. 서버 `lineageKey` 와 같다 */
export function docLineageKey(d: Pick<Doc, 'id' | 'lineage_id'>): string {
  return (d.lineage_id ?? d.id).toLowerCase()
}

/** a 가 b 보다 늦은 판인가 — 서버 `laterThan` 과 같은 순서. 발효일이 늦은 쪽, 같으면 id 가 큰 쪽, 발효일 없는 판이 가장 이르다 */
export function laterVersion(a: Doc, b: Doc): boolean {
  const ea = a.effective_date ?? ''
  const eb = b.effective_date ?? ''
  if (ea !== eb) return ea > eb
  return a.id.toLowerCase() > b.id.toLowerCase()
}

export type DocGroup<T> = { latest: T; older: T[] }

/**
 * 계보마다 한 묶음. 묶음의 자리는 **최신 판이 받은 목록(서버 정렬)에 나온 자리**다 — 정렬을 바꾸면 최신 판 기준으로 움직인다.
 * `older` 는 늦은 판부터. 받은 목록 안에서만 묶는다(상태 필터로 빠진 판은 없다)
 */
export function groupDocuments<T extends Doc>(docs: T[]): DocGroup<T>[] {
  const latest = new Map<string, T>()
  for (const d of docs) {
    const key = docLineageKey(d)
    const held = latest.get(key)
    if (!held || laterVersion(d, held)) latest.set(key, d)
  }
  const olderOf = new Map<string, T[]>()
  for (const d of docs) {
    const key = docLineageKey(d)
    if (latest.get(key) !== d) olderOf.set(key, [...(olderOf.get(key) ?? []), d])
  }
  const groups: DocGroup<T>[] = []
  for (const d of docs) {
    const key = docLineageKey(d)
    if (latest.get(key) !== d) continue
    const older = (olderOf.get(key) ?? []).sort((a, b) => (laterVersion(a, b) ? -1 : laterVersion(b, a) ? 1 : 0))
    groups.push({ latest: d, older })
  }
  return groups
}

/** 표 한 줄 — 최신 판 줄은 판 수(`versions`), 펼쳐 보인 이전 판 줄은 `older` */
export type DocRow<T> = T & { versions?: number; older?: boolean }

/**
 * 화면의 한 쪽. 「최신 판만」이면 묶음 단위로 쪽을 나누고(펼친 이전 판은 그 쪽 안에 이어 붙인다 — 다음 쪽으로 밀리지 않게),
 * 「모든 판」이면 받은 순서대로 한 줄씩. `total` 은 쪽 나눔의 기준 수(묶음 수 또는 판 수)
 */
export function documentPage<T extends Doc>(
  docs: T[],
  opts: { latestOnly: boolean; expanded: Set<string>; page: number; size: number },
): { rows: DocRow<T>[]; total: number } {
  const start = (opts.page - 1) * opts.size
  if (!opts.latestOnly) return { rows: docs.slice(start, start + opts.size), total: docs.length }
  const groups = groupDocuments(docs)
  const rows: DocRow<T>[] = []
  for (const g of groups.slice(start, start + opts.size)) {
    rows.push({ ...g.latest, versions: g.older.length + 1 })
    if (opts.expanded.has(docLineageKey(g.latest))) for (const o of g.older) rows.push({ ...o, older: true })
  }
  return { rows, total: groups.length }
}

/** 엑셀 — 화면과 같은 기준(최신 판만이면 대표 판만). 펼침과 쪽은 보지 않는다 */
export function documentsForExport<T extends Doc>(docs: T[], latestOnly: boolean): T[] {
  return latestOnly ? groupDocuments(docs).map((g) => g.latest) : docs
}
