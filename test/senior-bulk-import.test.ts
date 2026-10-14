// 참여자 일괄 등록 테스트 — 번호 정규화·표 해석·파일 안 중복·순차 등록(QA 2026-10-14 10번)
import { describe, expect, it } from 'vitest'
import {
  BULK_MAX,
  normalizePhone,
  parseImportRows,
  runImport,
  splitPasted,
  type ImportRow,
} from '../app/utils/seniorBulkImport'

describe('normalizePhone — 서버 normalizeAdminPhone 과 같은 결과', () => {
  it('통과', () => {
    expect(normalizePhone('010-1234-5678')).toBe('01012345678')
    expect(normalizePhone('01012345678')).toBe('01012345678')
    expect(normalizePhone('+82 10-1234-5678')).toBe('01012345678')
    expect(normalizePhone('0111234567')).toBe('0111234567')
  })

  it('거절 — 어드민이 서버 규칙을 넓히지 않는다(엑셀이 앞 0 을 뗀 번호도 고치지 않는다)', () => {
    expect(normalizePhone('1012345678')).toBeNull()
    expect(normalizePhone('010-123')).toBeNull()
    expect(normalizePhone('02-123-4567')).toBeNull()
    expect(normalizePhone('')).toBeNull()
  })
})

describe('splitPasted', () => {
  it('탭·쉼표·두 칸 이상 공백으로 나누고 빈 줄은 버린다', () => {
    expect(splitPasted('홍길동\t010-1111-2222\n\n김철수, 01033334444, 메모\n이영희   010 5555 6666')).toEqual([
      ['홍길동', '010-1111-2222'],
      ['김철수', '01033334444', '메모'],
      ['이영희', '010 5555 6666'],
    ])
  })
})

describe('parseImportRows', () => {
  it('머리글을 찾아 칸 순서가 달라도 읽는다', () => {
    const rows = parseImportRows([
      ['연락처', '성명', '비고'],
      ['010-1111-2222', '홍길동', '오전반'],
    ])
    expect(rows).toMatchObject([{ line: 2, name: '홍길동', phone: '01011112222', memo: '오전반', status: 'ok' }])
  })

  it('머리글이 없으면 이름·전화번호·메모 순서로 본다', () => {
    expect(parseImportRows([['홍길동', '01011112222']])).toMatchObject([
      { line: 1, name: '홍길동', phone: '01011112222', memo: '', status: 'ok' },
    ])
  })

  it('이름이 없거나 번호가 틀리면 사유를 단다', () => {
    const rows = parseImportRows([
      ['', '01011112222'],
      ['홍길동', '1011112222'],
    ])
    expect(rows.map((r) => [r.status, r.reason])).toEqual([
      ['invalid', '이름이 없습니다'],
      ['invalid', '전화번호 형식이 틀렸습니다'],
    ])
  })

  it('파일 안에서 같은 번호는 서식이 달라도 두 번째부터 중복', () => {
    const rows = parseImportRows([
      ['홍길동', '010-1111-2222'],
      ['홍길동', '01011112222'],
    ])
    expect(rows.map((r) => r.status)).toEqual(['ok', 'duplicate'])
    expect(rows[1]!.reason).toBe('1행과 같은 번호입니다')
  })

  it(`${BULK_MAX}명을 넘으면 넘는 줄은 받지 않는다`, () => {
    const many = Array.from({ length: BULK_MAX + 2 }, (_, i) => ['이름', `0101111${String(i).padStart(4, '0')}`])
    const rows = parseImportRows(many)
    expect(rows.filter((r) => r.status === 'ok')).toHaveLength(BULK_MAX)
    expect(rows.at(-1)).toMatchObject({ status: 'invalid', reason: `한 번에 ${BULK_MAX}명까지 등록합니다` })
  })
})

describe('runImport', () => {
  const ok = (line: number, phone: string): ImportRow => ({ line, name: '이름', phone, memo: '', status: 'ok' })

  it('한 명씩 보내고 이미 등록된 번호·실패를 행마다 남기며 이어 간다', async () => {
    const rows = [ok(1, '01011110001'), ok(2, '01011110002'), ok(3, '01011110003'), { ...ok(4, 'x'), status: 'invalid' as const }]
    const sent: string[] = []
    await runImport(rows, async (r) => {
      sent.push(r.phone)
      if (r.line === 2) throw { status: 409, data: { error: 'phone_taken' } }
      if (r.line === 3) throw { status: 500 }
    }, () => false)
    expect(sent).toEqual(['01011110001', '01011110002', '01011110003'])
    expect(rows.map((r) => r.status)).toEqual(['done', 'taken', 'failed', 'invalid'])
  })

  it('중단하면 남은 행은 건너뜀', async () => {
    const rows = [ok(1, '01011110001'), ok(2, '01011110002')]
    let stop = false
    await runImport(rows, async () => {
      stop = true
    }, () => stop)
    expect(rows.map((r) => r.status)).toEqual(['done', 'skipped'])
  })
})
