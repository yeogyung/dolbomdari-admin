// 엑셀 내보내기용 시각 표기(excelStamp) 테스트
import { describe, expect, it } from 'vitest'
import * as XLSX from 'xlsx'
import { decodeCsv, excelStamp, fileStamp, rowsOfWorkbook, sheetOf } from '../app/utils/excel'

describe('excelStamp', () => {
  it('UTC 시각을 서울 기준 연도 포함 표기로 바꾼다', () => {
    expect(excelStamp('2026-10-10T15:05:00Z')).toBe('2026-10-11 00:05')
  })

  it('해가 넘어가는 시각도 서울 기준 연도를 쓴다', () => {
    expect(excelStamp('2025-12-31T16:30:00Z')).toBe('2026-01-01 01:30')
  })

  it('빈 값·잘못된 값은 빈 문자열', () => {
    expect(excelStamp(null)).toBe('')
    expect(excelStamp(undefined)).toBe('')
    expect(excelStamp('not-a-date')).toBe('')
  })
})

// 리뷰 지적(QA 2026-10-14 10번 일괄 등록) — 양식·CSV 글자 코드·앞 0 이 빠진 번호
describe('sheetOf', () => {
  it('행이 없어도 머리글은 남긴다(빈 양식)', () => {
    const sheet = sheetOf([], [{ key: 'name', label: '이름' }, { key: 'phone', label: '전화번호' }])
    expect(sheet.A1?.v).toBe('이름')
    expect(sheet.B1?.v).toBe('전화번호')
  })
})

describe('decodeCsv', () => {
  it('UTF-8 은 그대로, 한글 엑셀이 저장한 CP949 도 읽는다', () => {
    expect(decodeCsv(new TextEncoder().encode('이름,전화번호').buffer)).toBe('이름,전화번호')
    // 「이름」의 CP949 바이트
    expect(decodeCsv(new Uint8Array([0xc0, 0xcc, 0xb8, 0xa7]).buffer)).toBe('이름')
  })
})

describe('rowsOfWorkbook', () => {
  it('엑셀이 숫자로 바꿔 앞 0 이 빠진 휴대폰 번호를 되살린다', () => {
    const sheet = XLSX.utils.aoa_to_sheet([['이름', '전화번호'], ['홍길동', 1012345678], ['김철수', '010-1111-2222'], ['나이', 70]])
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, sheet, 'S')
    expect(rowsOfWorkbook(wb)).toEqual([['이름', '전화번호'], ['홍길동', '01012345678'], ['김철수', '010-1111-2222'], ['나이', '70']])
  })
})

describe('fileStamp', () => {
  it('서울 시각 yymmddhhmm', () => {
    expect(fileStamp(new Date('2026-10-16T01:00:00Z'))).toBe('2610161000')
  })
  it('UTC 로는 전날이어도 서울 날짜를 쓴다', () => {
    expect(fileStamp(new Date('2026-12-31T15:05:00Z'))).toBe('2701010005')
  })
})
