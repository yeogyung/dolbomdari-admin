// 반복 배정 기간 검사 테스트 — 시작일 필수(QA 2026-11-02 ADM-05), 종료일이 시작일보다 빠르면 막는다(QA 2026-10-14 5번), 서버 거절 문구
import { describe, expect, it } from 'vitest'
import { assignmentPeriodErrors, assignmentSaveError } from '../app/utils/dbo'

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

// 서버 2026-11-04 — 시작일 필수(ADM-05) · 겹치는 배정 거부(APP-05 · 결정 D6)
describe('assignmentSaveError', () => {
  const err = (status: number, data: Record<string, unknown>) => ({ status, data })

  it('시작일이 없다는 거절은 칸 문구와 같다', () => {
    expect(assignmentSaveError(err(400, { error: 'period_start_required' }))).toEqual({
      message: '시작일을 입력해 주세요.',
      conflicts: [],
    })
  })

  // 서버 계약 문서의 예시 응답 그대로
  it('겹친 배정을 요일·시간·기간 한 줄로 보인다', () => {
    const e = err(409, {
      error: 'assignment_overlap',
      conflicts: [
        { id: 'a1', weekdays: [5, 1, 2, 3, 4], start_time: '09:00:00', end_time: '11:00:00', period_start: '2026-09-01', period_end: null },
        { id: 'a2', weekdays: [6], start_time: '13:00:00', end_time: '15:30:00', period_start: '2026-10-01', period_end: '2026-12-31' },
      ],
    })
    expect(assignmentSaveError(e)).toEqual({
      message: '같은 시간에 이미 배정이 있습니다.',
      conflicts: ['월·화·수·목·금 09:00 – 11:00 · 2026-09-01 ~ 무기한', '토 13:00 – 15:30 · 2026-10-01 ~ 2026-12-31'],
    })
  })

  it('시작일 없는 옛 배정과 겹쳐도 깨지지 않는다', () => {
    const e = err(409, {
      error: 'assignment_overlap',
      conflicts: [{ id: 'a1', weekdays: [1], start_time: '09:00:00', end_time: '11:00:00', period_start: null, period_end: null }],
    })
    expect(assignmentSaveError(e)?.conflicts).toEqual(['월 09:00 – 11:00 · — ~ 무기한'])
  })

  it('겹친 목록이 없어도 문구는 낸다', () => {
    expect(assignmentSaveError(err(409, { error: 'assignment_overlap' }))).toEqual({
      message: '같은 시간에 이미 배정이 있습니다.',
      conflicts: [],
    })
  })

  // 옛 서버·다른 오류는 공용 문구로 간다
  it('다른 오류는 고르지 않는다', () => {
    expect(assignmentSaveError(err(400, { error: 'bad_request' }))).toBeNull()
    expect(assignmentSaveError(err(500, { error: 'shift_sync_failed' }))).toBeNull()
    expect(assignmentSaveError(new Error('network'))).toBeNull()
  })
})
