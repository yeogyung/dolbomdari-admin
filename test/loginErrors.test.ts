// 로그인 인증번호 오류 문구 테스트 — 종료된 계정(inactive) 안내
import { describe, expect, it } from 'vitest'
import { loginErrorMessage } from '../app/utils/loginErrors'

describe('loginErrorMessage', () => {
  it('종료된 계정(403 inactive)은 코드 대신 안내 문구', () => {
    expect(loginErrorMessage({ status: 403, data: { error: 'inactive' } }, '인증에 실패했습니다.')).toBe(
      '이용이 끝난 계정입니다. 담당자에게 문의해 주세요.',
    )
  })
  it('모르는 코드는 예전처럼 그대로, 코드가 없으면 기본 문구', () => {
    expect(loginErrorMessage({ data: { error: 'rate_limited' } }, '인증에 실패했습니다.')).toBe('rate_limited')
    expect(loginErrorMessage({ status: 500 }, '인증번호를 보내지 못했습니다.')).toBe('인증번호를 보내지 못했습니다.')
    expect(loginErrorMessage(null, '인증에 실패했습니다.')).toBe('인증에 실패했습니다.')
  })
})
