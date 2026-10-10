// 엑셀 내보내기용 시각 표기(excelStamp) 테스트
import { describe, expect, it } from 'vitest'
import { excelStamp } from '../app/utils/excel'

describe('excelStamp', () => {
  it('UTC 시각을 서울 기준 연도 포함 표기로 바꾼다', () => {
    expect(excelStamp('2026-10-10T15:05:00Z')).toBe('2026-10-11 00:05')
  })

  it('해가 넘어가는 시각도 서울 기준 연도를 쓴다', () => {
    expect(excelStamp('2025-12-31T16:30:00Z')).toBe('2026-01-01 01:30')
  })

  it('빈 값·잘못된 값은 빈 문자열', () => {
    expect(excelStamp(null)).toBe('')
    expect(excelStamp(undefined)).toBe('')
    expect(excelStamp('not-a-date')).toBe('')
  })
})
