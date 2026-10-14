// 참여자 일괄 등록 규칙 — 번호 정규화·표 해석·파일 안 중복·순차 등록(QA 2026-10-14 10번)

/** 한 번에 받는 최대 인원. 등록은 한 명씩 순서대로 보내므로 너무 길면 화면을 오래 붙잡는다 */
export const BULK_MAX = 500

export type ImportStatus = 'ok' | 'invalid' | 'duplicate' | 'done' | 'taken' | 'failed' | 'skipped'

export interface ImportRow {
  /** 파일·붙여넣기의 줄 번호(1부터). 운영자가 원본에서 찾을 수 있게 그대로 보인다 */
  line: number
  name: string
  phone: string
  memo: string
  status: ImportStatus
  reason?: string
}

/**
 * 서버 `normalizeAdminPhone`(dolbomdari-server `apps/dbo/admin/handlers/directory.ts`)과 **같아야 한다.**
 * 번호가 앱 로그인의 열쇠라, 서버가 거절할 번호는 미리 걸러 보내지 않는다. 틀리면 null.
 */
export function normalizePhone(raw: string): string | null {
  let d = (raw ?? '').replace(/[^0-9+]/g, '')
  if (d.startsWith('+82')) d = '0' + d.slice(3)
  d = d.replace(/\D/g, '')
  return /^01[0-9]{8,9}$/.test(d) ? d : null
}

/** 붙여넣은 목록 → 줄마다 칸. 탭(엑셀 복사)·쉼표·두 칸 이상 공백으로 나눈다. 빈 줄은 버린다 */
export function splitPasted(text: string): string[][] {
  return text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => line.split(/\t|,| {2,}/).map((cell) => cell.trim()))
}

const HEADERS = {
  name: ['이름', '성명'],
  phone: ['전화번호', '휴대폰', '핸드폰', '연락처'],
  memo: ['메모', '비고'],
}

/** 첫 줄에 이름·전화번호 머리글이 있으면 그 위치를, 없으면 이름·전화번호·메모 순서를 쓴다 */
function columnsOf(first: string[]): { name: number; phone: number; memo: number; header: boolean } {
  const find = (keys: string[]) => first.findIndex((c) => keys.some((k) => c.replace(/\s/g, '').startsWith(k)))
  const name = find(HEADERS.name)
  const phone = find(HEADERS.phone)
  // 둘 다 있어야 머리글이다. 하나만 보고 판정하면 이름이 「이름」인 줄을 머리글로 오인한다
  if (name < 0 || phone < 0) return { name: 0, phone: 1, memo: 2, header: false }
  return { name, phone, memo: find(HEADERS.memo), header: true }
}

export function parseImportRows(table: string[][]): ImportRow[] {
  if (table.length === 0) return []
  const cols = columnsOf(table[0]!)
  const body = cols.header ? table.slice(1) : table
  const offset = cols.header ? 2 : 1
  const firstLineOf = new Map<string, number>()
  let accepted = 0

  return body
    .map((cells, i) => ({ cells, line: i + offset }))
    .filter(({ cells }) => cells.some((c) => String(c ?? '').trim()))
    .map(({ cells, line }) => {
      const cell = (i: number) => (i >= 0 ? String(cells[i] ?? '').trim() : '')
      const rawPhone = cell(cols.phone)
      const row: ImportRow = { line, name: cell(cols.name), phone: rawPhone, memo: cell(cols.memo), status: 'ok' }
      const phone = normalizePhone(rawPhone)
      if (!row.name) return { ...row, status: 'invalid', reason: '이름이 없습니다' }
      if (!phone) return { ...row, status: 'invalid', reason: '전화번호 형식이 틀렸습니다' }
      row.phone = phone
      const first = firstLineOf.get(phone)
      if (first !== undefined) return { ...row, status: 'duplicate', reason: `${first}행과 같은 번호입니다` }
      firstLineOf.set(phone, line)
      if (accepted >= BULK_MAX) return { ...row, status: 'invalid', reason: `한 번에 ${BULK_MAX}명까지 등록합니다` }
      accepted++
      return row
    })
}

/**
 * 등록할 수 있는 행(ok)만 한 명씩 순서대로 보낸다. 실패해도 멈추지 않고 행마다 결과를 남긴다.
 * 서버의 409 phone_taken 은 오류가 아니라 「이미 등록됨」이다. 되돌리지 않는다 — 중간에 멈추면
 * 앞쪽은 등록된 채로 남는다.
 */
export async function runImport(
  rows: ImportRow[],
  create: (row: ImportRow) => Promise<unknown>,
  shouldStop: () => boolean,
  onProgress?: () => void,
): Promise<void> {
  for (const row of rows) {
    if (row.status !== 'ok') continue
    if (shouldStop()) {
      row.status = 'skipped'
      continue
    }
    try {
      await create(row)
      row.status = 'done'
    } catch (e: any) {
      const taken = e?.status === 409 && e?.data?.error === 'phone_taken'
      row.status = taken ? 'taken' : 'failed'
      const code = e?.data?.error ?? e?.status
      row.reason = taken ? '이미 등록된 번호입니다' : `등록하지 못했습니다${code ? ` (${code})` : ''}`
    }
    onProgress?.()
  }
}
