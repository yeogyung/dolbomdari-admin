// Solapi 문자 발송 — dolbomdari-server 의 shared/solapi.ts 를 Node 로 옮긴 것
//
// 원본은 Deno 용(Deno.env, Web Crypto)이라 그대로 쓸 수 없어 포팅했다.
// 서명 방식과 엔드포인트는 원본과 같아야 한다 — 한쪽을 고치면 다른 쪽도 확인한다.
import { createHmac, randomBytes } from 'node:crypto'

/** 솔라피 수신번호 형식(01012345678)으로 맞춘다. E.164 와 하이픈을 흡수한다 */
export function toSolapiPhone(raw: string): string {
  const digits = raw.replace(/[^0-9+]/g, '')
  if (digits.startsWith('+82')) return `0${digits.slice(3)}`
  if (digits.startsWith('82') && !digits.startsWith('820')) return `0${digits.slice(2)}`
  return digits.replace(/^\+/, '')
}

export function generateSalt(): string {
  return randomBytes(16).toString('hex')
}

export function buildAuthHeader(
  apiKey: string,
  apiSecret: string,
  date: string,
  salt: string,
): string {
  const signature = createHmac('sha256', apiSecret).update(date + salt).digest('hex')
  return `HMAC-SHA256 apiKey=${apiKey}, date=${date}, salt=${salt}, signature=${signature}`
}

export type SendResult = { ok: true } | { ok: false; reason: string }

export async function sendSms({ to, text }: { to: string; text: string }): Promise<SendResult> {
  const config = useRuntimeConfig()
  const apiKey = config.solapiApiKey
  const apiSecret = config.solapiApiSecret
  const from = config.solapiSender

  // 발신번호가 없으면 시도하지 않는다. 솔라피는 미등록 발신번호를 거부하므로
  // 여기서 걸러 원인을 분명히 남긴다.
  if (!apiKey || !apiSecret || !from) {
    return { ok: false, reason: 'SOLAPI 환경변수가 설정되지 않았습니다' }
  }

  const date = new Date().toISOString()
  const salt = generateSalt()

  const res = await fetch('https://api.solapi.com/messages/v4/send-many/detail', {
    method: 'POST',
    headers: {
      Authorization: buildAuthHeader(apiKey, apiSecret, date, salt),
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      messages: [{ to: toSolapiPhone(to), from: toSolapiPhone(from), text }],
    }),
  })

  const bodyText = await res.text()
  if (!res.ok) return { ok: false, reason: `HTTP ${res.status} ${bodyText.slice(0, 300)}` }

  let parsed: unknown
  try {
    parsed = JSON.parse(bodyText)
  } catch {
    return { ok: false, reason: `JSON 아님: ${bodyText.slice(0, 200)}` }
  }

  const success = (parsed as { groupInfo?: { count?: { registeredSuccess?: number } } })?.groupInfo
    ?.count?.registeredSuccess
  if (success !== 1) return { ok: false, reason: `발송 실패: ${bodyText.slice(0, 300)}` }

  return { ok: true }
}
