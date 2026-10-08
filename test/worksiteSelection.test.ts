// 근무지 일괄 선택 — 보이는 근무지만 넣고 빼며, 이미 고른 다른 근무지는 건드리지 않는다
import { describe, expect, it } from 'vitest'
import { addAll, removeAll } from '../app/utils/worksiteSelection'

describe('addAll', () => {
  it('보이는 근무지를 더하고 이미 고른 것은 순서를 지켜 남긴다', () => {
    expect(addAll(['x', 'a'], ['a', 'b', 'c'])).toEqual(['x', 'a', 'b', 'c'])
  })
  it('보이는 것이 없으면 그대로다', () => {
    expect(addAll(['x'], [])).toEqual(['x'])
  })
})

describe('removeAll', () => {
  it('보이는 근무지만 빼고 다른 사업에서 고른 것은 남긴다', () => {
    expect(removeAll(['x', 'a', 'b'], ['a', 'b', 'c'])).toEqual(['x'])
  })
})
