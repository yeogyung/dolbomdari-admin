// AI 문서 등록 순수 유틸 테스트 — 지원 형식 판별, 추출 텍스트 정리, 등록 본문 검증
import { describe, it, expect } from 'vitest'
import {
  decodeText,
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
  it('md·docx·pdf·txt·xlsx 를 받고 대소문자를 가리지 않는다 — 앱(lib/docFormat.ts)과 같은 형식', () => {
    expect(kindFromFilename('활동비_지급_안내_v4.md')).toBe('md')
    expect(kindFromFilename('README.MARKDOWN')).toBe('md')
    expect(kindFromFilename('근무지침.DOCX')).toBe('docx')
    expect(kindFromFilename('안전수칙.pdf')).toBe('pdf')
    expect(kindFromFilename('메모.txt')).toBe('txt')
    expect(kindFromFilename('2026년_급여표.XLSX')).toBe('xlsx')
  })
  it('hwp·doc·xls·확장자 없음은 받지 않는다', () => {
    expect(kindFromFilename('지침.hwp')).toBeNull()
    expect(kindFromFilename('옛문서.doc')).toBeNull()
    expect(kindFromFilename('옛표.xls')).toBeNull()
    expect(kindFromFilename('noext')).toBeNull()
  })
})

describe('txt 글자 풀기', () => {
  const enc = (s: string) => new TextEncoder().encode(s)
  it('UTF-8(BOM 있어도)은 그대로', () => {
    expect(decodeText(enc('안녕하세요'))).toBe('안녕하세요')
    expect(decodeText(new Uint8Array([0xef, 0xbb, 0xbf, ...enc('안녕')]))).toBe('안녕')
  })

  it('한국어 윈도 메모장의 ANSI(CP949)는 EUC-KR 로 푼다 — 깨진 글자로 올리지 않는다', () => {
    // 「안녕」 = BE C8 B3 E7
    expect(decodeText(new Uint8Array([0xbe, 0xc8, 0xb3, 0xe7]))).toBe('안녕')
  })

  it('메모장 「유니코드」(UTF-16 LE·BE)는 BOM 을 보고 푼다', () => {
    expect(decodeText(new Uint8Array([0xff, 0xfe, 0x48, 0xc5, 0x55, 0xb1]))).toBe('안녕')
    expect(decodeText(new Uint8Array([0xfe, 0xff, 0xc5, 0x48, 0xb1, 0x55]))).toBe('안녕')
  })
})

describe('추출 텍스트 정리', () => {
  it('CRLF 를 LF 로, 줄 끝 공백을 지우고 빈 줄은 하나까지만 둔다', () => {
    expect(normalizeExtractedText('제목  \r\n\r\n\r\n\r\n본문\t\r\n')).toBe('제목\n\n본문')
  })
  it('pdf 추출에서 흔한 NBSP·제로폭 문자를 정리한다', () => {
    expect(normalizeExtractedText('활동비 지급​ 안내')).toBe('활동비 지급 안내')
  })
  it('NUL 문자를 지운다 — DB 가 거절해 이유 없는 500 이 된다', () => {
    expect(normalizeExtractedText('가\u0000나')).toBe('가나')
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
