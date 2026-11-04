import type { DeliveryStatus, NoticeRecipient, PushSummary } from '../types/dbo'

export function deliveryLabel(status: DeliveryStatus): string {
  return { skipped: '대상 아님', pending: '처리 중 또는 결과 미확정', accepted: '발송 접수', failed: '발송 실패' }[status]
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
  if (s.tickets === 0) {
    return '앱 알림 전달 기록이 없습니다. 기록을 남기기 전(서버 업데이트 전)에 보냈거나 앱 알림을 받을 분이 없었습니다.'
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
