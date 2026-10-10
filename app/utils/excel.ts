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
