// 목록 툴바 근무지 필터 선택지 테스트 — 사업으로 좁히기, 검색, 사업을 바꾸면 선택 풀기(QA 2026-11-07 ADMIN-04)
import { describe, expect, it } from 'vitest'
import { inProgram, worksiteChoices, worksiteOutsideProgram } from '../app/utils/worksiteFilter'

const sites = [
  { id: 'w1', name: '서대문시니어클럽', program_id: 'p1' },
  { id: 'w2', name: '시니어카페 동방점', program_id: 'p1' },
  { id: 'w3', name: '서대문시니어클럽', program_id: 'p2' },
  { id: 'w4', name: '야미야미 조리장', program_id: null },
]
const names: Record<string, string> = { p1: '시니어카페', p2: '찾아가는도시락' }
const programName = (id: string | null) => (id ? (names[id] ?? null) : null)

describe('inProgram', () => {
  it('사업을 골랐으면 그 사업 근무지만, 아니면 전부', () => {
    expect(inProgram(sites, 'p1').map((w) => w.id)).toEqual(['w1', 'w2'])
    expect(inProgram(sites, '')).toHaveLength(4)
  })
})

describe('worksiteChoices', () => {
  it('검색어가 없으면 사업 안 근무지를 이름 가나다순으로 전부', () => {
    expect(worksiteChoices(sites, '', '').map((w) => w.id)).toEqual(['w1', 'w3', 'w2', 'w4'])
    expect(worksiteChoices(sites, '  ', 'p1').map((w) => w.id)).toEqual(['w1', 'w2'])
  })
  it('띄어쓰기를 무시하고 이름으로 찾는다 — 상한 없이 모두', () => {
    expect(worksiteChoices(sites, '서대문 시니어', '').map((w) => w.id)).toEqual(['w1', 'w3'])
    expect(worksiteChoices(sites, '야미야미', '').map((w) => w.id)).toEqual(['w4'])
  })
  it('사업 이름으로도 찾되 이름에 든 곳을 앞에 둔다', () => {
    expect(worksiteChoices(sites, '도시락', '', programName).map((w) => w.id)).toEqual(['w3'])
    expect(worksiteChoices(sites, '시니어카페', '', programName).map((w) => w.id)).toEqual(['w2', 'w1'])
  })
  it('사업으로 좁힌 뒤 찾는다', () => {
    expect(worksiteChoices(sites, '서대문', 'p2').map((w) => w.id)).toEqual(['w3'])
  })
})

describe('worksiteOutsideProgram', () => {
  it('고른 근무지가 다른 사업이면 true', () => {
    expect(worksiteOutsideProgram(sites, 'w3', 'p1')).toBe(true)
    expect(worksiteOutsideProgram(sites, 'w1', 'p1')).toBe(false)
  })
  it('사업·근무지를 고르지 않았거나 근무지를 아직 모르면 풀지 않는다', () => {
    expect(worksiteOutsideProgram(sites, '', 'p1')).toBe(false)
    expect(worksiteOutsideProgram(sites, 'w3', '')).toBe(false)
    expect(worksiteOutsideProgram([], 'w3', 'p1')).toBe(false)
  })
})
