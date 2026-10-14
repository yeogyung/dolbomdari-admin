// 목록 데이터를 SheetJS로 .xlsx 파일로 변환해 브라우저 다운로드
import * as XLSX from 'xlsx'

export interface ExcelColumn {
  key: string
  label: string
}

/** ISO 타임스탬프 → 'YYYY-MM-DD HH:MM' (Asia/Seoul). 화면용 fmtStamp 와 달리 연도를 남긴다 */
export function excelStamp(iso: string | null | undefined): string {
  if (!iso) return ''
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Seoul',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(d)
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? ''
  return `${get('year')}-${get('month')}-${get('day')} ${get('hour')}:${get('minute')}`
}

function formatCell(value: unknown): string | number | boolean | null {
  if (value === null || value === undefined) return ''
  if (Array.isArray(value)) return value.join(', ')
  if (typeof value === 'object') return JSON.stringify(value)
  return value as string | number | boolean
}

export function downloadExcel(
  filename: string,
  rows: Record<string, any>[],
  columns: ExcelColumn[],
) {
  const workbook = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(workbook, sheetOf(rows, columns), 'Sheet1')
  XLSX.writeFile(workbook, `${filename}.xlsx`)
}

/** 머리글을 명시한다 — 없으면 행이 0개일 때 머리글까지 사라져 빈 양식이 나간다 */
export function sheetOf(rows: Record<string, any>[], columns: ExcelColumn[]): XLSX.WorkSheet {
  const data = rows.map((row) => {
    const record: Record<string, any> = {}
    for (const col of columns) {
      record[col.label] = formatCell(row[col.key])
    }
    return record
  })
  return XLSX.utils.json_to_sheet(data, { header: columns.map((c) => c.label) })
}

/**
 * 올린 xlsx·csv 의 첫 시트를 줄마다 칸(문자열)으로 읽는다(참여자 일괄 등록).
 * csv 는 글자 코드를 가려 글자로 넘긴다(`decodeCsv`).
 */
export async function readSheetRows(file: File): Promise<string[][]> {
  const buf = await file.arrayBuffer()
  const wb = /\.csv$/i.test(file.name)
    ? XLSX.read(decodeCsv(buf), { type: 'string' })
    : XLSX.read(buf, { type: 'array' })
  return rowsOfWorkbook(wb)
}

/** UTF-8 로 먼저 풀고, 깨지면 CP949 로 푼다. 한글 엑셀의 「CSV (쉼표로 분리)」는 CP949 로 저장한다 */
export function decodeCsv(buf: ArrayBuffer): string {
  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(buf)
  } catch {
    return new TextDecoder('euc-kr').decode(buf)
  }
}

/**
 * 첫 시트 → 줄마다 칸. `raw: false` 로 화면에 보이는 글자 그대로 읽는다.
 * 엑셀은 서식 없는 칸에 친 01012345678 을 숫자 1012345678 로 바꿔 앞 0 을 버린다. 숫자 칸이
 * 휴대폰 번호에서 0 만 빠진 모양(1로 시작하는 9~10자리)이면 0 을 되붙인다. 번호 규칙 자체는
 * 넓히지 않는다 — 글자로 「1012345678」을 친 칸은 그대로 두어 오류로 보인다.
 */
export function rowsOfWorkbook(wb: XLSX.WorkBook): string[][] {
  const sheet = wb.Sheets[wb.SheetNames[0]!]
  if (!sheet) return []
  for (const [addr, cell] of Object.entries(sheet)) {
    if (addr.startsWith('!') || cell?.t !== 'n') continue
    const digits = String(cell.v)
    if (/^1[0-9]{8,9}$/.test(digits)) cell.w = `0${digits}`
  }
  return XLSX.utils.sheet_to_json<string[]>(sheet, { header: 1, raw: false, defval: '' })
}
