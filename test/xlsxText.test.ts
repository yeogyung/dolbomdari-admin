// 엑셀 → 글자 변환 — 앱(lib/docExtractor.ts 의 sheetsToText·cellToText)과 같은 결과를 고정한다
import { describe, expect, it } from 'vitest'
import { excelSerialText, sheetRowsFromCells, sheetsToText, xlsxCellText } from '../app/utils/xlsxText'

const isDate = (z: string) => /[ymdhs]/i.test(z) && z !== 'General'

describe('excelSerialText', () => {
  it('날짜만 있으면 날짜, 시각이 있으면 날짜와 시각 — 시간대에 밀리지 않는다', () => {
    expect(excelSerialText(46053)).toBe('2026-01-31')
    expect(excelSerialText(46053.7708333333)).toBe('2026-01-31 18:30')
  })

  it('시각만 있는 칸(1900년 전)은 시각만 — 기준일 1899-12-30 을 적지 않는다', () => {
    expect(excelSerialText(0.7708333333)).toBe('18:30')
    expect(excelSerialText(0)).toBe('00:00')
  })

  it('밀리초가 버려져 18:29:59.999 로 와도 초 단위로 반올림해 18:30', () => {
    expect(excelSerialText(18.5 / 24 - 0.0000000116)).toBe('18:30')
  })

  it('초만 다르면 시각을 붙이지 않는다(00:00:45 를 「00:00」으로 적지 않는다)', () => {
    expect(excelSerialText(46053 + 45 / 86400)).toBe('2026-01-31')
  })
})

describe('xlsxCellText', () => {
  it('날짜 서식 숫자는 날짜로, 그 밖의 숫자는 그대로', () => {
    expect(xlsxCellText({ t: 'n', v: 46053, z: 'yyyy-mm-dd' }, isDate)).toBe('2026-01-31')
    expect(xlsxCellText({ t: 'n', v: 12000, z: 'General' }, isDate)).toBe('12000')
    expect(xlsxCellText({ t: 'n', v: 12000 }, isDate)).toBe('12000')
  })

  it('1904 날짜 체계 파일은 1462일을 더한다, 시각만 있는 칸은 더하지 않는다', () => {
    expect(xlsxCellText({ t: 'n', v: 46053 - 1462, z: 'yyyy-mm-dd' }, isDate, true)).toBe('2026-01-31')
    expect(xlsxCellText({ t: 'n', v: 0.75, z: 'hh:mm' }, isDate, true)).toBe('18:00')
  })

  // SheetJS 0.18.5 는 한·일 로캘 내장 날짜 서식(id 27~36·50~58)의 파일마다 첫 칸에 z 를 비운다. w 는 m/d/yy·h:mm:ss 로 찍힌다
  it('서식이 빈 첫 칸도 m/d/yy·h:mm:ss 로 찍혔으면 날짜·시각으로 본다', () => {
    expect(xlsxCellText({ t: 'n', v: 46053, w: '1/31/26' }, isDate)).toBe('2026-01-31')
    expect(xlsxCellText({ t: 'n', v: 0.75, w: '18:00:00' }, isDate)).toBe('18:00')
    expect(xlsxCellText({ t: 'n', v: 12000, w: '12000' }, isDate)).toBe('12000')
  })

  it('참거짓은 TRUE·FALSE, 빈 칸은 빈 글자, 오류 칸은 보이는 글자', () => {
    expect(xlsxCellText({ t: 'b', v: true }, isDate)).toBe('TRUE')
    expect(xlsxCellText({ t: 'b', v: false }, isDate)).toBe('FALSE')
    expect(xlsxCellText(undefined, isDate)).toBe('')
    expect(xlsxCellText({ t: 'z' }, isDate)).toBe('')
    expect(xlsxCellText({ t: 'e', v: 7, w: '#DIV/0!' }, isDate)).toBe('#DIV/0!')
  })

  it('칸 안의 줄바꿈·탭은 공백으로 접는다 — 행이 깨지지 않게', () => {
    expect(xlsxCellText({ t: 's', v: '주의사항:\n야간근무\t22시' }, isDate)).toBe('주의사항: 야간근무 22시')
  })
})

describe('경과 시간 서식', () => {
  // 근무시간 합계 같은 [h]:mm 은 날짜가 아니다 — 160:30 이 「1900-01-05 16:30」이 되면 안 된다
  it('[h]·[m]·[s] 서식은 엑셀이 보여 주는 글자 그대로', () => {
    expect(xlsxCellText({ t: 'n', v: 6.6875, z: '[h]:mm', w: '160:30' }, () => true)).toBe('160:30')
    expect(xlsxCellText({ t: 'n', v: 1.5, z: '[hh]:mm:ss', w: '36:00:00' }, () => true)).toBe('36:00:00')
  })
})

describe('sheetRowsFromCells', () => {
  it('글자가 있는 행만, 열은 시트에서 실제로 쓴 범위로 맞춘다 — 부풀린 시트 크기를 믿지 않는다', () => {
    expect(
      sheetRowsFromCells([
        { r: 0, c: 1, text: '이름' },
        { r: 0, c: 2, text: '시급' },
        { r: 5, c: 1, text: '김철수' },
        { r: 5, c: 2, text: '12000' },
        { r: 7, c: 3, text: '' },
      ]),
    ).toEqual([
      ['이름', '시급'],
      ['김철수', '12000'],
    ])
  })

  it('칸이 없으면 빈 목록', () => {
    expect(sheetRowsFromCells([])).toEqual([])
  })

  // Math.min(...배열)은 약 13만 칸에서 스택이 넘친다 — 5,000행 × 26열 엑셀이 「파일을 읽는 중 오류」가 됐다
  it('칸이 많아도(20만 칸) 스택이 넘치지 않는다', () => {
    const cells = Array.from({ length: 200_000 }, (_, i) => ({ r: Math.floor(i / 25), c: i % 25, text: 'x' }))
    const rows = sheetRowsFromCells(cells)
    expect(rows).toHaveLength(8000)
    expect(rows[0]).toHaveLength(25)
  })
})

describe('sheetsToText', () => {
  it('시트마다 이름 머리를 붙이고, 칸은 탭·행은 줄바꿈, 시트 사이는 빈 줄', () => {
    expect(
      sheetsToText([
        { sheet: '2026년 1월 급여', rows: [['이름', '시급'], ['김철수', '12000']] },
        { sheet: '비고', rows: [['없음']] },
      ]),
    ).toBe('[시트: 2026년 1월 급여]\n이름\t시급\n김철수\t12000\n\n[시트: 비고]\n없음')
  })
})
