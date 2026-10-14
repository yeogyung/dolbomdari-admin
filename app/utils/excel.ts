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
  const data = rows.map((row) => {
    const record: Record<string, any> = {}
    for (const col of columns) {
      record[col.label] = formatCell(row[col.key])
    }
    return record
  })

  const worksheet = XLSX.utils.json_to_sheet(data)
  const workbook = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Sheet1')
  XLSX.writeFile(workbook, `${filename}.xlsx`)
}

/**
 * 올린 xlsx·csv 의 첫 시트를 줄마다 칸(문자열)으로 읽는다(참여자 일괄 등록).
 * `raw: false` 로 화면에 보이는 글자 그대로 읽는다 — 숫자로 읽으면 전화번호 앞 0 이 사라진다.
 */
export async function readSheetRows(file: File): Promise<string[][]> {
  // csv 는 글자로 읽어 넘긴다. 바이트로 넘기면 BOM 없는 UTF-8 한글이 깨진다
  const wb = /\.csv$/i.test(file.name)
    ? XLSX.read(await file.text(), { type: 'string' })
    : XLSX.read(await file.arrayBuffer(), { type: 'array' })
  const sheet = wb.Sheets[wb.SheetNames[0]!]
  if (!sheet) return []
  return XLSX.utils.sheet_to_json<string[]>(sheet, { header: 1, raw: false, defval: '' })
}
