// 엑셀 → AI 문서 본문 글자 변환 — 앱(db-operation-rn lib/docExtractor.ts 의 sheetsToText·cellToText)과 같은 규칙. 읽기(SheetJS)는 useDocumentExtract

/** SheetJS 셀 중 쓰는 칸만. `cellNF: true` 로 읽어야 `z`(서식)가 온다 */
export type SheetCell = { t: string; v?: unknown; z?: string; w?: string }
export type SheetRows = { sheet: string; rows: string[][] }

/** 엑셀 일련번호 0 = 1899-12-30. 1900 날짜 체계 기준이다 */
const EXCEL_EPOCH_MS = Date.UTC(1899, 11, 30)
/** 1904 날짜 체계(옛 맥 엑셀) 파일은 일련번호가 이만큼 작다 */
const DATE1904_OFFSET_DAYS = 1462
/** 이보다 앞선 연도는 「시각만 있는 칸」이다 — 이 문서들에 1900년 전 날짜는 없다 */
const EXCEL_EPOCH_YEAR = 1900

const pad2 = (n: number) => String(n).padStart(2, '0')
/**
 * SheetJS 0.18.5 는 한·일 로캘 내장 날짜 서식(id 27~36·50~58 — 「yyyy"년" m"월" d"일"」 등)의 **파일마다 첫 칸**에 `z` 를 비운다
 * (`safe_format` 이 서식 표를 채우기 전에 `z` 를 읽는다). 그 칸의 `w` 는 대신 넣은 서식 m/d/yy·h:mm:ss 로 찍혀 있다
 */
const IMPLICIT_DATE_TEXT = /^(\d{1,2}\/\d{1,2}\/\d{2}|\d{1,2}:\d{2}:\d{2})$/
/** 경과 시간 서식([h]:mm 등) — 근무시간 합계처럼 24시간을 넘는 값이라 날짜가 아니다. 엑셀이 보여 주는 글자(w)를 쓴다 */
const ELAPSED_FORMAT = /\[(h+|m+|s+)\]/i

/**
 * 날짜 서식 칸의 일련번호를 글자로. **시간대를 타지 않게 UTC 로 직접 계산한다**(앱이 서울에서 날짜가 하루 밀리는 것을 겪었다).
 * 초 단위로 반올림한다 — 18:30 이 18:29:59.999 로 오면 18:29 가 된다. 1900년 전이면 시각만, 시·분이 0 이면 날짜만 적는다.
 */
export function excelSerialText(serial: number): string {
  const d = new Date(EXCEL_EPOCH_MS + Math.round(serial * 86400) * 1000)
  const time = `${pad2(d.getUTCHours())}:${pad2(d.getUTCMinutes())}`
  if (d.getUTCFullYear() < EXCEL_EPOCH_YEAR) return time
  const date = `${d.getUTCFullYear()}-${pad2(d.getUTCMonth() + 1)}-${pad2(d.getUTCDate())}`
  return d.getUTCHours() !== 0 || d.getUTCMinutes() !== 0 ? `${date} ${time}` : date
}

/**
 * 칸 하나를 글자로. 날짜를 일련번호로 내보내지 않는다. 칸 안의 줄바꿈·탭은 공백으로 접는다 — 칸은 탭, 행은 줄바꿈으로
 * 가르므로 그대로 두면 값이 엉뚱한 행에 붙는다. `isDateFormat` 은 SheetJS `SSF.is_date` 를 넘긴다(테스트가 라이브러리를 안 부르게)
 */
export function xlsxCellText(
  cell: SheetCell | undefined,
  isDateFormat: (format: string) => boolean,
  date1904 = false,
): string {
  if (!cell || cell.v === undefined || cell.v === null) return ''
  if (cell.t === 'b') return cell.v ? 'TRUE' : 'FALSE'
  if (cell.t === 'e') return cell.w ?? ''
  if (cell.t === 'n' && typeof cell.v === 'number') {
    if (cell.z && ELAPSED_FORMAT.test(cell.z) && cell.w) return cell.w
    const isDate = cell.z ? isDateFormat(cell.z) : IMPLICIT_DATE_TEXT.test(cell.w ?? '')
    // 시각만 있는 칸(1 미만)은 날짜 체계와 관계없이 시각이다 — 1904 오프셋을 더하면 「1904-01-01 18:00」이 된다
    if (isDate) return excelSerialText(cell.v + (date1904 && cell.v >= 1 ? DATE1904_OFFSET_DAYS : 0))
  }
  return String(cell.v).replace(/[\r\n\t]+/g, ' ')
}

/**
 * 실제 칸으로 행을 만든다. 시트 크기(`!ref`, 파일의 dimension)는 믿지 않는다 — 부풀린 파일이면 수억 칸을 돌며 탭이 멈춘다.
 * 글자가 있는 행만 남기고, 열은 시트에서 글자가 있는 칸의 범위로 맞춰 칸 위치를 지킨다
 */
export function sheetRowsFromCells(cells: { r: number; c: number; text: string }[]): string[][] {
  const filled = cells.filter((x) => x.text !== '')
  if (!filled.length) return []
  // Math.min(...배열)은 약 13만 칸에서 스택이 넘친다(5,000행 × 26열이면 닿는다) — 한 번 돌며 센다
  let minC = Infinity
  let maxC = -Infinity
  for (const x of filled) {
    if (x.c < minC) minC = x.c
    if (x.c > maxC) maxC = x.c
  }
  const byRow = new Map<number, string[]>()
  for (const x of filled) {
    const row = byRow.get(x.r) ?? Array<string>(maxC - minC + 1).fill('')
    row[x.c - minC] = x.text
    byRow.set(x.r, row)
  }
  return [...byRow.entries()].sort((a, b) => a[0] - b[0]).map(([, row]) => row)
}

/** 시트마다 이름 머리를 붙인다 — 「2026년 1월 급여」 같은 시트 이름 자체가 근거다 */
export function sheetsToText(sheets: SheetRows[]): string {
  return sheets
    .map(({ sheet, rows }) => `[시트: ${sheet}]\n${rows.map((row) => row.join('\t')).join('\n')}`)
    .join('\n\n')
}
