// AI 문서 등록의 지원 형식 판별·추출 텍스트 정리·등록 본문 검증 순수 유틸 (추출 자체는 useDocumentExtract)

/** 등록할 수 있는 원본 형식. HWP 는 받지 않는다 */
export type ImportKind = 'md' | 'docx' | 'pdf'

export const IMPORT_ACCEPT = '.md,.markdown,.docx,.pdf'

/**
 * 원본 파일 상한 20MB(QA 2026-11-07 FAQ-03). 앱(`lib/docFormat.ts` 의 `MAX_DOC_BYTES`)과 서버(`MAX_BYTE_SIZE`)와 같은 값이다.
 * 서버는 넘으면 `too_large` 를 낸다
 */
export const MAX_IMPORT_BYTES = 20 * 1024 * 1024
export const TOO_LARGE_MESSAGE = '20MB 보다 큰 파일은 올릴 수 없어요.'

/** 상한을 넘는가 — 정확히 20MB 는 받는다(서버도 `size > MAX` 만 막는다) */
export function fileTooLarge(size: number): boolean {
  return size > MAX_IMPORT_BYTES
}

/** 서버가 크기로 거절했는가(`too_large`). 상태 코드(400·413)와 관계없이 코드로 본다 */
export function isTooLargeError(e: any): boolean {
  return e?.data?.error === 'too_large'
}

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
  /** 고른 원본 파일의 크기(바이트, `file.size`). 목록의 「크기」 칸이 쓴다(QA 2026-11-02 DOC-03) */
  byteSize: number | null
}

export interface DocumentCreateBody {
  filename: string
  kind: ImportKind
  body: string
  effectiveDate: string
  version?: string
  expiryDate?: string
  /** 옛 서버(2026-11-04 전)는 모르는 칸이라 받고 버린다(zod 기본 strip, 핸들러가 아는 칸만 읽음) — 등록은 된다 */
  byteSize?: number
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
  // 크기를 모르면 보내지 않는다 — 서버는 없으면 null 로 둔다(0 은 「0바이트」라는 거짓이 된다)
  if (form.byteSize != null) value.byteSize = form.byteSize
  return { ok: true, value }
}
