// 담당자 PC 공지(QA 2026-11-07 MGR-01) — 앱 공지 API 의 열람 집계·미열람자·다시 알리기 모양과 화면 문구

export type NoticeReadStats = { tracked: boolean; total: number; readable: number; read: number }

export type NoticeUnreadPerson = {
  directoryId: string
  name: string
  phone: string | null
  avatarPath: string | null
  /** none 앱 계정 없음(문자만) · noPush 앱 알림 꺼짐(문자) · push 앱 알림 */
  channel: 'none' | 'noPush' | 'push'
  lastResentAt: string | null
  cooldownUntil: string | null
}

export type NoticeReader = {
  directoryId: string
  name: string
  avatarPath: string | null
  readAt: string | null
  method: 'auto' | 'confirm'
}

export type NoticeResendResult = {
  sent: number
  skipped: number
  sms: { accepted: number; failed: number }
  push: { accepted: number; failed: number }
  notSent: number
  historyFailed: number
}

/** 「12명 중 8명 읽음」. 발송 이력이 없는 옛 공지는 셀 수 없다 — 0명이 아니다 */
export function readSummary(s: NoticeReadStats | null): string {
  if (!s) return ''
  if (!s.tracked) return '발송 기록이 없는 옛 공지라 열람을 셀 수 없습니다.'
  const sms = s.total - s.readable
  return `앱으로 받는 ${s.readable}명 중 ${s.read}명 읽음` + (sms > 0 ? ` · 문자로만 받는 분 ${sms}명` : '')
}

export function channelLabel(channel: NoticeUnreadPerson['channel']): string {
  return { none: '앱 없음(문자)', noPush: '앱 알림 꺼짐(문자)', push: '앱 알림' }[channel]
}

/** 지금 다시 알릴 수 있는가 — 30분 안에 다시 보낸 분은 그때까지 기다린다 */
export function canResend(p: NoticeUnreadPerson, now: number = Date.now()): boolean {
  return !p.cooldownUntil || Date.parse(p.cooldownUntil) <= now
}

/** 다시 알리기 결과 한 줄 */
export function resendSummary(r: NoticeResendResult): string {
  const parts = [`${r.sent}명에게 다시 알렸습니다.`]
  if (r.skipped) parts.push(`${r.skipped}명은 이미 읽었거나 30분 안에 보낸 분이라 건너뛰었습니다.`)
  if (r.notSent) parts.push(`${r.notSent}명은 기록을 남기지 못해 보내지 않았습니다.`)
  if (r.sms.failed || r.push.failed) parts.push(`접수 실패 — 문자 ${r.sms.failed} · 앱 알림 ${r.push.failed}`)
  return parts.join(' ')
}
