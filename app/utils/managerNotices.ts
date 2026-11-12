// 담당자 PC 공지(QA 2026-11-07 MGR-01) — 앱 공지 API 의 열람 집계·미열람자·다시 알리기 모양과 화면 문구

export type NoticeReadStats = { tracked: boolean; total: number; readable: number; read: number }

export type NoticeUnreadPerson = {
  directoryId: string
  name: string
  phone: string | null
  avatarPath: string | null
  /** none 앱 계정 없음 · noPush 앱 알림을 못 받음 · push 앱 알림. 문자는 긴급 공지에만 간다 */
  channel: 'none' | 'noPush' | 'push'
  /** channel 의 noPush 를 로그아웃(loggedOut)과 알림 꺼짐으로 가른 값(QA 2026-11-11 394행). 옛 서버는 칸이 없다 */
  channelDetail?: 'none' | 'loggedOut' | 'noPush' | 'push'
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

/** 공지 종류. 문자는 긴급에만 함께 간다(서버 `sendsSms`) — 일반·특별 공지는 앱 알림뿐이다 */
export type NoticeKind = 'normal' | 'urgent'

/** 앱 알림을 못 받는 분 — 안 읽은 분 중 계정이 없거나 알림 받을 기기가 없는 분 */
const offApp = (unread: NoticeUnreadPerson[]) => unread.filter((p) => p.channel !== 'push').length

/**
 * 「12명 중 8명 읽음」. 발송 이력이 없는 옛 공지는 셀 수 없다 — 0명이 아니다.
 *
 * 앱 알림을 못 받는 분(계정 없음·로그아웃·알림 꺼짐)은 분모에서 빼고 따로 센다. 보낼 때 확인 창의
 * 「앱으로 못 받는 분 N명」과 같은 셈이다 — 예전에는 로그아웃한 분을 「앱으로 받는」에 넣어 둘이 갈렸다
 * (QA 2026-11-11 394행). 문자는 긴급에만 가므로 「문자로만」은 긴급에서만 쓴다.
 */
export function readSummary(s: NoticeReadStats | null, unread: NoticeUnreadPerson[], kind: NoticeKind): string {
  if (!s) return ''
  if (!s.tracked) return '발송 기록이 없는 옛 공지라 열람을 셀 수 없습니다.'
  const off = offApp(unread)
  const tail = off === 0 ? '' : kind === 'urgent' ? ` · 문자로만 받는 분 ${off}명` : ` · 앱으로 못 받는 분 ${off}명`
  return `앱으로 받는 ${s.total - off}명 중 ${s.read}명 읽음${tail}`
}

const CHANNEL_LABEL: Record<NonNullable<NoticeUnreadPerson['channelDetail']>, string> = {
  none: '앱 없음',
  loggedOut: '로그아웃(기기 없음)',
  noPush: '앱 알림 꺼짐',
  push: '앱 알림',
}

/**
 * 받는 방법. 앱 알림을 못 받는 분은 긴급이면 「· 문자」, 일반·특별이면 「· 못 받음」이다 — 문자가 안 나간
 * 공지에 「문자」를 적으면 거짓이다(QA 2026-11-11 394행). 로그아웃은 휴무 명단처럼 따로 적는다.
 */
export function channelLabel(p: Pick<NoticeUnreadPerson, 'channel' | 'channelDetail'>, kind: NoticeKind): string {
  const base = CHANNEL_LABEL[p.channelDetail ?? p.channel]
  if (p.channel === 'push') return base
  return `${base} · ${kind === 'urgent' ? '문자' : '못 받음'}`
}

/** 30분 안에 다시 보낸 분 — 그때까지 기다린다 */
export function coolingDown(p: NoticeUnreadPerson, now: number = Date.now()): boolean {
  return !!p.cooldownUntil && Date.parse(p.cooldownUntil) > now
}

/**
 * 지금 다시 알릴 수 있는가 — 이 공지가 닿고 30분 제한도 지났다. 일반·특별 공지는 앱 알림을 받는 분에게만
 * 닿는다(서버도 그런 분은 건너뛴다). 고르게 두면 「다시 알렸다」고 믿게 된다.
 */
export function canResend(p: NoticeUnreadPerson, kind: NoticeKind, now: number = Date.now()): boolean {
  return (kind === 'urgent' || p.channel === 'push') && !coolingDown(p, now)
}

/** 다시 알리기 확인 문구. 긴급은 모두에게 문자가 함께 간다 */
export function resendConfirm(count: number, kind: NoticeKind): string {
  return `${count}명에게 다시 알릴까요? ${kind === 'urgent' ? '앱 알림과 문자가 함께 갑니다.' : '앱 알림으로 갑니다.'}`
}

/** 다시 알리기 결과 한 줄 */
export function resendSummary(r: NoticeResendResult): string {
  const parts = [`${r.sent}명에게 다시 알렸습니다.`]
  if (r.skipped) parts.push(`${r.skipped}명은 이미 읽었거나 30분 안에 보낸 분이라 건너뛰었습니다.`)
  if (r.notSent) parts.push(`${r.notSent}명은 기록을 남기지 못해 보내지 않았습니다.`)
  if (r.sms.failed || r.push.failed) parts.push(`접수 실패 — 문자 ${r.sms.failed} · 앱 알림 ${r.push.failed}`)
  return parts.join(' ')
}
