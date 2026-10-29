// 기관 사업자등록증 파일 규칙 — 버킷 org-documents 의 제한(10MB·JPG/PNG/WEBP)과 같게 둔다. 서버(업로드 주소 발급)와 화면이 같이 쓴다
const EXT_BY_TYPE: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
}

export const ORG_DOCUMENT_MAX_BYTES = 10 * 1024 * 1024
/** 파일 선택창의 accept 값 */
export const ORG_DOCUMENT_ACCEPT = Object.keys(EXT_BY_TYPE).join(',')

/** 허용 형식이면 저장 확장자, 아니면 null */
export function orgDocumentExt(contentType: string): string | null {
  return Object.hasOwn(EXT_BY_TYPE, contentType) ? EXT_BY_TYPE[contentType]! : null
}
