// AI 문서 관리 순수 유틸 테스트 — 상태 톤, 적용 범위, 용량, 수정 본문(변경분만), UTC 어제
import { describe, it, expect } from 'vitest'
import {
  docStateTone,
  docScopeLabel,
  fmtBytes,
  buildDocumentPatch,
  utcYesterday,
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
