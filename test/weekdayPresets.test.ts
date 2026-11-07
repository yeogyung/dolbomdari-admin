// 배정 요일 빠른 선택 테스트 — 평일·매일·주말 묶음과 눌린 모양 판정(QA 2026-11-07 SHIFT-01)
import { describe, expect, it } from 'vitest'
import { sameWeekdays, WEEKDAY_PRESETS, WEEKDAYS } from '../app/utils/dbo'

describe('WEEKDAY_PRESETS', () => {
  it('평일·매일·주말 순서로, ISO 요일 번호(1=월 … 7=일)를 쓴다', () => {
    expect(WEEKDAY_PRESETS.map((p) => [p.label, p.days])).toEqual([
      ['평일', [1, 2, 3, 4, 5]],
      ['매일', [1, 2, 3, 4, 5, 6, 7]],
      ['주말', [6, 7]],
    ])
    // 요일 버튼에 있는 번호만 쓴다
    const known = WEEKDAYS.map((w) => w.value)
    for (const p of WEEKDAY_PRESETS) expect(p.days.every((d) => known.includes(d))).toBe(true)
  })
})

describe('sameWeekdays', () => {
  it('순서와 관계없이 같은 요일 묶음이면 같다', () => {
    expect(sameWeekdays([5, 1, 2, 3, 4], [1, 2, 3, 4, 5])).toBe(true)
    expect(sameWeekdays([7, 6], [6, 7])).toBe(true)
  })
  it('하나라도 다르면 다르다', () => {
    expect(sameWeekdays([1, 2, 3, 4], [1, 2, 3, 4, 5])).toBe(false)
    expect(sameWeekdays([1, 2, 3, 4, 6], [1, 2, 3, 4, 5])).toBe(false)
    expect(sameWeekdays([], [6, 7])).toBe(false)
  })
})
