// 기관 가입 검토 상태의 라벨·톤과 결과 안내 문자 문구 — 서버(문자 발송)와 화면이 같이 쓴다
export type OrgApprovalStatus = 'pending' | 'approved' | 'rejected'

export const ORG_APPROVAL_STATUSES: { value: OrgApprovalStatus; label: string }[] = [
  { value: 'pending', label: '승인대기' },
  { value: 'approved', label: '승인됨' },
  { value: 'rejected', label: '반려' },
]

export function orgApprovalLabel(status: string): string {
  return ORG_APPROVAL_STATUSES.find((s) => s.value === status)?.label ?? status
}

export function orgApprovalTone(status: string): 'amber' | 'green' | 'red' | 'gray' {
  return ({ pending: 'amber', approved: 'green', rejected: 'red' } as const)[status as OrgApprovalStatus] ?? 'gray'
}

/** 검토 결과를 담당자에게 알리는 문자. 반려 사유는 앱 내정보에도 그대로 보인다 */
export function orgReviewSmsText(orgName: string, decision: 'approved' | 'rejected', reason?: string): string {
  if (decision === 'approved') {
    return `[돌봄다리] ${orgName} 기관 승인이 완료되었어요. 앱에서 공고 등록과 종사자 찾기를 이용해 주세요.`
  }
  return `[돌봄다리] ${orgName} 기관 승인이 반려되었어요.\n사유: ${reason ?? ''}\n앱 내정보에서 서류를 다시 제출해 주세요.`
}
