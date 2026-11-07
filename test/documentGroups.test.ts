// AI 문서 목록 최신 판 묶기·쪽 나누기 테스트(QA 2026-11-07 ADMIN-12, 결정 D22)
import { describe, expect, it } from 'vitest'
import { docLineageKey, documentPage, documentsForExport, groupDocuments, laterVersion } from '../app/utils/documentGroups'

const doc = (id: string, lineage_id: string | null, effective_date: string | null) => ({ id, lineage_id, effective_date })

// 계보 a: a1(첫 판) → a2 → a3(발효 예정) / 단독 문서 b / 계보 c: c1 → c2
const A1 = doc('a1', 'a1', '2026-01-01')
const A2 = doc('a2', 'a1', '2026-06-01')
const A3 = doc('a3', 'a1', '2026-12-01')
const B = doc('b', null, '2026-03-01')
const C1 = doc('c1', 'c1', '2026-02-01')
const C2 = doc('c2', 'c1', '2026-02-01')
// 서버 기본 정렬(발효일 최신순)
const LIST = [A3, A2, B, C1, C2, A1]

describe('docLineageKey', () => {
  it('계보가 있으면 첫 판 id, 없으면 자기 id(소문자)', () => {
    expect(docLineageKey(A2)).toBe('a1')
    expect(docLineageKey(doc('B-ID', null, null))).toBe('b-id')
  })
})

describe('laterVersion', () => {
  it('발효일이 늦은 쪽, 같으면 id 가 큰 쪽, 발효일 없는 판이 가장 이르다', () => {
    expect(laterVersion(A2, A1)).toBe(true)
    expect(laterVersion(C2, C1)).toBe(true)
    expect(laterVersion(doc('z', 'a1', null), A1)).toBe(false)
  })
})

describe('groupDocuments', () => {
  it('계보마다 가장 늦은 판 하나, 이전 판은 늦은 판부터', () => {
    const groups = groupDocuments(LIST)
    expect(groups.map((g) => g.latest.id)).toEqual(['a3', 'b', 'c2'])
    expect(groups[0]!.older.map((d) => d.id)).toEqual(['a2', 'a1'])
    expect(groups[1]!.older).toEqual([])
    expect(groups[2]!.older.map((d) => d.id)).toEqual(['c1'])
  })
  it('묶음 자리는 최신 판이 목록에 나온 자리다', () => {
    // 이름순처럼 옛 판이 앞에 오는 정렬이어도 최신 판 자리로 간다
    expect(groupDocuments([A1, B, A3, A2]).map((g) => g.latest.id)).toEqual(['b', 'a3'])
  })
  it('받은 목록 안에서만 묶는다 — 상태 필터로 빠진 판은 모른다', () => {
    expect(groupDocuments([A2, A1]).map((g) => g.latest.id)).toEqual(['a2'])
  })
})

describe('documentPage', () => {
  it('모든 판이면 받은 순서대로 쪽을 나눈다', () => {
    const p = documentPage(LIST, { latestOnly: false, expanded: new Set(), page: 2, size: 4 })
    expect(p.rows.map((r) => r.id)).toEqual(['c2', 'a1'])
    expect(p.total).toBe(6)
  })
  it('최신 판만이면 묶음 수로 쪽을 나누고 판 수를 단다', () => {
    const p = documentPage(LIST, { latestOnly: true, expanded: new Set(), page: 1, size: 2 })
    expect(p.rows.map((r) => [r.id, r.versions])).toEqual([
      ['a3', 3],
      ['b', 1],
    ])
    expect(p.total).toBe(3)
  })
  it('펼친 묶음은 이전 판을 그 쪽 안에 이어 붙인다', () => {
    const p = documentPage(LIST, { latestOnly: true, expanded: new Set(['a1']), page: 1, size: 1 })
    expect(p.rows.map((r) => [r.id, r.older ?? false])).toEqual([
      ['a3', false],
      ['a2', true],
      ['a1', true],
    ])
  })
})

describe('documentsForExport', () => {
  it('최신 판만이면 대표 판만, 아니면 전부', () => {
    expect(documentsForExport(LIST, true).map((d) => d.id)).toEqual(['a3', 'b', 'c2'])
    expect(documentsForExport(LIST, false)).toHaveLength(6)
  })
})
