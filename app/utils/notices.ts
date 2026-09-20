import type { DeliveryStatus, NoticeRecipient } from '../types/dbo'

export function deliveryLabel(status: DeliveryStatus): string {
  return { skipped: '대상 아님', pending: '처리 중 또는 결과 미확정', accepted: '발송 접수', failed: '발송 실패' }[status]
}

export function noticeReadLabel(row: NoticeRecipient): string {
  if (row.read_at) return row.read_method === 'confirm' ? '확인 완료' : '열람 완료'
  if (!row.can_read) return '앱 미가입 · 확인 대상 아님'
  return '미열람'
}
