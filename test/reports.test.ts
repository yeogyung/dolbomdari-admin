// 리포트 화면 표기 유틸 — 월 목록·비율·근무시간·집계 기준일
import { describe, expect, it } from 'vitest'
import { fmtMinutes, pct, recentMonths, throughLabel } from '../app/utils/reports'

describe('recentMonths', () => {
  it('이번 달부터 거꾸로 12개월, 해를 넘긴다', () => {
    const m = recentMonths('2026-02-15')
    expect(m).toHaveLength(12)
    expect(m[0]).toEqual({ label: '2026년 2월', value: '2026-02' })
    expect(m[2]).toEqual({ label: '2025년 12월', value: '2025-12' })
    expect(m[11]!.value).toBe('2025-03')
  })
})

describe('pct', () => {
  it('소수 첫째 자리', () => expect(pct(1, 3)).toBe('33.3%'))
  it('분모 0 은 —', () => expect(pct(0, 0)).toBe('—'))
  it('100%', () => expect(pct(4, 4)).toBe('100%'))
})

describe('fmtMinutes', () => {
  it('시간과 분', () => expect(fmtMinutes(125)).toBe('2시간 5분'))
  it('1시간 미만', () => expect(fmtMinutes(45)).toBe('45분'))
  it('정시', () => expect(fmtMinutes(120)).toBe('2시간'))
  it('천 단위 구분', () => expect(fmtMinutes(60 * 1234)).toBe('1,234시간'))
})

describe('throughLabel', () => {
  it('M월 D일', () => expect(throughLabel('2026-10-05')).toBe('10월 5일'))
})
