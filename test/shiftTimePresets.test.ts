// 자주 쓰는 근무 시간 묶음 테스트 — 목록 값이 배정으로 저장할 수 있는 시간인지와 눌린 모양 판정(QA 2026-11-07 SHIFT-06 · 결정 D27)
import { describe, expect, it } from 'vitest'
import { assignmentTimeErrors } from '../app/utils/assignmentTimes'
import { SHIFT_TIME_PRESETS, isShiftPreset } from '../app/utils/shiftTimePresets'

describe('SHIFT_TIME_PRESETS', () => {
  it('오전·오후·종일 순서', () => {
    expect(SHIFT_TIME_PRESETS.map((p) => [p.label, p.start, p.end])).toEqual([
      ['오전', '09:00', '12:00'],
      ['오후', '13:00', '16:00'],
      ['종일', '09:00', '18:00'],
    ])
  })

  it('모두 배정으로 저장할 수 있는 시간이다 — HH:MM, 종료가 시작보다 늦다, 이름이 겹치지 않는다', () => {
    for (const p of SHIFT_TIME_PRESETS) {
      expect(p.start).toMatch(/^\d{2}:\d{2}$/)
      expect(p.end).toMatch(/^\d{2}:\d{2}$/)
      expect(assignmentTimeErrors({ weekdays: [1], startTime: p.start, endTime: p.end })).toEqual({})
    }
    expect(new Set(SHIFT_TIME_PRESETS.map((p) => p.label)).size).toBe(SHIFT_TIME_PRESETS.length)
  })
})

describe('isShiftPreset', () => {
  it('시작·종료가 그 묶음과 같으면 눌린 모양', () => {
    const am = SHIFT_TIME_PRESETS[0]!
    expect(isShiftPreset(am, '09:00', '12:00')).toBe(true)
    expect(isShiftPreset(am, '09:00', '11:00')).toBe(false)
  })
})
