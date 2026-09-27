// FAQ 승인 관리 화면의 라벨·톤·필터·적용 범위·조회 오류 메시지 순수 유틸
import type { Faq, FaqStatus } from '../types/dbo'

export const FAQ_STATUSES: { value: FaqStatus; label: string }[] = [
  { value: 'pending', label: '승인 대기' },
  { value: 'approved', label: '승인' },
  { value: 'rejected', label: '반려' },
]

export function faqStatusLabel(status: FaqStatus): string {
  return FAQ_STATUSES.find((s) => s.value === status)?.label ?? status
}

export function faqStatusTone(status: FaqStatus): 'amber' | 'green' | 'red' {
  return { pending: 'amber', approved: 'green', rejected: 'red' }[status] as 'amber' | 'green' | 'red'
}

/** 서버가 준 sort 순서를 유지한 채 상태·검색어(질문·답변)로 거른다 */
export function filterFaqs(items: Faq[], opts: { q?: string; status?: FaqStatus | '' }): Faq[] {
  const q = opts.q?.trim().toLowerCase() ?? ''
  return items.filter((f) => {
    if (opts.status && f.status !== opts.status) return false
    if (q && !f.question.toLowerCase().includes(q) && !f.answer.toLowerCase().includes(q)) return false
    return true
  })
}

/**
 * 적용 근무지 이름 목록. 빈 배열이면 기관 전체다.
 *
 * 근무지 이름은 embed 로 읽는데, RLS 로 못 읽은 근무지는 null 로 온다. 그 행을 버리면
 * 「특정 근무지 전용」 FAQ 가 기관 전체로 보여서 마스터가 범위를 오해한 채 승인한다 —
 * 그래서 id 로라도 남긴다.
 */
export function faqScopeNames(faq: Pick<Faq, 'dbo_faq_worksites'>): string[] {
  return faq.dbo_faq_worksites.map((s) => s.dbo_worksites?.name ?? s.worksite_id)
}

export function faqScopeLabel(faq: Pick<Faq, 'dbo_faq_worksites'>): string {
  const names = faqScopeNames(faq)
  if (!names.length) return '기관 전체'
  return names.length === 1 ? names[0]! : `${names[0]} 외 ${names.length - 1}곳`
}

/** PostgREST 오류({ code, message })를 사람이 읽는 한국어로 바꾼다 */
export function faqReadErrorMessage(e: { code?: string; message?: string } | null | undefined): string {
  if (e?.code === '42501') return '권한이 없습니다. 운영관리자(master) 계정으로 로그인해 주세요.'
  // status·category 등은 20260925 마이그레이션이 더한 컬럼이다
  if (e?.code === '42703') return 'FAQ 컬럼이 없습니다. 서버 마이그레이션 적용 여부를 확인해 주세요.'
  return `FAQ를 불러오지 못했습니다.${e?.code ? ` (${e.code})` : ''}`
}
