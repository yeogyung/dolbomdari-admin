// 구인구직 상세 시각 표기 — yyyy.mm.dd hh:mm (서울)
import { describe, expect, it } from 'vitest'
import { fmtDateTime } from '../app/utils/datetime'

describe('fmtDateTime', () => {
  it('UTC 를 서울 시각 yyyy.mm.dd hh:mm 으로', () => {
    expect(fmtDateTime('2026-10-14T15:05:09.123Z')).toBe('2026.10.15 00:05')
  })
  it('+00:00 오프셋이 붙은 Postgres timestamptz 문자열도 받는다', () => {
    expect(fmtDateTime('2026-01-02T03:04:05+00:00')).toBe('2026.01.02 12:04')
  })
  it('빈 값·잘못된 값은 —', () => {
    expect(fmtDateTime(null)).toBe('—')
    expect(fmtDateTime('')).toBe('—')
    expect(fmtDateTime('not-a-date')).toBe('—')
  })
})
