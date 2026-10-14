import type { DeliveryStatus, NoticeRecipient } from '../types/dbo'

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
