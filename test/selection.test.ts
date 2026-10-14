// 표 머리글 체크박스의 페이지 전체 선택·해제 규칙 테스트(QA 2026-10-14 9번)
import { describe, expect, it } from 'vitest'
import { togglePageSelection } from '../app/utils/selection'

describe('togglePageSelection', () => {
  it('페이지 행이 다 선택돼 있지 않으면 빠진 행을 더한다', () => {
    expect(togglePageSelection(['x', 'a'], ['a', 'b'])).toEqual(['x', 'a', 'b'])
  })

  it('페이지 행이 다 선택돼 있으면 그 행만 뺀다. 다른 페이지 선택은 남긴다', () => {
    expect(togglePageSelection(['x', 'a', 'b'], ['a', 'b'])).toEqual(['x'])
  })

  it('빈 페이지는 그대로 둔다', () => {
    expect(togglePageSelection(['x'], [])).toEqual(['x'])
  })
})
