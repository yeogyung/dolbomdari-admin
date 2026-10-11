// 목록 화면의 검색·필터·페이지를 주소에 담는다 — 상세에서 뒤로 오면 그대로 복원된다(QA 2026-10-11)
import { describe, expect, it } from 'vitest'
import { cameFromList, readListQuery, toListQuery, withCommitted } from '../app/utils/listQuery'

const defaults = { page: 1, size: 20, q: '', status: '', sort: 'created_at' }

describe('readListQuery', () => {
  it('주소에 없으면 기본값', () => {
    expect(readListQuery({}, defaults)).toEqual(defaults)
  })
  it('주소의 값을 기본값의 타입으로 읽는다', () => {
    expect(readListQuery({ page: '3', size: '50', q: '김', status: 'active' }, defaults)).toEqual({
      ...defaults,
      page: 3,
      size: 50,
      q: '김',
      status: 'active',
    })
  })
  it('숫자가 아니거나 1 미만이면 기본값 — 손으로 고친 주소에 화면이 깨지지 않게', () => {
    expect(readListQuery({ page: 'abc', size: '0' }, defaults)).toMatchObject({ page: 1, size: 20 })
  })
  it('같은 키가 여러 번이면 첫 값', () => {
    expect(readListQuery({ q: ['가', '나'] }, defaults).q).toBe('가')
  })
})

describe('toListQuery', () => {
  it('기본값과 같은 것은 주소에서 뺀다', () => {
    expect(toListQuery(defaults, defaults)).toEqual({})
    expect(toListQuery({ ...defaults, page: 2, status: 'ended' }, defaults)).toEqual({
      page: '2',
      status: 'ended',
    })
  })
  it('왕복해도 같다', () => {
    const v = { ...defaults, page: 4, q: '홍길동', sort: 'name' }
    expect(readListQuery(toListQuery(v, defaults), defaults)).toEqual(v)
  })
})

describe('cameFromList', () => {
  it('직전 화면이 그 목록(필터 포함)이면 true', () => {
    expect(cameFromList('/senior/workers?status=active&page=2', '/senior/workers')).toBe(true)
    expect(cameFromList('/senior/workers', '/senior/workers')).toBe(true)
  })
  it('다른 화면이거나 모르면 false — 새 탭으로 연 상세는 목록 첫 화면으로', () => {
    expect(cameFromList('/senior/workers/abc', '/senior/workers')).toBe(false)
    expect(cameFromList('/senior/worksites', '/senior/workers')).toBe(false)
    expect(cameFromList(null, '/senior/workers')).toBe(false)
  })
})

describe('withCommitted', () => {
  it('검색어처럼 「검색」을 눌러야 정해지는 칸은 마지막으로 정한 값으로 바꿔 싣는다', () => {
    const typing = { ...defaults, q: '김순', page: 2 }
    expect(withCommitted(typing, { q: '김' })).toEqual({ ...defaults, q: '김', page: 2 })
  })
  it('정한 값이 없는 칸은 그대로', () => {
    expect(withCommitted({ ...defaults, q: '김' }, {})).toEqual({ ...defaults, q: '김' })
  })
})
