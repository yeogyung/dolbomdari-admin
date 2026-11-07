// 계정·권한 목록 이름 검색·권한·상태·담당 근무지 필터 테스트(QA 2026-11-07 ADMIN-13)
import { describe, expect, it } from 'vitest'
import { accountWorksiteOptions, filterAccounts } from '../app/utils/accountList'

const items = [
  { id: 'a1', name: '김관리', role: 'master' as const, status: 'active' as const, worksite_id: null },
  { id: 'a2', name: '이수요', role: 'worksite' as const, status: 'active' as const, worksite_id: 'w2' },
  { id: 'a3', name: '박수요', role: 'worksite' as const, status: 'ended' as const, worksite_id: 'w1' },
  { id: 'a4', name: '최수요', role: 'worksite' as const, status: 'active' as const, worksite_id: 'w2' },
]
const NONE = { q: '', role: '', status: '', worksite: '' }
const ids = (list: { id: string }[]) => list.map((a) => a.id)

describe('filterAccounts', () => {
  it('조건이 없으면 받은 순서 그대로 전부', () => {
    expect(ids(filterAccounts(items, NONE))).toEqual(['a1', 'a2', 'a3', 'a4'])
  })
  it('이름 검색은 띄어쓰기를 무시한다', () => {
    expect(ids(filterAccounts(items, { ...NONE, q: '이 수요' }))).toEqual(['a2'])
  })
  it('권한·상태·담당 근무지로 거르고 함께 건다', () => {
    expect(ids(filterAccounts(items, { ...NONE, role: 'master' }))).toEqual(['a1'])
    expect(ids(filterAccounts(items, { ...NONE, status: 'ended' }))).toEqual(['a3'])
    expect(ids(filterAccounts(items, { ...NONE, worksite: 'w2' }))).toEqual(['a2', 'a4'])
    expect(ids(filterAccounts(items, { ...NONE, worksite: 'w2', q: '최' }))).toEqual(['a4'])
  })
})

describe('accountWorksiteOptions', () => {
  it('계정에 지정된 근무지만 한 번씩, 이름순', () => {
    const names: Record<string, string> = { w1: '하늘점', w2: '가람점' }
    expect(accountWorksiteOptions(items, (id) => names[id] ?? id)).toEqual([
      { label: '가람점', value: 'w2' },
      { label: '하늘점', value: 'w1' },
    ])
  })
})
