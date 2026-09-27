// AI 문서 등록용 브라우저 텍스트 추출 — md(그대로)·docx(mammoth)·pdf(pdf.js). 라이브러리는 호출 시점에만 불러온다
import type { ImportKind } from '~/utils/documentImport'

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

export function useDocumentExtract() {
  /** 파일에서 원문 텍스트를 뽑는다. 정리(normalizeExtractedText)는 호출부가 한다 */
  async function extractText(file: File, kind: ImportKind): Promise<string> {
    if (kind === 'md') return await file.text()
    const data = await file.arrayBuffer()
    return kind === 'pdf' ? await extractPdf(data) : await extractDocx(data)
  }
  return { extractText }
}
