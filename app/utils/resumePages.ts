// 이력서 서류의 A4 장 나누기 — 양식을 줄 목록으로 펴고, 실측한 줄 높이로 장마다 담을 줄을 고른다
//
// ⚠ dolbomdari-link/app/utils/resumePages.ts 에 같은 파일이 복제돼 있다. 하나를 고치면 둘 다 고친다.
import { RESUME_FORM, sectionRows, type FormSection, type Resume } from '../../shared/resume-form'

/** A4(210×297mm)를 CSS 96dpi 픽셀로 */
export const PAGE_W = 794
export const PAGE_H = 1123
/** 장 안쪽 여백 — 아래 여백은 쪽 번호 자리를 겸한다 */
export const PAGE_PAD_X = 48
export const PAGE_PAD_Y = 56
/** 표를 담을 높이. 실측 소수점·겹친 테두리 몫으로 4px 남긴다 */
export const BODY_H = PAGE_H - PAGE_PAD_Y * 2 - 4

export type DocRow =
  | { kind: 'head'; part: 0 | 1 | 2 | 3 }
  | { kind: 'columns'; section: FormSection }
  | { kind: 'item'; section: FormSection; cells: [string, string, string] }
  | { kind: 'sign' }

/** 장에 놓인 줄 — 섹션 줄 묶음의 첫 줄에만 왼쪽 라벨 칸(rowspan)이 붙는다. 앞 장에서 이어지면 라벨이 빈 칸이다 */
export type PageRow = DocRow & { side?: { label: string; span: number } }

/** 양식 전체를 줄 목록으로 — 섹션은 기본 행 수까지 빈 줄로 채운다 (설계 D9) */
export function docRows(resume: Resume): DocRow[] {
  const rows: DocRow[] = [
    { kind: 'head', part: 0 },
    { kind: 'head', part: 1 },
    { kind: 'head', part: 2 },
    { kind: 'head', part: 3 },
  ]
  for (const section of RESUME_FORM) {
    rows.push({ kind: 'columns', section })
    const items = sectionRows(resume, section.key)
    const blanks = Math.max(0, section.minRows - items.length)
    for (const cells of items) rows.push({ kind: 'item', section, cells })
    for (let i = 0; i < blanks; i++) rows.push({ kind: 'item', section, cells: ['', '', ''] })
  }
  rows.push({ kind: 'sign' })
  return rows
}

/** 다음 줄과 같은 장에 있어야 하는 줄 — 머리 네 줄(사진 칸이 넷을 걸친다), 섹션 머리글(장 끝에 홀로 남지 않게) */
function keepsWithNext(row: DocRow): boolean {
  return (row.kind === 'head' && row.part < 3) || row.kind === 'columns'
}

function sectionOf(row: DocRow): FormSection | null {
  return row.kind === 'columns' || row.kind === 'item' ? row.section : null
}

/**
 * 줄 높이로 장을 나눈다. 넘치는 줄은 통째로 다음 장에 넘긴다 — 줄을 반으로 자르지 않고, 머리글을 되풀이하지 않는다.
 * 한 장보다 큰 묶음은 빈 장에 그대로 둔다(넘친다).
 */
export function paginate(rows: DocRow[], heights: number[], bodyHeight = BODY_H): PageRow[][] {
  const pages: DocRow[][] = [[]]
  let used = 0
  for (let start = 0; start < rows.length; ) {
    let end = start
    while (end < rows.length - 1 && keepsWithNext(rows[end]!)) end++
    const chunk = rows.slice(start, end + 1)
    const height = heights.slice(start, end + 1).reduce((a, b) => a + b, 0)
    if (used + height > bodyHeight && pages.at(-1)!.length) {
      pages.push([])
      used = 0
    }
    pages.at(-1)!.push(...chunk)
    used += height
    start = end + 1
  }
  return pages.map(withSides)
}

function withSides(rows: DocRow[]): PageRow[] {
  return rows.map((row, i) => {
    const section = sectionOf(row)
    if (!section || (i > 0 && sectionOf(rows[i - 1]!) === section)) return row
    let span = 1
    while (i + span < rows.length && sectionOf(rows[i + span]!) === section) span++
    return { ...row, side: { label: row.kind === 'columns' ? section.label : '', span } }
  })
}
