// 출결 목록 행에서 기록을 꺼내는 규칙 테스트 — 응답의 attendance 는 배열이 아니라 객체다
import { describe, expect, it } from 'vitest'
import { attendanceEditErrors, attendanceOf, canEditAttendance } from '../app/utils/dbo'

/* 2026-09-17 운영 DB 실측 응답. dbo-admin 이 도는 것과 같은 쿼리로 받았다. */
const CHECKED_IN = {
  id: 'ec91d75b-f062-427f-ba7c-2e086c6a6c07',
  work_date: '2026-09-17',
  attendance: {
    id: 'a554e00f-aea9-44e6-a537-473d2aa2fc3d',
    status: 'present',
    started_at: '2026-09-17T02:58:01.983+00:00',
    ended_at: null,
    method: 'qr',
    memo: null,
    updated_by: '2e0a967d-92f5-474a-b1ef-d6db9657613f',
    updated_at: '2026-09-17T02:58:02.022168+00:00',
  },
} as any

const NO_RECORD = { id: 'e0f35967-6240-4953-b40c-8e6fa7a9011b', attendance: null } as any

describe('attendanceOf', () => {
  it('QR 출근 기록을 꺼낸다', () => {
    expect(attendanceOf(CHECKED_IN)?.started_at).toBe('2026-09-17T02:58:01.983+00:00')
    expect(attendanceOf(CHECKED_IN)?.method).toBe('qr')
  })

  it('기록이 없는 근무는 null 이다', () => {
    expect(attendanceOf(NO_RECORD)).toBeNull()
  })
})

// QA 2026-10-14 6·7·14번 — 「기록 수정」 저장 전 검사
describe('attendanceEditErrors', () => {
  const ok = { memo: '출근 QR 미인식', startedAt: '2026-10-14T09:00', endedAt: '2026-10-14T13:00' }

  it('통과하면 빈 객체', () => {
    expect(attendanceEditErrors(ok)).toEqual({})
  })

  it('사유가 비거나 공백뿐이면 막는다', () => {
    expect(attendanceEditErrors({ ...ok, memo: '' }).memo).toBe('수정 사유를 입력해 주세요.')
    expect(attendanceEditErrors({ ...ok, memo: '   ' }).memo).toBe('수정 사유를 입력해 주세요.')
  })

  it('퇴근이 출근보다 빠르거나 같으면 막는다', () => {
    const msg = '퇴근 시각은 출근 시각보다 늦어야 합니다.'
    expect(attendanceEditErrors({ ...ok, endedAt: '2026-10-14T08:59' }).endedAt).toBe(msg)
    expect(attendanceEditErrors({ ...ok, endedAt: '2026-10-14T09:00' }).endedAt).toBe(msg)
  })

  it('자정을 넘긴 퇴근은 통과한다', () => {
    expect(
      attendanceEditErrors({ ...ok, startedAt: '2026-10-14T22:00', endedAt: '2026-10-15T02:00' }),
    ).toEqual({})
  })

  it('한쪽 시각만 있으면 순서를 보지 않는다', () => {
    expect(attendanceEditErrors({ ...ok, endedAt: null })).toEqual({})
    expect(attendanceEditErrors({ ...ok, startedAt: null })).toEqual({})
  })
})

describe('canEditAttendance', () => {
  it('오늘과 지난 날짜는 고칠 수 있다', () => {
    expect(canEditAttendance('2026-10-14', '2026-10-14')).toBe(true)
    expect(canEditAttendance('2026-10-01', '2026-10-14')).toBe(true)
  })

  it('미래 날짜는 고칠 수 없다', () => {
    expect(canEditAttendance('2026-10-15', '2026-10-14')).toBe(false)
  })
})
