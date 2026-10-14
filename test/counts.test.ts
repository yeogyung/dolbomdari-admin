// 목록 집계 컬럼의 셈 — 행 수·서로 다른 값 수·0 채우기
import { describe, expect, it } from 'vitest'
import { tallyCounts } from '../shared/counts'

const rows = [
  { organization_id: 'o1', worker_id: 'w1' },
  { organization_id: 'o1', worker_id: 'w1' },
  { organization_id: 'o1', worker_id: 'w2' },
  { organization_id: 'o2', worker_id: 'w1' },
  { organization_id: null, worker_id: 'w3' },
]

describe('tallyCounts', () => {
  it('distinct 가 없으면 행 수', () => {
    expect(tallyCounts(rows, ['o1', 'o2', 'o3'], 'organization_id')).toEqual(
      new Map([['o1', 3], ['o2', 1], ['o3', 0]]),
    )
  })

  it('distinct 가 있으면 서로 다른 값 수 — 같은 종사자의 반복 기록은 한 번', () => {
    expect(tallyCounts(rows, ['o1', 'o2'], 'organization_id', 'worker_id')).toEqual(
      new Map([['o1', 2], ['o2', 1]]),
    )
  })

  it('distinct 값이 비어 있는 행은 세지 않는다', () => {
    expect(tallyCounts([{ organization_id: 'o1', worker_id: null }], ['o1'], 'organization_id', 'worker_id')).toEqual(
      new Map([['o1', 0]]),
    )
  })

  it('요청한 id 에 없는 행은 무시한다', () => {
    expect(tallyCounts(rows, ['o2'], 'organization_id')).toEqual(new Map([['o2', 1]]))
  })
})
