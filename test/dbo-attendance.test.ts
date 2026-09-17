// 출결 목록 행에서 기록을 꺼내는 규칙 테스트 — 응답의 attendance 는 배열이 아니라 객체다
import { describe, expect, it } from 'vitest'
import { attendanceOf } from '../app/utils/dbo'

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
