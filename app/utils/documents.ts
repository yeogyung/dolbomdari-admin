// AI 문서 관리 화면의 상태 톤·적용 범위·용량 표기·수정 본문 계산 순수 유틸
import type { DocumentListItem, DocumentPatch, DocumentState } from '../types/dbo'

export function docStateTone(state: DocumentState): 'green' | 'blue' | 'gray' | 'amber' | 'red' {
  return {
    현행: 'green', // AI 가 근거로 쓰는 것은 현행뿐이다
    발효예정: 'blue',
    만료: 'gray',
    미정: 'amber', // 발효일이 없어 영영 근거로 안 쓰인다 — 손봐야 할 상태
    제외함: 'red', // 담당자가 앱에서 뺀 것. 날짜를 고쳐도 되살아나지 않는다
  }[state] as 'green' | 'blue' | 'gray' | 'amber' | 'red'
}

export function docScopeLabel(
  doc: Pick<DocumentListItem, 'dbo_document_worksites'>,
  nameOf: (worksiteId: string) => string,
): string {
  const names = doc.dbo_document_worksites.map((w) => nameOf(w.worksite_id))
  if (!names.length) return '기관 전체'
  return names.length === 1 ? names[0]! : `${names[0]} 외 ${names.length - 1}곳`
}

export function fmtBytes(n: number | null | undefined): string {
  if (n == null) return '—'
  if (n < 1024) return `${n} B`
  const kb = n / 1024
  return kb < 1024 ? `${kb.toFixed(1)} KB` : `${(kb / 1024).toFixed(1)} MB`
}

/** 상세 수정 폼 값. 날짜는 <input type="date"> 값(YYYY-MM-DD 또는 빈 문자열) */
export interface DocumentFormValues {
  body: string
  version: string
  effectiveDate: string
  expiryDate: string
}

/**
 * 원본과 달라진 항목만 PATCH 본문에 담는다.
 *
 * 본문은 다듬어 비교한다. 서버도 trim 해서 저장하므로 공백만 다른 것을 보내면 내용은 같은데
 * 재색인(임베딩 호출)만 일어난다. 종료일을 비우면 `null` 을 명시한다 — 서버는 필드가 없으면
 * 무변경, `null` 이면 종료일 삭제(무기한 현행)로 다르게 다룬다.
 */
export function buildDocumentPatch(original: DocumentFormValues, form: DocumentFormValues): DocumentPatch {
  const patch: DocumentPatch = {}
  if (form.body.trim() !== original.body.trim()) patch.body = form.body.trim()
  if (form.version.trim() !== original.version.trim()) patch.version = form.version.trim()
  if (form.effectiveDate && form.effectiveDate !== original.effectiveDate) patch.effectiveDate = form.effectiveDate
  if (form.expiryDate !== original.expiryDate) patch.expiryDate = form.expiryDate || null
  return patch
}

/**
 * 「근거에서 빼기」에 쓸 종료일 — UTC 기준 어제.
 *
 * 서버의 만료 판정이 `expiry_date < today` 이고 today 가 UTC 날짜다
 * (`new Date().toISOString().slice(0, 10)`). 서울 기준 어제를 쓰면 서울 00~09시에는 그 날짜가
 * 서버의 오늘과 같아서 현행으로 남는다.
 */
export function utcYesterday(now: Date = new Date()): string {
  return new Date(now.getTime() - 86400000).toISOString().slice(0, 10)
}
