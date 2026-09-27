// AI 문서 등록의 지원 형식 판별·추출 텍스트 정리·등록 본문 검증 순수 유틸 (추출 자체는 useDocumentExtract)

/** 등록할 수 있는 원본 형식. HWP 는 받지 않는다 */
export type ImportKind = 'md' | 'docx' | 'pdf'

export const IMPORT_ACCEPT = '.md,.markdown,.docx,.pdf'

export function kindFromFilename(name: string): ImportKind | null {
  const ext = name.toLowerCase().match(/\.([a-z0-9]+)$/)?.[1]
  if (ext === 'md' || ext === 'markdown') return 'md'
  if (ext === 'docx') return 'docx'
  if (ext === 'pdf') return 'pdf'
  return null
}

/**
 * 추출한 텍스트를 색인하기 좋게 다듬는다.
 *
 * pdf 는 줄마다 끝 공백과 NBSP·제로폭 문자가 섞여 나오고, docx 는 문단 사이 빈 줄이 겹친다.
 * 그대로 두면 청크가 공백으로 낭비되고, 담당자가 검수할 때도 읽기 어렵다.
 */
export function normalizeExtractedText(text: string): string {
  return text
    .replace(/\r\n?/g, '\n')
    .replace(/ /g, ' ')
    .replace(/[​-‍﻿]/g, '')
    .replace(/[ \t]+$/gm, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

export interface DocumentCreateForm {
  filename: string
  kind: ImportKind
  version: string
  body: string
  effectiveDate: string
  expiryDate: string
}

export interface DocumentCreateBody {
  filename: string
  kind: ImportKind
  body: string
  effectiveDate: string
  version?: string
  expiryDate?: string
}

/** 서버 parseDocumentPayload 와 같은 조건을 먼저 본다 — 400 대신 무엇이 틀렸는지 알린다 */
export function buildCreatePayload(
  form: DocumentCreateForm,
): { ok: true; value: DocumentCreateBody } | { ok: false; reason: string } {
  const filename = form.filename.trim()
  if (!filename) return { ok: false, reason: '파일명을 입력해 주세요.' }
  const body = form.body.trim()
  if (!body) return { ok: false, reason: '본문이 비었습니다.' }
  if (!form.effectiveDate) return { ok: false, reason: '발효일을 입력해 주세요.' }
  if (form.expiryDate && form.expiryDate < form.effectiveDate) {
    return { ok: false, reason: '종료일은 발효일보다 앞설 수 없습니다.' }
  }

  const value: DocumentCreateBody = { filename, kind: form.kind, body, effectiveDate: form.effectiveDate }
  const version = form.version.trim()
  if (version) value.version = version
  if (form.expiryDate) value.expiryDate = form.expiryDate
  return { ok: true, value }
}
