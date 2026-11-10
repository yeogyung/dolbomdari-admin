// AI 문서 등록용 브라우저 텍스트 추출 — md·txt(그대로)·docx(mammoth)·pdf(pdf.js)·xlsx(SheetJS). 라이브러리는 호출 시점에만 불러온다
import { decodeText, type ImportKind } from '~/utils/documentImport'
import { sheetRowsFromCells, sheetsToText, xlsxCellText, type SheetCell } from '~/utils/xlsxText'

/** 사람에게 보여 줄 수 있는 추출 실패 — 메시지를 그대로 토스트에 쓴다 */
export class ExtractError extends Error {}

async function extractPdf(data: ArrayBuffer): Promise<string> {
  // pdf.js 는 수 MB 다. 다른 화면 번들에 섞이지 않도록 여기서만 불러온다
  const pdfjs = await import('pdfjs-dist')
  const { default: workerUrl } = await import('pdfjs-dist/build/pdf.worker.min.mjs?url')
  pdfjs.GlobalWorkerOptions.workerSrc = workerUrl

  let doc
  try {
    doc = await pdfjs.getDocument({ data }).promise
  } catch (e: any) {
    if (e?.name === 'PasswordException') throw new ExtractError('암호가 걸린 PDF는 읽을 수 없습니다.')
    throw new ExtractError('PDF를 열지 못했습니다. 파일이 손상되었는지 확인해 주세요.')
  }
  try {
    const pages: string[] = []
    for (let i = 1; i <= doc.numPages; i++) {
      const content = await (await doc.getPage(i)).getTextContent()
      let text = ''
      for (const item of content.items) {
        if (!('str' in item)) continue // 표시용 마크(TextMarkedContent)는 글자가 없다
        text += item.str + (item.hasEOL ? '\n' : '')
      }
      pages.push(text)
    }
    return pages.join('\n\n')
  } finally {
    await doc.destroy()
  }
}

async function extractDocx(data: ArrayBuffer): Promise<string> {
  const mammoth = (await import('mammoth')).default
  try {
    return (await mammoth.extractRawText({ arrayBuffer: data })).value
  } catch {
    throw new ExtractError('DOCX를 읽지 못했습니다. Word에서 .docx로 다시 저장해 보세요.')
  }
}

/**
 * xlsx — 앱과 같은 글자 모양(시트 이름 머리, 칸은 탭)으로. `cellNF` 로 서식을 받아 날짜 칸을 가린다.
 * `cellDates` 는 쓰지 않는다 — 0.18.5 는 날짜를 로컬 시간대로 만들어 서울에서 시각이 밀린다(`utils/xlsxText.ts`)
 */
async function extractXlsx(data: ArrayBuffer): Promise<string> {
  const XLSX = await import('xlsx')
  let wb
  try {
    wb = XLSX.read(data, { type: 'array', cellNF: true })
  } catch (e: any) {
    if (/password/i.test(String(e?.message))) throw new ExtractError('암호가 걸린 엑셀은 읽을 수 없습니다. 암호를 푼 뒤 다시 올려 주세요.')
    console.error('[useDocumentExtract] xlsx 읽기 실패', e)
    throw new ExtractError('엑셀 파일을 읽지 못했습니다. Excel에서 .xlsx로 다시 저장해 보세요.')
  }
  const date1904 = !!wb.Workbook?.WBProps?.date1904
  const isDate = (format: string) => XLSX.SSF.is_date(format)
  const sheets = wb.SheetNames.map((name) => {
    const ws = wb.Sheets[name]!
    // 시트 크기(!ref)가 아니라 실제 칸만 돈다 — 부풀린 dimension 을 믿으면 탭이 멈춘다
    const cells = Object.keys(ws)
      .filter((key) => key[0] !== '!')
      .map((key) => ({ ...XLSX.utils.decode_cell(key), text: xlsxCellText(ws[key] as SheetCell, isDate, date1904) }))
    return { sheet: name, rows: sheetRowsFromCells(cells) }
  })
  // 시트 이름 머리만 남는 파일(빈 통합 문서·그림만 있는 시트)은 「빈 문서」 검사를 통과하므로 여기서 막는다
  if (sheets.every((s) => s.rows.length === 0)) throw new ExtractError('엑셀에서 글자를 찾지 못했습니다.')
  return sheetsToText(sheets)
}

export function useDocumentExtract() {
  /** 파일에서 원문 텍스트를 뽑는다. 정리(normalizeExtractedText)는 호출부가 한다 */
  async function extractText(file: File, kind: ImportKind): Promise<string> {
    // File.text() 는 늘 UTF-8 이라 CP949·UTF-16 파일이 깨진다 — 인코딩을 가려 푼다
    if (kind === 'md' || kind === 'txt') return decodeText(new Uint8Array(await file.arrayBuffer()))
    const data = await file.arrayBuffer()
    if (kind === 'xlsx') return await extractXlsx(data)
    return kind === 'pdf' ? await extractPdf(data) : await extractDocx(data)
  }
  return { extractText }
}
