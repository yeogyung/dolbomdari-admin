// 요일별 근무 시간 테스트 — 같은 시간인 요일끼리 배정 묶음으로 나누기·입력 검사·묶음별 저장 수(QA 2026-11-07 SHIFT-04 · 결정 D26)
import { describe, expect, it } from 'vitest'
import { assignmentTimeErrors, savedPerGroup, timeGroupLine, timeGroups } from '../app/utils/assignmentTimes'

const base = { weekdays: [3, 1, 2], startTime: '09:00', endTime: '11:00' }

describe('timeGroups', () => {
  it('같은 시간이면 배정 하나 — 요일은 월부터 차례로', () => {
    expect(timeGroups(base)).toEqual([{ weekdays: [1, 2, 3], startTime: '09:00', endTime: '11:00' }])
    // 요일마다 넣었어도 모두 같으면 하나다
    expect(timeGroups({ ...base, perDay: true, dayTimes: { 2: { start: '09:00', end: '11:00' } } })).toHaveLength(1)
  })

  it('요일마다 다르면 같은 시간인 요일끼리 묶는다. 묶음은 첫 요일 순', () => {
    const f = {
      weekdays: [5, 1, 3, 2],
      startTime: '09:00',
      endTime: '11:00',
      perDay: true,
      dayTimes: { 2: { start: '13:00', end: '15:00' }, 5: { start: '13:00', end: '15:00' } },
    }
    expect(timeGroups(f)).toEqual([
      { weekdays: [1, 3], startTime: '09:00', endTime: '11:00' },
      { weekdays: [2, 5], startTime: '13:00', endTime: '15:00' },
    ])
  })

  it('고르지 않은 요일의 시간은 버린다 · 시간을 안 넣은 요일은 공통 시간', () => {
    const f = { weekdays: [1], startTime: '10:00', endTime: '12:00', perDay: true, dayTimes: { 4: { start: '13:00', end: '15:00' } } }
    expect(timeGroups(f)).toEqual([{ weekdays: [1], startTime: '10:00', endTime: '12:00' }])
  })

  it('요일마다 다르게를 끄면 넣어 둔 요일별 시간은 쓰지 않는다', () => {
    const f = { ...base, perDay: false, dayTimes: { 2: { start: '13:00', end: '15:00' } } }
    expect(timeGroups(f)).toHaveLength(1)
  })
})

describe('assignmentTimeErrors', () => {
  it('같은 시간 — 비었거나 종료가 시작보다 늦지 않으면 막는다(여러 명 배정의 예전 문구 그대로)', () => {
    expect(assignmentTimeErrors({ ...base, startTime: '' })).toEqual({ time: '시작·종료 시간을 입력해 주세요.' })
    expect(assignmentTimeErrors({ ...base, startTime: '11:00', endTime: '09:00' })).toEqual({ time: '종료 시간은 시작 시간보다 늦어야 합니다.' })
    expect(assignmentTimeErrors(base)).toEqual({})
  })

  it('요일마다 — 고른 요일마다 따로 본다', () => {
    const f = {
      weekdays: [1, 2, 3],
      startTime: '09:00',
      endTime: '11:00',
      perDay: true,
      dayTimes: { 2: { start: '15:00', end: '13:00' }, 3: { start: '', end: '12:00' }, 6: { start: '20:00', end: '10:00' } },
    }
    expect(assignmentTimeErrors(f)).toEqual({
      days: { 2: '종료 시간은 시작 시간보다 늦어야 합니다.', 3: '시작·종료 시간을 입력해 주세요.' },
    })
  })
})

describe('timeGroupLine', () => {
  it('배정 표와 같은 표기', () => {
    expect(timeGroupLine({ weekdays: [1, 3], startTime: '09:00', endTime: '11:00' })).toBe('월·수 09:00 – 11:00')
  })
})

describe('savedPerGroup', () => {
  it('여러 명 × 시간 묶음 — 묶음마다 저장된 수', () => {
    const g1 = { weekdays: [1], startTime: '09:00', endTime: '11:00' }
    const g2 = { weekdays: [2], startTime: '13:00', endTime: '15:00' }
    const done = [{ g: g1 }, { g: g2 }, { g: g1 }]
    expect(savedPerGroup([g1, g2], done)).toEqual([
      { line: '월 09:00 – 11:00', count: 2 },
      { line: '화 13:00 – 15:00', count: 1 },
    ])
  })
})
