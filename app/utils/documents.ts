// AI 문서 관리 화면의 상태 톤·적용 범위·용량 표기·수정 본문 계산 순수 유틸
import type { DocumentListItem, DocumentPatch, DocumentState } from '../types/dbo'
import { throughLabel } from './reports'

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

/**
 * 마지막으로 고친 사람의 이름(QA 2026-11-02 DOC-03). 고친 적이 없으면 올린 사람이다 — 그때 수정 시각은 등록 시각이다.
 * 이름을 모르면(옛 서버·예전 문서) null 이고 화면은 비운다.
 */
export function docEditorName(doc: Pick<DocumentListItem, 'created_by_name' | 'updated_by_name'>): string | null {
  return doc.updated_by_name ?? doc.created_by_name ?? null
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

/*
 * 문서 판(QA 2026-11-02 DOC-02 · 서버 2026-11-04 계약 3b묶음 1번). 판은 계보(첫 판의 id)로 잇고, 「새 판 올리기」가 이전 판의
 * 종료일을 새 판 발효 전날로 적는다. 날짜는 서버와 같은 서울 날짜 문자열이다.
 */

/** 새 판 올리기를 쓸 수 있는 서버인가 — 새 서버는 목록·상세에 `lineage_id` 칸(null 포함)을 늘 싣는다. 옛 서버는 칸이 없다 */
export function versionUploadSupported(doc: Pick<DocumentListItem, 'lineage_id'>): boolean {
  return doc.lineage_id !== undefined
}

/** 새 판 올리기가 옛 서버(경로 없음)에서 막혔을 때의 안내 */
export const VERSION_UNSUPPORTED = '새 판 올리기는 서버 업데이트 뒤에 쓸 수 있습니다.'

/** 'YYYY-MM-DD' 의 전날. 서버 `dayBefore` 와 같다 — 날짜만 다뤄 UTC 로 센다(시간대와 무관) */
export function dayBefore(date: string): string {
  return new Date(Date.parse(`${date}T00:00:00Z`) - 86400000).toISOString().slice(0, 10)
}

/**
 * 새 판을 올리면 이전 판이 끝나는 날 — 새 판 발효 전날. 이전 판이 이미 그보다 먼저 끝났으면 그 날 그대로다
 * (서버 `decideNewVersion` 과 같다. 늦추면 끝난 판이 되살아난다)
 */
export function previousVersionEnd(previousExpiry: string | null, effectiveDate: string): string {
  const end = dayBefore(effectiveDate)
  return previousExpiry && previousExpiry <= end ? previousExpiry : end
}

const prevName = (version: string | null) => `이전 판${version ? `(${version})` : ''}`

/** 새 판 올리기 확인 창 문구 — 「이전 판(v4)은 11월 9일에 끝납니다.」 */
export function previousEndNote(
  prev: { version: string | null; expiry_date: string | null },
  effectiveDate: string,
): string {
  const end = previousVersionEnd(prev.expiry_date, effectiveDate)
  if (end !== dayBefore(effectiveDate)) {
    return `${prevName(prev.version)}은 이미 ${throughLabel(end)}에 끝나 종료일을 바꾸지 않습니다.`
  }
  return `${prevName(prev.version)}은 ${throughLabel(end)}에 끝납니다.`
}

const notAfterPrevious = (prevEffective: string | null) =>
  prevEffective
    ? `새 판 발효일은 이전 판(${throughLabel(prevEffective)})보다 늦어야 합니다.`
    : '새 판 발효일은 이전 판보다 늦어야 합니다.'

/** 새 판 발효일이 이전 판보다 늦은가. 아니면 문구 — 서버 400 `effective_not_after_previous` 와 같은 조건(같은 날도 막는다) */
export function versionEffectiveError(prevEffective: string | null, effectiveDate: string): string | null {
  return prevEffective && effectiveDate <= prevEffective ? notAfterPrevious(prevEffective) : null
}

/**
 * 새 판 올리기(`POST /documents/{id}/versions`) 실패 문구와, 가야 할 문서가 있으면 그 길.
 *
 * 404 는 옛 서버(경로 없음)로 읽는다 — 이전 판은 방금 상세로 읽어 온 문서이고 어드민은 문서를 지우지 않는다.
 * 처리기의 500 은 늘 `internal`(새 판을 지워 되돌림) 또는 `version_incomplete`(되돌리기도 실패해 새 판이 남음)다.
 */
export function documentVersionError(
  e: any,
  prev: { id: string; effective_date: string | null },
): { message: string; link: { to: string; label: string } | null } {
  const status: number | undefined = e?.status ?? e?.statusCode
  const code: string | undefined = typeof e?.data?.error === 'string' ? e.data.error : undefined
  const plain = (message: string) => ({ message, link: null })
  if (code === 'effective_not_after_previous') return plain(notAfterPrevious(prev.effective_date))
  if (code === 'not_latest_version') {
    const latestId = typeof e.data.latestId === 'string' ? e.data.latestId : null
    return {
      message: '이 판 뒤에 올린 판이 있습니다. 최신 판에서 새 판을 올려 주세요.',
      link: latestId ? { to: `/senior/documents/${latestId}`, label: '최신 판 열기' } : null,
    }
  }
  if (code === 'duplicate_filename') return plain('같은 파일명의 문서가 이미 있습니다. 파일명을 바꿔 주세요.')
  if (code === 'previous_changed') {
    return {
      message: '그사이 이전 판이 바뀌었습니다. 이전 판을 다시 열고 올려 주세요.',
      link: { to: `/senior/documents/${prev.id}`, label: '이전 판 다시 열기' },
    }
  }
  if (code === 'version_incomplete') {
    const documentId = typeof e.data.documentId === 'string' ? e.data.documentId : null
    return {
      message: '새 판 일부가 남았습니다. 남은 문서를 열어 확인한 뒤 정리해 주세요.',
      link: documentId ? { to: `/senior/documents/${documentId}`, label: '남은 새 판 열기' } : null,
    }
  }
  if (status === 404 || status === 405) return plain(VERSION_UNSUPPORTED)
  if (status === 400) return plain('입력값을 확인해 주세요. 종료일은 발효일보다 앞설 수 없습니다.')
  if (status === 401) return plain('로그인이 만료되었습니다. 다시 로그인해 주세요.')
  if (status === 403) return plain('새 판을 올릴 권한이 없습니다. 운영관리자(master) 계정으로 로그인해 주세요.')
  if (code === 'internal') return plain('새 판을 저장하지 못했습니다. 새 판은 남지 않았으니 잠시 뒤 다시 올려 주세요.')
  return plain('응답을 확인하지 못했습니다. 새 판이 올라갔을 수 있으니 목록에서 확인해 주세요.')
}

/** 목록·상세 상태 옆 「새 판(v5)으로 대체됨」. 날짜로는 현행인데 AI 가 새 판을 쓰는 문서만 — 아니면(옛 서버 포함) null */
export function supersededLabel(doc: Pick<DocumentListItem, 'superseded_by'>): string | null {
  const s = doc.superseded_by
  if (!s) return null
  return `새 판${s.version ? `(${s.version})` : ''}으로 대체됨`
}
