// 이력서 서류 양식 PDF 렌더러 — pdf-lib 로 A4 한 장에 표를 그린다
//
// ⚠ 이 양식은 세 곳에 복제돼 있다. 하나를 고치면 셋을 모두 고쳐야 한다.
//   · dolbomdari-admin/app/components/ResumeDocument.vue
//   · dolbomdari-link/app/components/ResumeDocument.vue
//   · dolbomdari-admin/server/utils/resume-pdf.ts          (이 파일)
// 근거 양식: dolbomdari-link/docs/이력서_양식.hwp
import fontkit from '@pdf-lib/fontkit'
import { PDFDocument, rgb, type PDFFont, type PDFPage } from 'pdf-lib'
import {
  addressText,
  birthText,
  RESUME_FORM,
  sectionRows,
  type Resume,
} from '../../shared/resume-form'

// A4 세로 (pt)
const PAGE_W = 595.28
const PAGE_H = 841.89
const MARGIN = 40
const BODY_W = PAGE_W - MARGIN * 2 // 515.28

// 열 너비 — hwp 원본을 픽셀 단위로 측정한 비율 (x=35..683, 경계 35/95/170/240/440/522/683)
const COL_SIDE = BODY_W * 0.0926 // 좌측 섹션 라벨
const COL_1 = BODY_W * 0.2237 // 근무기간 / 취득년월일 / 훈련기간 / 기간
const COL_2 = BODY_W * 0.4351 // 근무처 / 자격증 / 훈련명 / 학교명
const COL_3 = BODY_W * 0.2485 // 업무내용 / 발행처 / 훈련기관 / 전공분야

const ROW_H = 26
const HEADER_H = 28
const TITLE_H = 46

const GRAY = rgb(0.85, 0.85, 0.85)
const LINE = rgb(0.2, 0.2, 0.2)
const BLACK = rgb(0.07, 0.07, 0.07)

interface Ctx {
  doc: PDFDocument
  font: PDFFont
  page: PDFPage
  y: number
}

/** 셀 하나 — 테두리, 선택적 회색 배경, 가운데 또는 왼쪽 정렬 텍스트 */
function cell(
  ctx: Ctx,
  x: number,
  w: number,
  h: number,
  text: string,
  opts: { fill?: boolean; center?: boolean; size?: number; spacing?: number } = {},
) {
  const { fill = false, center = false, size = 9, spacing = 0 } = opts
  const y = ctx.y - h

  if (fill) ctx.page.drawRectangle({ x, y, width: w, height: h, color: GRAY })
  ctx.page.drawRectangle({ x, y, width: w, height: h, borderColor: LINE, borderWidth: 0.8 })

  if (!text) return

  const clipped = fitText(ctx.font, text, size, w - 8)
  const textW = ctx.font.widthOfTextAtSize(clipped, size) + spacing * (clipped.length - 1)
  const tx = center ? x + (w - textW) / 2 : x + 4
  const ty = y + (h - size) / 2 + 1.5

  ctx.page.drawText(clipped, {
    x: tx,
    y: ty,
    size,
    font: ctx.font,
    color: BLACK,
    ...(spacing ? { characterSpacing: spacing } : {}),
  })
}

/** 폭을 넘치면 말줄임으로 자른다 — 표 밖으로 삐져나가지 않게 */
function fitText(font: PDFFont, text: string, size: number, maxW: number): string {
  if (font.widthOfTextAtSize(text, size) <= maxW) return text
  let cut = text
  while (cut.length > 1 && font.widthOfTextAtSize(`${cut}…`, size) > maxW) {
    cut = cut.slice(0, -1)
  }
  return `${cut}…`
}

function newPage(ctx: Ctx) {
  ctx.page = ctx.doc.addPage([PAGE_W, PAGE_H])
  ctx.y = PAGE_H - MARGIN
}

/** 남은 높이가 모자라면 다음 장으로 넘긴다 */
function ensure(ctx: Ctx, needed: number) {
  if (ctx.y - needed < MARGIN) newPage(ctx)
}

export async function renderResumePdf(resume: Resume, fontBytes: Uint8Array): Promise<Uint8Array> {
  const doc = await PDFDocument.create()
  doc.registerFontkit(fontkit)
  const font = await doc.embedFont(fontBytes, { subset: true })

  const ctx: Ctx = { doc, font, page: doc.addPage([PAGE_W, PAGE_H]), y: PAGE_H - MARGIN }

  // ── 상단 — 사진칸 ＋ 제목 ＋ 기본정보 ────────────────────────
  const photoW = BODY_W * 0.2083 // 사진칸 = 좌측 두 열의 합
  const headBlockH = TITLE_H + ROW_H * 3
  const restX = MARGIN + photoW
  const restW = BODY_W - photoW

  // 사진칸 (4행 높이, 비워 둔다 — 설계 D11)
  ctx.page.drawRectangle({
    x: MARGIN,
    y: ctx.y - headBlockH,
    width: photoW,
    height: headBlockH,
    borderColor: LINE,
    borderWidth: 0.8,
  })

  cell(ctx, restX, restW, TITLE_H, '이 력 서', { center: true, size: 20, spacing: 10 })
  ctx.y -= TITLE_H

  const lblW = restW * 0.137
  const nameW = restW * 0.39
  const birthLblW = restW * 0.159
  const birthW = restW - lblW - nameW - birthLblW

  cell(ctx, restX, lblW, ROW_H, '성명', { fill: true, center: true })
  cell(ctx, restX + lblW, nameW, ROW_H, resume.name ?? '')
  cell(ctx, restX + lblW + nameW, birthLblW, ROW_H, '생년월일', { fill: true, center: true })
  cell(ctx, restX + lblW + nameW + birthLblW, birthW, ROW_H, birthText(resume.birth_date), {
    center: true,
  })
  ctx.y -= ROW_H

  cell(ctx, restX, lblW, ROW_H, '휴대폰', { fill: true, center: true })
  cell(ctx, restX + lblW, restW - lblW, ROW_H, resume.phone ?? '')
  ctx.y -= ROW_H

  cell(ctx, restX, lblW, ROW_H, '주소', { fill: true, center: true })
  cell(
    ctx,
    restX + lblW,
    restW - lblW,
    ROW_H,
    addressText(resume.base_address ?? '', resume.detail_address ?? ''),
  )
  ctx.y -= ROW_H

  // ── 섹션 넷 ───────────────────────────────────────────────
  for (const section of RESUME_FORM) {
    const rows = sectionRows(resume, section.key)
    const pad = Math.max(0, section.minRows - rows.length)
    const all: [string, string, string][] = [
      ...rows,
      ...Array.from({ length: pad }, () => ['', '', ''] as [string, string, string]),
    ]

    ensure(ctx, HEADER_H + ROW_H)

    // 헤더 행
    const x1 = MARGIN + COL_SIDE
    cell(ctx, MARGIN, COL_SIDE, HEADER_H, section.label, { fill: true, center: true })
    cell(ctx, x1, COL_1, HEADER_H, section.columns[0], { fill: true, center: true })
    cell(ctx, x1 + COL_1, COL_2, HEADER_H, section.columns[1], { fill: true, center: true })
    cell(ctx, x1 + COL_1 + COL_2, COL_3, HEADER_H, section.columns[2], { fill: true, center: true })
    ctx.y -= HEADER_H

    // 데이터 행 — 넘치면 다음 장으로 (설계 D9)
    for (const row of all) {
      if (ctx.y - ROW_H < MARGIN) {
        newPage(ctx)
        cell(ctx, MARGIN, COL_SIDE, HEADER_H, section.label, { fill: true, center: true })
        cell(ctx, x1, COL_1, HEADER_H, section.columns[0], { fill: true, center: true })
        cell(ctx, x1 + COL_1, COL_2, HEADER_H, section.columns[1], { fill: true, center: true })
        cell(ctx, x1 + COL_1 + COL_2, COL_3, HEADER_H, section.columns[2], {
          fill: true,
          center: true,
        })
        ctx.y -= HEADER_H
      }
      cell(ctx, MARGIN, COL_SIDE, ROW_H, '')
      cell(ctx, x1, COL_1, ROW_H, row[0], { center: true })
      cell(ctx, x1 + COL_1, COL_2, ROW_H, row[1])
      cell(ctx, x1 + COL_1 + COL_2, COL_3, ROW_H, row[2], { center: true })
      ctx.y -= ROW_H
    }
  }

  // ── 서명 ─────────────────────────────────────────────────
  const signH = ROW_H * 3
  ensure(ctx, signH)
  ctx.page.drawRectangle({
    x: MARGIN,
    y: ctx.y - signH,
    width: BODY_W,
    height: signH,
    borderColor: LINE,
    borderWidth: 0.8,
  })

  const signed = resume.signature?.signed_at ? new Date(resume.signature.signed_at) : null
  const dateText =
    signed && !Number.isNaN(signed.getTime())
      ? `${signed.getFullYear()}년    ${signed.getMonth() + 1}월    ${signed.getDate()}일`
      : '년    월    일'

  const line = (text: string, offsetRow: number, align: 'center' | 'right') => {
    const size = 9.5
    const w = ctx.font.widthOfTextAtSize(text, size)
    const x = align === 'center' ? MARGIN + (BODY_W - w) / 2 : MARGIN + BODY_W - w - 60
    ctx.page.drawText(text, {
      x,
      y: ctx.y - ROW_H * offsetRow - 17,
      size,
      font: ctx.font,
      color: BLACK,
    })
  }

  line('위에 기재한 사항은 사실과 틀림이 없습니다.', 0, 'center')
  line(dateText, 1, 'center')
  line(`성명 :  ${resume.signature?.name ?? ''}          (서명)`, 2, 'right')

  // useObjectStreams: false — 기본값(true)이면 페이지 객체가 압축된 오브젝트 스트림 안에
  // 들어가 "/Type /Page" 가 원문에 나타나지 않는다. 테스트가 저 문자열을 세어 페이지 수를
  // 확인하므로 꺼둔다.
  return await doc.save({ useObjectStreams: false })
}
