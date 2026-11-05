import type { DeliveryStatus, NoticeRecipient, PushSummary, SmsResult } from '../types/dbo'

export function deliveryLabel(status: DeliveryStatus): string {
  return { skipped: '대상 아님', pending: '처리 중 또는 결과 미확정', accepted: '발송 접수', failed: '발송 실패' }[status]
}

/*
 * 문자의 실제 결과(QA 2026-11-02 ANOTICE-05 · 서버 2026-11-04 계약 3b묶음 3번). 「발송 접수」(sms_status)는 솔라피가 받았다는
 * 뜻일 뿐이라, 서버 크론이 보낸 지 10분 뒤부터 30분마다 솔라피에 물어 실제 결과(sms_result)를 채운다.
 */
const SMS_RESULT_LABELS: Record<SmsResult, string> = {
  rejected: '보내지 못함',
  pending: '결과 확인 중',
  delivered: '수신 완료',
  failed: '수신 실패',
  unknown: '결과 모름',
}

/** 결과 한 단어. 실패(접수 실패·수신 실패)면 사유를 괄호로 — 「수신 실패(없는 번호)」 */
export function smsResultLabel(result: SmsResult, reason: string | null | undefined): string {
  const label = SMS_RESULT_LABELS[result] ?? result
  return (result === 'failed' || result === 'rejected') && reason ? `${label}(${reason})` : label
}

/**
 * 수신자 표 「문자」 칸 — 실제 결과가 있으면 그것(`sms_result`), 없으면 접수 상태 그대로(`sms_status`).
 * 없는 것은 문자가 없는 공지·서버 업데이트 전 발송·옛 서버(칸 없음)다.
 */
export function smsCellLabel(row: Pick<NoticeRecipient, 'sms_status' | 'sms_result' | 'sms_reason'>): string {
  return row.sms_result ? smsResultLabel(row.sms_result, row.sms_reason) : deliveryLabel(row.sms_status)
}

/** 「문자」 칸을 실패로 칠할지 — 결과가 실패이거나, 결과 없이 접수부터 실패 */
export function smsCellFailed(row: Pick<NoticeRecipient, 'sms_status' | 'sms_result'>): boolean {
  if (row.sms_result) return row.sms_result === 'failed' || row.sms_result === 'rejected'
  return row.sms_status === 'failed'
}

export function noticeReadLabel(row: NoticeRecipient): string {
  if (row.read_at) return row.read_method === 'confirm' ? '확인 완료' : '열람 완료'
  if (!row.can_read) return '앱 미가입 · 확인 대상 아님'
  return '미열람'
}

/** 공지 종류 — DB 의 kind·is_special 두 칸을 화면 어휘 하나로. 목록 「구분」 칸과 종류 필터가 같이 쓴다 */
export function noticeTypeLabel(n: { kind: 'normal' | 'urgent'; is_special?: boolean }): string {
  if (n.kind === 'urgent') return '긴급'
  return n.is_special ? '특별' : '일반'
}

/*
 * 앱 알림 실제 전달(QA 2026-11-02 PUSH-01 · 서버 2026-11-04 계약 3a묶음 6번). 「발송 접수」는 Expo 가 받았다는 뜻이고,
 * 실제로 폰에 갔는지는 15분 뒤 서버 크론이 묻는 결과(receipt)로 안다 — 30분마다 채워져 보낸 뒤 15~45분이 걸린다.
 */

/** 실패 이유(Expo 오류 코드) — 쉬운 말과 원래 코드를 같이 적는다. 코드는 원인 확인(U1)에 그대로 쓴다 */
const PUSH_ERROR_LABELS: Record<string, string> = {
  DeviceNotRegistered: '받을 수 없는 기기',
  InvalidCredentials: '푸시 인증 설정 오류',
  MessageTooBig: '내용이 너무 김',
  MessageRateExceeded: '너무 자주 보냄',
  MismatchSenderId: '발신 설정 불일치',
}

export function pushErrorLabel(code: string): string {
  if (code === 'unknown_error') return '이유 모름'
  const label = PUSH_ERROR_LABELS[code]
  return label ? `${label}(${code})` : code
}

/**
 * 공지 상세의 앱 알림 한 줄 — 「앱 알림 실제 전달 n · 실패 m(이유 k)」. 실패는 접수 뒤 실패와 접수부터 거절을 합친다
 * (`errors` 의 합과 같다). 결과를 기다리는 줄·24시간 안에 못 받은 줄이 있으면 덧붙인다.
 */
export function pushDeliveryLine(s: PushSummary): string {
  // 서버는 기록을 못 남겨도 푸시는 보낸다 — 「받을 분이 없었다」고 단정하지 않는다
  if (s.tickets === 0) {
    return '앱 알림 전달 기록이 없습니다. 서버 업데이트 전에 보냈거나, 앱 알림을 받을 분이 없었거나, 기록이 저장되지 않았습니다.'
  }
  const reasons = Object.entries(s.errors)
    .sort((a, b) => b[1] - a[1])
    .map(([code, n]) => `${pushErrorLabel(code)} ${n}`)
    .join(' · ')
  let line = `앱 알림 실제 전달 ${s.delivered} · 실패 ${s.failed + s.rejected}${reasons ? `(${reasons})` : ''}`
  if (s.pending) line += ` · 결과 기다리는 중 ${s.pending}`
  if (s.unknown) line += ` · 결과 모름 ${s.unknown}`
  return line
}

/** 집계를 못 받았을 때 — 옛 서버(경로 없음 404)·권한 없음(403)은 칸을 숨기고, 그 밖은 못 불러왔다고 적는다 */
export function pushSummaryHidden(e: any): boolean {
  const status: number | undefined = e?.status ?? e?.statusCode
  return status === 404 || status === 405 || status === 403
}

/** 문자 실패 모아 보기(`GET /sms/messages`)가 없는 옛 서버에서 적는 안내 */
export const SMS_LIST_UNSUPPORTED = '문자 실패 모아 보기는 서버 업데이트 뒤에 쓸 수 있습니다.'

/** 문자 결과 목록을 못 받은 까닭이 옛 서버(경로 없음)인가 */
export function smsListUnsupported(e: any): boolean {
  const status: number | undefined = e?.status ?? e?.statusCode
  return status === 404 || status === 405
}

/** 보낸 날 조건 검사 — 서버는 형식이 틀리거나 시작일이 종료일보다 늦으면 400 이다. 통과면 null */
export function smsListRangeError(from: string, to: string): string | null {
  if (from && to && from > to) return '시작일은 종료일보다 늦을 수 없습니다.'
  return null
}
