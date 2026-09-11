// 이력서 공유 링크 토큰·비밀번호 생성 테스트
import { describe, expect, it } from 'vitest'
import { generatePassword, generateToken } from '../server/utils/resume-link'

describe('generateToken', () => {
  it('22자 base64url 이다', () => {
    const t = generateToken()
    expect(t).toHaveLength(22)
    expect(t).toMatch(/^[A-Za-z0-9_-]{22}$/)
  })
  it('매번 다르다', () => {
    const set = new Set(Array.from({ length: 200 }, () => generateToken()))
    expect(set.size).toBe(200)
  })
})

describe('generatePassword', () => {
  it('6자리 숫자다', () => {
    for (let i = 0; i < 200; i++) {
      expect(generatePassword()).toMatch(/^[0-9]{6}$/)
    }
  })
  it('값이 한 가지로 쏠리지 않는다', () => {
    const set = new Set(Array.from({ length: 200 }, () => generatePassword()))
    expect(set.size).toBeGreaterThan(150)
  })
})
