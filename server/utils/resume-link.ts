// 이력서 공유 링크의 토큰·비밀번호 생성 — 둘 다 암호학적 난수를 쓴다
import { randomBytes, randomInt } from 'node:crypto'

/** base64url 16바이트 = 22자. 128비트면 추측 방어에 충분하고 문자 길이를 아낀다 */
export function generateToken(): string {
  return randomBytes(16).toString('base64url')
}

/**
 * 6자리 숫자. 문자로 받아 손으로 입력하는 값이라 짧게 둔다.
 * 토큰이 1차 방어이고 이 값은 URL 유출에 대비한 2차 방어다 (설계 D2).
 * 무차별 대입은 실패 10회 잠금으로 막는다.
 */
export function generatePassword(): string {
  return String(randomInt(0, 1_000_000)).padStart(6, '0')
}
