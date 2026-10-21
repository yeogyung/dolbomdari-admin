// 출결 삭제 화면 규칙 테스트 — 사유 필수, 버튼 노출(역할·기록 유무·당일), 서버 오류 문구
import { describe, expect, it } from 'vitest'
import {
  canDeleteAttendance,
  deleteErrorMessage,
  deleteReasonError,
} from '../app/utils/attendanceDelete'

const TODAY = '2026-10-21'
const RECORD = {
  id: 'a',
  status: 'present',
  started_at: '2026-10-21T00:00:00Z',
  ended_at: null,
  method: 'qr',
  memo: null,
  updated_by: null,
  updated_at: '2026-10-21T00:00:00Z',
}
const row = (over: Partial<{ work_date: string; attendance: typeof RECORD | null }> = {}) => ({
  work_date: TODAY,
  attendance: RECORD,
  ...over,
})

describe('deleteReasonError', () => {
  it('비었거나 공백뿐이면 막는다', () => {
    expect(deleteReasonError('')).toBe('삭제 사유를 입력해 주세요.')
    expect(deleteReasonError('   \n')).toBe('삭제 사유를 입력해 주세요.')
  })
  it('내용이 있으면 통과한다', () => {
    expect(deleteReasonError(' 허위 출결 ')).toBeNull()
    expect(deleteReasonError('가'.repeat(1000))).toBeNull()
  })
  it('1000자를 넘으면 막는다', () => {
    expect(deleteReasonError('가'.repeat(1001))).toBe('삭제 사유는 1000자까지 쓸 수 있습니다.')
  })
})

describe('canDeleteAttendance', () => {
  it('master·담당자는 오늘 기록을 지울 수 있다', () => {
    expect(canDeleteAttendance('master', row(), TODAY)).toBe(true)
    expect(canDeleteAttendance('manager', row(), TODAY)).toBe(true)
  })
  it('수요처·기관 계정에는 버튼이 없다', () => {
    expect(canDeleteAttendance('worksite', row(), TODAY)).toBe(false)
    expect(canDeleteAttendance('org', row(), TODAY)).toBe(false)
    expect(canDeleteAttendance(undefined, row(), TODAY)).toBe(false)
  })
  it('기록이 없는 활동에는 버튼이 없다', () => {
    expect(canDeleteAttendance('master', row({ attendance: null }), TODAY)).toBe(false)
  })
  it('오늘이 아닌 활동에는 버튼이 없다', () => {
    expect(canDeleteAttendance('master', row({ work_date: '2026-10-20' }), TODAY)).toBe(false)
    expect(canDeleteAttendance('manager', row({ work_date: '2026-10-22' }), TODAY)).toBe(false)
  })
})

describe('deleteErrorMessage', () => {
  it('서버 오류 코드를 우리말로 바꾼다', () => {
    expect(deleteErrorMessage({ status: 403, data: { error: 'not_today' } })).toBe(
      '오늘 활동의 출결만 삭제할 수 있습니다.',
    )
    expect(deleteErrorMessage({ status: 403, data: { error: 'forbidden' } })).toBe(
      '이 출결을 삭제할 권한이 없습니다.',
    )
    expect(deleteErrorMessage({ status: 404, data: { error: 'attendance_not_found' } })).toBe(
      '이미 삭제됐거나 기록이 없는 출결입니다. 목록을 새로 고쳐 주세요.',
    )
    expect(deleteErrorMessage({ status: 404, data: { error: 'not_found' } })).toBe(
      '활동을 찾을 수 없습니다. 목록을 새로 고쳐 주세요.',
    )
    expect(deleteErrorMessage({ status: 403, data: { error: 'actor_not_found' } })).toBe(
      '계정 정보를 찾을 수 없습니다. 다시 로그인해 주세요.',
    )
    expect(deleteErrorMessage({ status: 400, data: { error: 'reason_required' } })).toBe(
      '삭제 사유를 입력해 주세요.',
    )
  })
  it('모르는 오류는 null — 화면이 공용 문구로 넘긴다', () => {
    expect(deleteErrorMessage({ status: 500, data: { error: 'internal' } })).toBeNull()
    expect(deleteErrorMessage(new Error('network'))).toBeNull()
  })
})
