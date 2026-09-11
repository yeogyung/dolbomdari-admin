// Solapi 문자 발송 유틸 테스트 — 전화번호 정규화와 HMAC 서명 형식을 검증한다
import { describe, expect, it } from 'vitest'
import { buildAuthHeader, toSolapiPhone } from '../server/utils/sms'

describe('toSolapiPhone', () => {
  it('국내 형식은 그대로 둔다', () => {
    expect(toSolapiPhone('01012345678')).toBe('01012345678')
  })
  it('E.164 를 국내 형식으로 바꾼다', () => {
    expect(toSolapiPhone('+821012345678')).toBe('01012345678')
  })
  it('하이픈을 제거한다', () => {
    expect(toSolapiPhone('010-1234-5678')).toBe('01012345678')
  })
  it('두 형식이 같은 결과로 모인다', () => {
    expect(toSolapiPhone('+82-10-1234-5678')).toBe(toSolapiPhone('010-1234-5678'))
  })
})

describe('buildAuthHeader', () => {
  it('형식이 고정돼 있다', () => {
    const h = buildAuthHeader('KEY', 'SECRET', '2026-09-11T00:00:00.000Z', 'saltsaltsaltsalt')
    expect(h).toMatch(
      /^HMAC-SHA256 apiKey=KEY, date=2026-09-11T00:00:00\.000Z, salt=saltsaltsaltsalt, signature=[0-9a-f]{64}$/,
    )
  })
  it('같은 입력은 같은 서명을 낸다', () => {
    const a = buildAuthHeader('K', 'S', '2026-01-01T00:00:00.000Z', 'abc')
    const b = buildAuthHeader('K', 'S', '2026-01-01T00:00:00.000Z', 'abc')
    expect(a).toBe(b)
  })
  it('시크릿이 다르면 서명이 다르다', () => {
    const a = buildAuthHeader('K', 'S1', '2026-01-01T00:00:00.000Z', 'abc')
    const b = buildAuthHeader('K', 'S2', '2026-01-01T00:00:00.000Z', 'abc')
    expect(a).not.toBe(b)
  })
  it('운영 Deno 구현과 바이트 단위로 같은 서명을 낸다', () => {
    // dolbomdari-server/shared/solapi.ts 를 같은 입력으로 실행해 얻은 값이다.
    // 이 값이 달라지면 Solapi 가 모든 발송을 거부한다 — 서명 방식이 갈라졌다는 뜻이다.
    expect(buildAuthHeader('KEY', 'SECRET', '2026-08-11T00:00:00.000Z', 'saltsaltsalt')).toBe(
      'HMAC-SHA256 apiKey=KEY, date=2026-08-11T00:00:00.000Z, salt=saltsaltsalt, signature=b3ef547872676fc737a6ec197f93945a674ae784e2e53ec24295a3f5f7daf786',
    )
  })
})
