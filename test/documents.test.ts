// AI 문서 관리 순수 유틸 테스트 — 상태 톤, 적용 범위, 용량, 수정 본문(변경분만), UTC 어제
import { describe, it, expect } from 'vitest'
import {
  docStateTone,
  docScopeLabel,
  docEditorName,
  fmtBytes,
  buildDocumentPatch,
  utcYesterday,
  dayBefore,
  previousVersionEnd,
  previousEndNote,
  versionEffectiveError,
  documentVersionError,
  supersededLabel,
  versionUploadSupported,
  VERSION_UNSUPPORTED,
  type DocumentFormValues,
} from '../app/utils/documents'

describe('문서 상태 톤', () => {
  it('AI 근거로 쓰이는 현행만 초록이다', () => {
    expect(docStateTone('현행')).toBe('green')
    expect(docStateTone('발효예정')).toBe('blue')
    expect(docStateTone('만료')).toBe('gray')
    expect(docStateTone('미정')).toBe('amber')
    expect(docStateTone('제외함')).toBe('red')
  })
})

describe('문서 적용 범위', () => {
  const names: Record<string, string> = { w1: '햇살요양원', w2: '늘봄어린이집' }
  const nameOf = (id: string) => names[id] ?? id

  it('범위 행이 없으면 기관 전체다', () => {
    expect(docScopeLabel({ dbo_document_worksites: [] }, nameOf)).toBe('기관 전체')
  })
  it('한 곳이면 이름, 여러 곳이면 「외 N곳」, 이름을 모르면 id', () => {
    expect(docScopeLabel({ dbo_document_worksites: [{ worksite_id: 'w1' }] }, nameOf)).toBe('햇살요양원')
    expect(
      docScopeLabel({ dbo_document_worksites: [{ worksite_id: 'w3' }, { worksite_id: 'w2' }] }, nameOf),
    ).toBe('w3 외 1곳')
  })
})

describe('파일 크기 표기', () => {
  it('B·KB·MB 로 바꾸고 모르면 대시', () => {
    expect(fmtBytes(null)).toBe('—')
    expect(fmtBytes(512)).toBe('512 B')
    expect(fmtBytes(2048)).toBe('2.0 KB')
    expect(fmtBytes(3 * 1024 * 1024)).toBe('3.0 MB')
  })
})

describe('마지막으로 고친 사람(QA DOC-03)', () => {
  it('고친 사람이 있으면 그 이름이다', () => {
    expect(docEditorName({ created_by_name: '김미영', updated_by_name: '홍길동' })).toBe('홍길동')
  })
  it('고친 적이 없으면 올린 사람이다', () => {
    expect(docEditorName({ created_by_name: '김미영', updated_by_name: null })).toBe('김미영')
  })
  // 옛 서버는 칸이 없고, 시드·예전 어드민 등록은 이름이 비어 있다 — 화면은 비운다
  it('칸이 없거나 이름을 모르면 null', () => {
    expect(docEditorName({})).toBeNull()
    expect(docEditorName({ created_by_name: null, updated_by_name: null })).toBeNull()
  })
})

describe('문서 수정 본문', () => {
  const original: DocumentFormValues = {
    body: '활동비는 매월 10일 지급한다.',
    version: 'v4',
    effectiveDate: '2026-08-01',
    expiryDate: '',
  }

  it('바뀐 것이 없으면 빈 객체다 — 저장 버튼을 끈다', () => {
    expect(buildDocumentPatch(original, { ...original })).toEqual({})
  })
  it('앞뒤 공백만 바뀐 본문은 변경이 아니다 — 쓸데없는 재색인을 막는다', () => {
    expect(buildDocumentPatch(original, { ...original, body: `  ${original.body}\n` })).toEqual({})
  })
  it('바뀐 항목만 담는다', () => {
    expect(buildDocumentPatch(original, { ...original, version: 'v5', effectiveDate: '2026-10-01' })).toEqual({
      version: 'v5',
      effectiveDate: '2026-10-01',
    })
  })
  it('종료일을 비우면 null 을 명시한다 — 안 보내면 서버가 무변경으로 본다', () => {
    const withExpiry = { ...original, expiryDate: '2026-12-31' }
    expect(buildDocumentPatch(withExpiry, { ...withExpiry, expiryDate: '' })).toEqual({ expiryDate: null })
  })
  it('본문을 바꾸면 다듬은 값을 보낸다', () => {
    expect(buildDocumentPatch(original, { ...original, body: ' 새 본문 ' })).toEqual({ body: '새 본문' })
  })
})

describe('근거에서 빼기용 종료일', () => {
  it('서버 판정과 같은 UTC 기준 어제다', () => {
    expect(utcYesterday(new Date('2026-09-28T12:00:00Z'))).toBe('2026-09-27')
  })
  it('서울 새벽(UTC 전날)에도 서버의 오늘보다 하루 앞선다', () => {
    // 서울 09-28 01:00 = UTC 09-27 16:00 → 서버 today 는 09-27. 서울 어제(09-27)로는 만료가 안 된다
    expect(utcYesterday(new Date('2026-09-27T16:00:00Z'))).toBe('2026-09-26')
  })
})

// QA 2026-11-02 DOC-02 — 새 판을 올리면 이전 판이 새 판 발효 전날로 끝난다(서버 decideNewVersion)
describe('문서 판 — 이전 판 종료일', () => {
  it('전날은 달·해를 넘긴다', () => {
    expect(dayBefore('2026-11-10')).toBe('2026-11-09')
    expect(dayBefore('2026-03-01')).toBe('2026-02-28')
    expect(dayBefore('2027-01-01')).toBe('2026-12-31')
  })
  it('무기한이거나 더 늦게 끝나는 이전 판은 새 판 발효 전날로 끝난다', () => {
    expect(previousVersionEnd(null, '2026-11-10')).toBe('2026-11-09')
    expect(previousVersionEnd('2026-12-31', '2026-11-10')).toBe('2026-11-09')
  })
  it('이미 그보다 먼저 끝난 이전 판은 늦추지 않는다', () => {
    expect(previousVersionEnd('2026-10-31', '2026-11-10')).toBe('2026-10-31')
    expect(previousVersionEnd('2026-11-09', '2026-11-10')).toBe('2026-11-09')
  })
  it('확인 창 문구', () => {
    expect(previousEndNote({ version: 'v4', expiry_date: null }, '2026-11-10')).toBe('이전 판(v4)은 11월 9일에 끝납니다.')
    expect(previousEndNote({ version: null, expiry_date: '2026-12-31' }, '2026-11-10')).toBe('이전 판은 11월 9일에 끝납니다.')
    expect(previousEndNote({ version: 'v4', expiry_date: '2026-10-31' }, '2026-11-10')).toBe(
      '이전 판(v4)은 이미 10월 31일에 끝나 종료일을 바꾸지 않습니다.',
    )
  })
})

describe('문서 판 — 새 판 발효일', () => {
  it('이전 판 발효일과 같거나 앞서면 막는다', () => {
    expect(versionEffectiveError('2026-04-01', '2026-04-01')).toBe('새 판 발효일은 이전 판(4월 1일)보다 늦어야 합니다.')
    expect(versionEffectiveError('2026-04-01', '2026-03-31')).not.toBeNull()
    expect(versionEffectiveError('2026-04-01', '2026-04-02')).toBeNull()
  })
  it('이전 판에 발효일이 없으면 막지 않는다(서버도 보지 않는다)', () => {
    expect(versionEffectiveError(null, '2026-04-01')).toBeNull()
  })
})

describe('문서 판 — 새 판 올리기 실패', () => {
  const prev = { id: 'p1', effective_date: '2026-04-01' }
  const err = (status: number, data?: Record<string, unknown>) => ({ status, data })

  it('최신 판이 아니면 그 판으로 가는 길을 준다', () => {
    expect(documentVersionError(err(409, { error: 'not_latest_version', latestId: 'v5' }), prev)).toEqual({
      message: '이 판 뒤에 올린 판이 있습니다. 최신 판에서 새 판을 올려 주세요.',
      link: { to: '/senior/documents/v5', label: '최신 판 열기' },
    })
  })
  it('되돌리기마저 실패해 새 판이 남았으면 그 문서로 가는 길을 준다', () => {
    const r = documentVersionError(err(500, { error: 'version_incomplete', documentId: 'n1' }), prev)
    expect(r.message).toContain('새 판 일부가 남았습니다')
    expect(r.link).toEqual({ to: '/senior/documents/n1', label: '남은 새 판 열기' })
  })
  it('되돌린 500 은 새 판이 남지 않았다고 적는다', () => {
    expect(documentVersionError(err(500, { error: 'internal' }), prev).message).toContain('새 판은 남지 않았으니')
  })
  it('계약 표의 나머지 코드', () => {
    expect(documentVersionError(err(400, { error: 'effective_not_after_previous' }), prev).message).toBe(
      '새 판 발효일은 이전 판(4월 1일)보다 늦어야 합니다.',
    )
    expect(documentVersionError(err(409, { error: 'duplicate_filename' }), prev).message).toContain('파일명을 바꿔')
    expect(documentVersionError(err(409, { error: 'previous_changed' }), prev)).toEqual({
      message: '그사이 이전 판이 바뀌었습니다. 이전 판을 다시 열고 올려 주세요.',
      link: { to: '/senior/documents/p1', label: '이전 판 다시 열기' },
    })
    expect(documentVersionError(err(400, { error: 'bad_request' }), prev).message).toContain('입력값을 확인')
    expect(documentVersionError(err(403, { error: 'forbidden' }), prev).message).toContain('권한이 없습니다')
  })
  // 옛 서버(지금 운영)는 경로가 없어 404 다
  it('404 는 서버 업데이트 안내다', () => {
    expect(documentVersionError(err(404, { error: 'not_found' }), prev)).toEqual({ message: VERSION_UNSUPPORTED, link: null })
  })
  it('응답을 못 받았으면 올라갔을 수 있다고 적는다', () => {
    expect(documentVersionError(new Error('fetch failed'), prev).message).toContain('올라갔을 수 있으니')
    expect(documentVersionError(err(502), prev).message).toContain('올라갔을 수 있으니')
  })
})

describe('문서 판 — 대체됨·옛 서버', () => {
  it('superseded_by 가 있으면 「새 판(v5)으로 대체됨」', () => {
    expect(supersededLabel({ superseded_by: { id: 'x', filename: 'a.md', version: 'v5' } })).toBe('새 판(v5)으로 대체됨')
    expect(supersededLabel({ superseded_by: { id: 'x', filename: 'a.md', version: null } })).toBe('새 판으로 대체됨')
  })
  it('없거나 옛 서버면 붙이지 않는다', () => {
    expect(supersededLabel({ superseded_by: null })).toBeNull()
    expect(supersededLabel({})).toBeNull()
  })
  it('lineage_id 칸이 있어야(null 이어도) 새 판 올리기를 쓸 수 있다', () => {
    expect(versionUploadSupported({ lineage_id: null })).toBe(true)
    expect(versionUploadSupported({ lineage_id: 'l1' })).toBe(true)
    expect(versionUploadSupported({})).toBe(false)
  })
})
