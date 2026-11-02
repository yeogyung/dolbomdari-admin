// 반복 배정 기간 검사 테스트 — 시작일 필수(QA 2026-11-02 ADM-05), 종료일이 시작일보다 빠르면 막는다(QA 2026-10-14 5번)
import { describe, expect, it } from 'vitest'
import { assignmentPeriodErrors } from '../app/utils/dbo'

describe('assignmentPeriodErrors', () => {
  it('종료일이 시작일보다 빠르면 종료일 칸을 막는다', () => {
    expect(assignmentPeriodErrors('2026-10-14', '2026-10-13')).toEqual({
      end: '종료일은 시작일보다 빠를 수 없습니다.',
    })
  })

  it('같은 날이거나 뒤면 통과한다', () => {
    expect(assignmentPeriodErrors('2026-10-14', '2026-10-14')).toEqual({})
    expect(assignmentPeriodErrors('2026-10-14', '2026-12-31')).toEqual({})
  })

  it('종료일이 비면 무기한이라 통과한다', () => {
    expect(assignmentPeriodErrors('2026-10-14', null)).toEqual({})
  })

  // QA 2026-11-02 ADM-05 — 시작일을 비운 채 저장되어 「— ~ 무기한」 배정이 생겼다.
  it('시작일이 비면 시작일 칸을 막는다', () => {
    expect(assignmentPeriodErrors(null, null)).toEqual({ start: '시작일을 입력해 주세요.' })
    expect(assignmentPeriodErrors(null, '2026-10-13')).toEqual({ start: '시작일을 입력해 주세요.' })
    expect(assignmentPeriodErrors('', null)).toEqual({ start: '시작일을 입력해 주세요.' })
  })
})
