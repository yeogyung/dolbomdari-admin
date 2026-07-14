// 목록 데이터를 SheetJS로 .xlsx 파일로 변환해 브라우저 다운로드
import * as XLSX from 'xlsx'

export interface ExcelColumn {
  key: string
  label: string
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
