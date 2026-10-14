// 반복 배정 기간 검사 테스트 — 종료일이 시작일보다 빠르면 막는다(QA 2026-10-14 5번)
import { describe, expect, it } from 'vitest'
import { assignmentPeriodError } from '../app/utils/dbo'

describe('assignmentPeriodError', () => {
  it('종료일이 시작일보다 빠르면 막는다', () => {
    expect(assignmentPeriodError('2026-10-14', '2026-10-13')).toBe(
      '종료일은 시작일보다 빠를 수 없습니다.',
    )
  })

  it('같은 날이거나 뒤면 통과한다', () => {
    expect(assignmentPeriodError('2026-10-14', '2026-10-14')).toBeNull()
    expect(assignmentPeriodError('2026-10-14', '2026-12-31')).toBeNull()
  })

  it('한쪽이 비어 있으면(무기한) 통과한다', () => {
    expect(assignmentPeriodError(null, '2026-10-13')).toBeNull()
    expect(assignmentPeriodError('2026-10-14', null)).toBeNull()
  })
})
