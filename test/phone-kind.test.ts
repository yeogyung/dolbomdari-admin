import { describe, expect, it } from 'vitest'
import { phoneKindFromMemo, withPhoneKind } from '../app/utils/phoneKind'

describe('휴대폰 종류 메모', () => {
  it('기존 메모를 보존하면서 종류를 추가하고 저장된 값에서 선택을 복원한다', () => {
    const memo = '오전 연락 희망\n가족 연락처는 별도 확인'
    const saved = withPhoneKind(memo, 'feature')
    expect(saved).toBe(memo + '\n휴대폰 종류: 일반폰')
    expect(phoneKindFromMemo(saved)).toBe('feature')
  })
  it('종류를 변경해도 기존 메모 위치와 내용은 유지하고 종류 줄은 중복되지 않는다', () => {
    const memo = '첫 메모\n휴대폰 종류: 일반폰\n다음 메모'
    const saved = withPhoneKind(memo, 'smartphone')
    expect(saved).toBe('첫 메모\n휴대폰 종류: 스마트폰\n다음 메모')
    expect(withPhoneKind(saved, 'smartphone')).toBe(saved)
    expect(phoneKindFromMemo(saved)).toBe('smartphone')
  })
  it('미확인은 종류 줄만 제거하고 자유롭게 작성한 휴대폰 관련 메모는 건드리지 않는다', () => {
    const memo = '스마트폰 사용이 어려움\n휴대폰 종류: 스마트폰'
    expect(withPhoneKind(memo, 'unknown')).toBe('스마트폰 사용이 어려움')
    expect(phoneKindFromMemo('스마트폰 사용이 어려움')).toBe('unknown')
    expect(withPhoneKind(memo, null)).toBe(memo)
  })
})
