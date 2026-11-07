// 출퇴근 기록 일괄 상태 변경·선택 삭제 대상 고르기와 실패 문구 테스트(QA 2026-11-07 ADMIN-05 · ADMIN-15)
import { describe, expect, it } from 'vitest'
import {
  attendanceRowName,
  bulkDeleteErrorMessage,
  bulkDeleteTargets,
  bulkEditErrorMessage,
  bulkEditTargets,
  canSelectAttendance,
} from '../app/utils/attendanceBulk'

const TODAY = '2026-11-07'
const rec = { id: 'a', status: 'present', started_at: null, ended_at: null, method: 'qr', memo: null, updated_by: null, updated_at: 't' }
const row = (id: string, work_date: string, withRecord = true) => ({ id, work_date, attendance: withRecord ? rec : null })

describe('canSelectAttendance', () => {
  it('운영관리자·담당자만 고른다 — 수요처는 조정 요청만', () => {
    expect(canSelectAttendance('master')).toBe(true)
    expect(canSelectAttendance('manager')).toBe(true)
    expect(canSelectAttendance('worksite')).toBe(false)
    expect(canSelectAttendance(undefined)).toBe(false)
  })
})

describe('bulkEditTargets', () => {
  it('오늘·지난 근무는 넣고(기록 없어도) 앞으로 할 근무는 뺀다', () => {
    const split = bulkEditTargets([row('past', '2026-11-01'), row('today', TODAY, false), row('future', '2026-11-08')], 'master', TODAY)
    expect(split.targets.map((r) => r.id)).toEqual(['past', 'today'])
    expect(split.skipped).toEqual([{ row: row('future', '2026-11-08'), reason: '앞으로 할 근무는 고칠 수 없습니다.' }])
  })
  it('수요처는 모두 뺀다', () => {
    const split = bulkEditTargets([row('past', '2026-11-01')], 'worksite', TODAY)
    expect(split.targets).toEqual([])
    expect(split.skipped[0]!.reason).toBe('수요처 계정은 고칠 수 없습니다.')
  })
})

describe('bulkDeleteTargets', () => {
  it('오늘 기록만 넣고 지난 날·기록 없는 근무는 까닭과 함께 뺀다', () => {
    const split = bulkDeleteTargets(
      [row('today', TODAY), row('past', '2026-11-06'), row('empty', TODAY, false)],
      'manager',
      TODAY,
    )
    expect(split.targets.map((r) => r.id)).toEqual(['today'])
    expect(split.skipped.map((s) => [s.row.id, s.reason])).toEqual([
      ['past', '오늘 기록만 지울 수 있습니다.'],
      ['empty', '지울 출결 기록이 없는 근무입니다.'],
    ])
  })
  it('수요처는 지울 수 없다', () => {
    const split = bulkDeleteTargets([row('today', TODAY)], 'worksite', TODAY)
    expect(split.targets).toEqual([])
    expect(split.skipped[0]!.reason).toBe('삭제할 권한이 없습니다.')
  })
})

describe('bulkEditErrorMessage', () => {
  it('동시 수정은 덮어쓰지 않았다고 알린다', () => {
    expect(bulkEditErrorMessage({ status: 409, data: { error: 'attendance_conflict' } })).toBe(
      '다른 곳에서 먼저 고친 기록이라 바꾸지 않았습니다.',
    )
  })
  it('근무 없음·권한 없음, 모르는 오류는 null', () => {
    expect(bulkEditErrorMessage({ status: 404, data: { error: 'not_found' } })).toBe('근무를 찾을 수 없습니다.')
    expect(bulkEditErrorMessage({ status: 403, data: { error: 'forbidden' } })).toBe('이 기록을 고칠 권한이 없습니다.')
    expect(bulkEditErrorMessage({ status: 500, data: { error: 'internal' } })).toBeNull()
  })
})

describe('bulkDeleteErrorMessage', () => {
  it('건별 삭제와 같은 문구', () => {
    expect(bulkDeleteErrorMessage({ data: { error: 'not_today' } })).toBe('오늘 활동의 출결만 삭제할 수 있습니다.')
    expect(bulkDeleteErrorMessage({ data: { error: 'internal' } })).toBeNull()
  })
})

describe('attendanceRowName', () => {
  it('이름 · 근무일 · 근무지, 모르면 —', () => {
    expect(attendanceRowName({ work_date: TODAY, directory: { name: '홍길동', phone: null }, worksite: { name: '서대문점' } })).toBe(
      '홍길동 · 2026-11-07 · 서대문점',
    )
    expect(attendanceRowName({ work_date: TODAY, directory: null, worksite: null })).toBe('— · 2026-11-07 · —')
  })
})
