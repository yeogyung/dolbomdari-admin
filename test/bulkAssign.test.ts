// 여러 명 배정·배정 일괄 삭제 규칙 테스트 — 대상 고르기, 입력 검사, 실패 문구(QA 2026-11-07 SHIFT-02 · SHIFT-09)
import { describe, expect, it } from 'vitest'
import {
  assignmentWorksiteOptions,
  bulkAssignErrorMessage,
  bulkAssignFormErrors,
  bulkAssignTargets,
  bulkUnassignErrorMessage,
  isShiftSyncFailed,
  personLine,
} from '../app/utils/bulkAssign'

const person = (id: string, role = 'senior', status = 'active') => ({
  id,
  name: `이름${id}`,
  phone: '01012345678',
  role: role as 'senior' | 'manager' | 'worksite',
  status: status as 'active' | 'ended',
})

const form = {
  worksiteId: 'w1',
  weekdays: [1, 3],
  startTime: '09:00',
  endTime: '11:00',
  periodStart: '2026-11-09',
  periodEnd: null,
}

describe('personLine', () => {
  it('동명이인을 가르려고 번호를 붙인다', () => {
    expect(personLine({ name: '홍길동', phone: '01012345678' })).toBe('홍길동 (010-1234-5678)')
    expect(personLine({ name: '수요처', phone: null })).toBe('수요처')
  })
})

describe('bulkAssignTargets', () => {
  it('활동 중인 시니어만 배정하고, 담당자·수요처·종료된 사람은 까닭과 함께 뺀다', () => {
    const split = bulkAssignTargets([person('1'), person('2', 'manager'), person('3', 'senior', 'ended'), person('4', 'worksite')])
    expect(split.targets.map((p) => p.id)).toEqual(['1'])
    expect(split.skipped.map((s) => [s.row.id, s.reason])).toEqual([
      ['2', '시니어가 아니라 배정하지 않습니다.'],
      ['3', '종료된 사람이라 배정하지 않습니다.'],
      ['4', '시니어가 아니라 배정하지 않습니다.'],
    ])
  })
})

describe('bulkAssignFormErrors', () => {
  it('모두 채우면 통과', () => {
    expect(bulkAssignFormErrors(form)).toEqual({})
  })
  it('근무지·요일·시간·시작일이 비면 칸마다 알린다', () => {
    expect(bulkAssignFormErrors({ ...form, worksiteId: null, weekdays: [], startTime: '', periodStart: null })).toEqual({
      worksite: '근무지를 선택해 주세요.',
      weekdays: '근무 요일을 하나 이상 선택해 주세요.',
      time: '시작·종료 시간을 입력해 주세요.',
      start: '시작일을 입력해 주세요.',
    })
  })
  it('종료일이 시작일보다 빠르면 막는다', () => {
    expect(bulkAssignFormErrors({ ...form, periodEnd: '2026-11-01' })).toEqual({ end: '종료일은 시작일보다 빠를 수 없습니다.' })
  })
})

describe('bulkAssignErrorMessage', () => {
  it('겹친 배정은 겹친 배정까지 한 줄에', () => {
    const e = {
      status: 409,
      data: {
        error: 'assignment_overlap',
        conflicts: [{ weekdays: [1], start_time: '09:00:00', end_time: '12:00:00', period_start: '2026-11-01', period_end: null }],
      },
    }
    expect(bulkAssignErrorMessage(e)).toBe('같은 시간에 이미 배정이 있습니다. (월 09:00 – 12:00 · 2026-11-01 ~ 무기한)')
  })
  it('시작일 없음·잘못된 참조, 모르는 오류는 null', () => {
    expect(bulkAssignErrorMessage({ status: 400, data: { error: 'period_start_required' } })).toBe('시작일을 입력해 주세요.')
    expect(bulkAssignErrorMessage({ status: 400, data: { error: 'bad_reference' } })).toBe(
      '근무지나 사람을 찾을 수 없습니다. 목록을 새로 고쳐 주세요.',
    )
    expect(bulkAssignErrorMessage({ status: 500, data: { error: 'internal' } })).toBeNull()
  })
})

describe('isShiftSyncFailed', () => {
  it('저장은 됐고 근무 정리만 실패한 응답', () => {
    expect(isShiftSyncFailed({ status: 500, data: { error: 'shift_sync_failed' } })).toBe(true)
    expect(isShiftSyncFailed({ status: 500, data: { error: 'internal' } })).toBe(false)
  })
})

describe('assignmentWorksiteOptions', () => {
  it('배정이 있는 근무지만 건수와 함께 이름순', () => {
    const names: Record<string, string> = { w1: '은평점', w2: '교육장' }
    expect(
      assignmentWorksiteOptions([{ worksite_id: 'w1' }, { worksite_id: 'w2' }, { worksite_id: 'w2' }], (id) => names[id] ?? id),
    ).toEqual([
      { label: '교육장 (2건)', value: 'w2' },
      { label: '은평점 (1건)', value: 'w1' },
    ])
  })
})

describe('bulkUnassignErrorMessage', () => {
  it('근무 정리 실패면 지우지 않았다고, 없는 배정은 이미 지워졌다고', () => {
    expect(bulkUnassignErrorMessage({ status: 500, data: { error: 'shift_sync_failed' } })).toBe(
      '근무 정리에 실패해 이 배정은 지우지 않았습니다. 잠시 뒤 다시 해 주세요.',
    )
    expect(bulkUnassignErrorMessage({ status: 404, data: { error: 'not_found' } })).toBe('이미 지워진 배정입니다.')
    expect(bulkUnassignErrorMessage({ status: 500 })).toBeNull()
  })
})
