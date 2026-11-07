// AI 문서 등록 순수 유틸 테스트 — 지원 형식 판별, 추출 텍스트 정리, 등록 본문 검증
import { describe, it, expect } from 'vitest'
import {
  kindFromFilename,
  normalizeExtractedText,
  buildCreatePayload,
  fileTooLarge,
  isTooLargeError,
  MAX_IMPORT_BYTES,
  type DocumentCreateForm,
} from '../app/utils/documentImport'

describe('파일 크기 상한 20MB (FAQ-03)', () => {
  it('정확히 20MB 는 받고 1바이트라도 넘으면 막는다', () => {
    expect(MAX_IMPORT_BYTES).toBe(20 * 1024 * 1024)
    expect(fileTooLarge(MAX_IMPORT_BYTES)).toBe(false)
    expect(fileTooLarge(MAX_IMPORT_BYTES + 1)).toBe(true)
    expect(fileTooLarge(0)).toBe(false)
  })
  it('서버의 too_large 는 상태 코드와 관계없이 알아본다', () => {
    expect(isTooLargeError({ status: 400, data: { error: 'too_large' } })).toBe(true)
    expect(isTooLargeError({ status: 413, data: { error: 'too_large' } })).toBe(true)
    expect(isTooLargeError({ status: 400, data: { error: 'bad_request' } })).toBe(false)
    expect(isTooLargeError(new Error('network'))).toBe(false)
  })
})

describe('지원 형식 판별', () => {
  it('md·docx·pdf 만 받고 대소문자를 가리지 않는다', () => {
    expect(kindFromFilename('활동비_지급_안내_v4.md')).toBe('md')
    expect(kindFromFilename('README.MARKDOWN')).toBe('md')
    expect(kindFromFilename('근무지침.DOCX')).toBe('docx')
    expect(kindFromFilename('안전수칙.pdf')).toBe('pdf')
  })
  it('hwp·txt·doc·확장자 없음은 받지 않는다', () => {
    expect(kindFromFilename('지침.hwp')).toBeNull()
    expect(kindFromFilename('메모.txt')).toBeNull()
    expect(kindFromFilename('옛문서.doc')).toBeNull()
    expect(kindFromFilename('noext')).toBeNull()
  })
})

describe('추출 텍스트 정리', () => {
  it('CRLF 를 LF 로, 줄 끝 공백을 지우고 빈 줄은 하나까지만 둔다', () => {
    expect(normalizeExtractedText('제목  \r\n\r\n\r\n\r\n본문\t\r\n')).toBe('제목\n\n본문')
  })
  it('pdf 추출에서 흔한 NBSP·제로폭 문자를 정리한다', () => {
    expect(normalizeExtractedText('활동비 지급​ 안내')).toBe('활동비 지급 안내')
  })
  it('공백뿐이면 빈 문자열이다 — 스캔본 PDF 판별에 쓴다', () => {
    expect(normalizeExtractedText(' \n\t\n ')).toBe('')
  })
})

describe('등록 본문 검증', () => {
  const form: DocumentCreateForm = {
    filename: '활동비_지급_안내_v4.md',
    kind: 'md',
    version: '',
    body: '활동비는 매월 10일 지급한다.',
    effectiveDate: '2026-10-01',
    expiryDate: '',
    byteSize: null,
  }

  it('선택 항목은 비어 있으면 보내지 않는다', () => {
    expect(buildCreatePayload(form)).toEqual({
      ok: true,
      value: { filename: '활동비_지급_안내_v4.md', kind: 'md', body: '활동비는 매월 10일 지급한다.', effectiveDate: '2026-10-01' },
    })
  })
  it('버전·종료일이 있으면 다듬어 담는다', () => {
    const r = buildCreatePayload({ ...form, version: ' v4 ', expiryDate: '2026-12-31' })
    expect(r.ok && r.value).toMatchObject({ version: 'v4', expiryDate: '2026-12-31' })
  })
  // QA DOC-03 — 목록 「크기」 칸이 쓴다. 옛 서버는 모르는 칸을 버리므로 함께 보내도 등록된다
  it('원본 파일 크기를 byteSize 로 싣는다', () => {
    const r = buildCreatePayload({ ...form, byteSize: 4404019 })
    expect(r.ok && r.value.byteSize).toBe(4404019)
  })
  it('파일명·본문·발효일이 비면 이유를 낸다', () => {
    expect(buildCreatePayload({ ...form, filename: '  ' })).toEqual({ ok: false, reason: '파일명을 입력해 주세요.' })
    expect(buildCreatePayload({ ...form, body: '\n' })).toEqual({ ok: false, reason: '본문이 비었습니다.' })
    expect(buildCreatePayload({ ...form, effectiveDate: '' })).toEqual({ ok: false, reason: '발효일을 입력해 주세요.' })
  })
  it('종료일이 발효일보다 앞서면 막는다 — 서버도 400 으로 거절한다', () => {
    expect(buildCreatePayload({ ...form, expiryDate: '2026-09-30' })).toEqual({
      ok: false,
      reason: '종료일은 발효일보다 앞설 수 없습니다.',
    })
  })
})
