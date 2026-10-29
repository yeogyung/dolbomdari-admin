// 기관 사업자등록증 허용 형식·확장자 판정 테스트
import { describe, expect, it } from 'vitest'
import { ORG_DOCUMENT_ACCEPT, orgDocumentExt } from '../shared/orgDocument'

describe('orgDocumentExt', () => {
  it('버킷이 받는 이미지 형식은 저장 확장자로', () => {
    expect(orgDocumentExt('image/jpeg')).toBe('jpg')
    expect(orgDocumentExt('image/png')).toBe('png')
    expect(orgDocumentExt('image/webp')).toBe('webp')
  })

  it('PDF·빈 값·객체 기본 속성 이름은 거절', () => {
    expect(orgDocumentExt('application/pdf')).toBeNull()
    expect(orgDocumentExt('')).toBeNull()
    expect(orgDocumentExt('constructor')).toBeNull()
  })

  it('파일 선택창 accept 는 같은 형식 목록', () => {
    expect(ORG_DOCUMENT_ACCEPT).toBe('image/jpeg,image/png,image/webp')
  })
})
