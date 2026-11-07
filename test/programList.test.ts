// 사업 목록 이름 검색·상태 필터 테스트(QA 2026-11-07 ADMIN-11)
import { describe, expect, it } from 'vitest'
import { filterPrograms } from '../app/utils/programList'
import { nameIncludes } from '../app/utils/nameSearch'

const items = [
  { id: 'p1', name: '시니어카페 2026', status: 'active' },
  { id: 'p2', name: '찾아가는 도시락', status: 'active' },
  { id: 'p3', name: '시니어카페 2025', status: 'ended' },
]
const ids = (list: { id: string }[]) => list.map((p) => p.id)

describe('nameIncludes', () => {
  it('띄어쓰기·대소문자를 무시하고, 빈 검색어는 모두 맞다', () => {
    expect(nameIncludes('찾아가는 도시락', '가는도시')).toBe(true)
    expect(nameIncludes('Test Site', 'test')).toBe(true)
    expect(nameIncludes('아무 이름', '  ')).toBe(true)
    expect(nameIncludes('시니어카페', '도시락')).toBe(false)
  })
})

describe('filterPrograms', () => {
  it('조건이 없으면 받은 순서 그대로 전부', () => {
    expect(ids(filterPrograms(items, { q: '', status: '' }))).toEqual(['p1', 'p2', 'p3'])
  })
  it('이름으로 찾는다', () => {
    expect(ids(filterPrograms(items, { q: '시니어 카페', status: '' }))).toEqual(['p1', 'p3'])
  })
  it('상태로 거르고 검색과 함께 건다', () => {
    expect(ids(filterPrograms(items, { q: '', status: 'ended' }))).toEqual(['p3'])
    expect(ids(filterPrograms(items, { q: '카페', status: 'active' }))).toEqual(['p1'])
  })
})
