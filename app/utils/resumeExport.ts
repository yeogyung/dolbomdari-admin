// 이력서 A4 장 요소를 그림으로 떠서 PNG(여러 장은 세로로 이어 붙인 한 장) 또는 PDF 로 내려받는다
//
// ⚠ dolbomdari-link/app/utils/resumeExport.ts 에 같은 파일이 복제돼 있다. 하나를 고치면 둘 다 고친다.
// 라이브러리는 누를 때 불러온다 — 서류를 보기만 하는 사람에게 번들을 싣지 않는다
//
// import() 앞의 `if (!import.meta.client) throw` 는 지우지 말 것. 서버 빌드에서 import.meta.client 가 false 로 박혀
// 그 뒤 import() 가 죽은 코드로 빠진다. 남으면 Nitro 가 pdf-lib 를 서버 함수에 싣고, pdf-lib 의 tslib 1.x 때문에
// tslib 가 두 벌이 되어 윈도우 빌드에서 절대 경로 링크로 묶인다 → Netlify 에서 Supabase 가 tslib 를 못 찾아 API 전부 500 (2026-10-28).
// 같은 함수 안에 둬야 한다 — 함수로 빼면 Rollup 이 항상 던진다는 걸 몰라 import() 가 남는다
import { PAGE_H, PAGE_W } from './resumePages'

/** 화면 1px 을 그림 2px 로 — 인쇄해도 글자가 뭉개지지 않는 정도 */
const PIXEL_RATIO = 2
/** 이어 붙인 PNG 의 장 사이 틈과 색 */
const PNG_GAP = 24
const PNG_GAP_COLOR = '#e9ecf1'
/** 브라우저 캔버스 상한 — iOS 사파리 면적 약 1,677만 px, 한 변 16,384px. 넘으면 배율을 낮춘다 */
const MAX_CANVAS_AREA = 16_000_000
const MAX_CANVAS_SIDE = 16_384
/** A4 를 PDF 포인트(1/72in)로 */
const A4_PT: [number, number] = [595.28, 841.89]
/** 한 장을 뜨는 시간 상한 — html-to-image 는 그림 해독이 실패하면 끝나지 않고 멈춘다(createImage 의 decode 에 catch 가 없다) */
const CAPTURE_TIMEOUT_MS = 20_000
/** 내려받기 주소를 풀기까지 — 바로 풀면 iOS 사파리가 다운로드 확인 중에 파일을 잃는다 (FileSaver.js 는 40초) */
const REVOKE_DELAY_MS = 60_000

async function capture(sheet: HTMLElement, pixelRatio: number): Promise<HTMLCanvasElement> {
  if (!import.meta.client) throw new Error('브라우저에서만 저장할 수 있습니다.')
  const { toCanvas } = await import('html-to-image')
  let timer: ReturnType<typeof setTimeout> | undefined
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error('서류를 그림으로 만드는 데 시간이 너무 오래 걸립니다.')), CAPTURE_TIMEOUT_MS)
  })
  try {
    // 서류는 시스템 글꼴만 쓴다 — 웹 글꼴을 심으면 페이지의 모든 글꼴 조각을 받느라 느리다
    const drawing = toCanvas(sheet, { width: PAGE_W, height: PAGE_H, pixelRatio, backgroundColor: '#fff', skipFonts: true })
    return await Promise.race([drawing, timeout])
  } catch (e) {
    // html-to-image 는 Error 가 아니라 이미지 onerror 의 Event 로 거부하기도 한다
    throw e instanceof Error ? e : new Error('서류를 그림으로 만들지 못했습니다.')
  } finally {
    clearTimeout(timer)
  }
}

function canvasBlob(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error('이미지를 만들지 못했습니다.'))), 'image/png')
  })
}

function download(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), REVOKE_DELAY_MS)
}

export async function downloadResumePng(sheets: HTMLElement[], filename: string) {
  const height = sheets.length * PAGE_H + (sheets.length - 1) * PNG_GAP
  const ratio = Math.min(
    PIXEL_RATIO,
    Math.sqrt(MAX_CANVAS_AREA / (PAGE_W * height)),
    MAX_CANVAS_SIDE / height,
  )
  const out = document.createElement('canvas')
  out.width = Math.round(PAGE_W * ratio)
  out.height = Math.round(height * ratio)
  const ctx = out.getContext('2d')
  if (!ctx) throw new Error('이미지를 만들지 못했습니다.')
  ctx.fillStyle = PNG_GAP_COLOR
  ctx.fillRect(0, 0, out.width, out.height)
  for (const [i, sheet] of sheets.entries()) {
    const page = await capture(sheet, ratio)
    ctx.drawImage(page, 0, Math.round(i * (PAGE_H + PNG_GAP) * ratio), out.width, Math.round(PAGE_H * ratio))
  }
  download(await canvasBlob(out), filename)
}

/** 장마다 그림 한 장을 A4 PDF 한 쪽에 꽉 채운다 — 글자는 선택·검색되지 않는다 */
export async function downloadResumePdf(sheets: HTMLElement[], filename: string) {
  if (!import.meta.client) throw new Error('브라우저에서만 저장할 수 있습니다.')
  const { PDFDocument } = await import('pdf-lib')
  const doc = await PDFDocument.create()
  for (const sheet of sheets) {
    const png = await doc.embedPng(await (await canvasBlob(await capture(sheet, PIXEL_RATIO))).arrayBuffer())
    const page = doc.addPage(A4_PT)
    page.drawImage(png, { x: 0, y: 0, width: A4_PT[0], height: A4_PT[1] })
  }
  const bytes = await doc.save()
  download(new Blob([bytes as Uint8Array<ArrayBuffer>], { type: 'application/pdf' }), filename)
}
