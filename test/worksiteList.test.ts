// 근무지 목록 거르기·정렬 테스트 — 담당자 미지정·인원 0명·상태 필터와 배정 인원 정렬(QA 2026-11-07 ADMIN-07)
import { describe, expect, it } from 'vitest'
import { filterWorksiteList, sortWorksiteList, type WorksiteListFilter } from '../app/utils/worksiteList'

const site = (
  id: string,
  over: Partial<{
    name: string
    program_id: string | null
    status: 'active' | 'ended'
    manager_directory_id: string | null
    care_manager_directory_id: string | null
    senior_count: number | undefined
  }> = {},
) => ({
  id,
  name: id,
  program_id: 'p1',
  status: 'active' as 'active' | 'ended',
  manager_directory_id: 'm',
  care_manager_directory_id: 'c',
  senior_count: 3 as number | undefined,
  ...over,
})

const NONE: WorksiteListFilter = { q: '', program: '', care: '', contact: '', seniors: '', status: '' }
const ids = (list: { id: string }[]) => list.map((w) => w.id)

describe('filterWorksiteList', () => {
  const rows = [
    site('a'),
    site('b', { care_manager_directory_id: null }),
    site('c', { manager_directory_id: null }),
    site('d', { senior_count: 0, status: 'ended' }),
    site('e', { senior_count: undefined, program_id: 'p2' }),
  ]

  it('조건이 없으면 모두', () => {
    expect(ids(filterWorksiteList(rows, NONE))).toEqual(['a', 'b', 'c', 'd', 'e'])
  })
  it('근무지 담당자 미지정과 수요처 담당자 미지정은 따로 거른다', () => {
    expect(ids(filterWorksiteList(rows, { ...NONE, care: 'none' }))).toEqual(['b'])
    expect(ids(filterWorksiteList(rows, { ...NONE, contact: 'none' }))).toEqual(['c'])
  })
  it('배정 인원 0명 — 인원을 못 센 곳은 0명으로 보지 않는다', () => {
    expect(ids(filterWorksiteList(rows, { ...NONE, seniors: '0' }))).toEqual(['d'])
  })
  it('상태·사업', () => {
    expect(ids(filterWorksiteList(rows, { ...NONE, status: 'ended' }))).toEqual(['d'])
    expect(ids(filterWorksiteList(rows, { ...NONE, status: 'active' }))).toEqual(['a', 'b', 'c', 'e'])
    expect(ids(filterWorksiteList(rows, { ...NONE, program: 'p2' }))).toEqual(['e'])
  })
  it('이름 검색은 대소문자를 가리지 않고 앞뒤 공백을 무시한다', () => {
    const named = [site('x', { name: '시니어카페 동방점' }), site('y', { name: 'Test Site' })]
    expect(ids(filterWorksiteList(named, { ...NONE, q: ' 동방 ' }))).toEqual(['x'])
    expect(ids(filterWorksiteList(named, { ...NONE, q: 'test' }))).toEqual(['y'])
  })
  it('조건은 함께 걸린다', () => {
    const both = [...rows, site('f', { care_manager_directory_id: null, manager_directory_id: null })]
    expect(ids(filterWorksiteList(both, { ...NONE, care: 'none', contact: 'none' }))).toEqual(['f'])
  })
})

describe('sortWorksiteList', () => {
  const rows = [
    site('하', { name: '하늘', senior_count: 2 }),
    site('가', { name: '가람', senior_count: 5 }),
    site('나', { name: '나무', senior_count: undefined }),
    site('다', { name: '다솜', senior_count: 2 }),
  ]

  it('이름 가나다순·역순', () => {
    expect(ids(sortWorksiteList(rows, 'name', 'asc'))).toEqual(['가', '나', '다', '하'])
    expect(ids(sortWorksiteList(rows, 'name', 'desc'))).toEqual(['하', '다', '나', '가'])
  })
  it('배정 인원순 — 같으면 이름순, 모르는 곳은 방향과 관계없이 맨 뒤', () => {
    expect(ids(sortWorksiteList(rows, 'senior_count', 'asc'))).toEqual(['다', '하', '가', '나'])
    expect(ids(sortWorksiteList(rows, 'senior_count', 'desc'))).toEqual(['가', '다', '하', '나'])
  })
  it('모르는 정렬 칸은 이름순이고 원본을 바꾸지 않는다', () => {
    const before = ids(rows)
    expect(ids(sortWorksiteList(rows, 'created_at', 'asc'))).toEqual(['가', '나', '다', '하'])
    expect(ids(rows)).toEqual(before)
  })
})
