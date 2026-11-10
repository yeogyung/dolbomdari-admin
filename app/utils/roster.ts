// 근무표(QA SHIFT-03·05·07) — 주간·월간 날짜, 칸 편집(쉼·다른 시간·배정대로), 끌어 복사, 일괄 저장 목록. 칸 상태·잠금은 서버가 정한다
import { hhmm } from './dbo'

export type RosterCellState = 'none' | 'work' | 'skip' | 'time' | 'holiday'

export type RosterCell = {
  date: string
  state: RosterCellState
  startTime: string | null
  endTime: string | null
  recorded: boolean
  locked: 'past' | 'recorded' | 'holiday' | null
}

export type RosterRow = {
  assignmentId: string
  directoryId: string
  name: string
  weekdays: number[]
  startTime: string
  endTime: string
  periodStart: string | null
  periodEnd: string | null
  cells: RosterCell[]
}

export type Roster = {
  worksite: { id: string; name: string }
  from: string
  to: string
  today: string
  canEdit: boolean
  holidays: string[]
  rows: RosterRow[]
}

/** 바꿀 내용. revert 는 그날을 배정대로 되돌린다 */
export type DayEdit = { kind: 'skip' } | { kind: 'time'; start: string; end: string } | { kind: 'revert' }

/** 칸이 바뀐 뒤 보일 모양. 편집 중이면 바꾼 값, 아니면 서버 값 */
export type CellView = { state: RosterCellState; startTime: string | null; endTime: string | null }

const DAY_MS = 86_400_000

function addDays(date: string, days: number): string {
  return new Date(Date.parse(`${date}T00:00:00Z`) + days * DAY_MS).toISOString().slice(0, 10)
}

/** ISO 요일 월=1 … 일=7 */
export function isoWeekday(date: string): number {
  const d = new Date(`${date}T00:00:00Z`).getUTCDay()
  return d === 0 ? 7 : d
}

/** 그 날이 든 주(월~일) */
export function weekRange(date: string): { from: string; to: string } {
  const from = addDays(date, 1 - isoWeekday(date))
  return { from, to: addDays(from, 6) }
}

/** 그 날이 든 달(1일~말일) */
export function monthRange(date: string): { from: string; to: string } {
  const [y, m] = date.split('-').map(Number)
  const from = `${y}-${String(m).padStart(2, '0')}-01`
  const last = new Date(Date.UTC(y, m, 0)).getUTCDate()
  return { from, to: `${y}-${String(m).padStart(2, '0')}-${String(last).padStart(2, '0')}` }
}

/** 앞뒤 주·달로 옮긴 기준 날. 달은 1일로 맞춘다(31일에서 한 달 앞이 다음다음 달이 되지 않게) */
export function moveAnchor(anchor: string, view: 'week' | 'month', step: number): string {
  if (view === 'week') return addDays(anchor, step * 7)
  const [y, m] = anchor.split('-').map(Number)
  const d = new Date(Date.UTC(y, m - 1 + step, 1))
  return d.toISOString().slice(0, 10)
}

const DAY_NAMES = ['월', '화', '수', '목', '금', '토', '일']

/** '11/12(목)' */
export function dayHeader(date: string): string {
  const [, m, d] = date.split('-').map(Number)
  return `${m}/${d}(${DAY_NAMES[isoWeekday(date) - 1]})`
}

export function cellKey(assignmentId: string, date: string): string {
  return `${assignmentId}|${date}`
}

/** 'HH:MM' 두 개가 맞는 시간인가(시작이 끝보다 앞) */
export function validTimes(start: string, end: string): boolean {
  const ok = /^([01]\d|2[0-3]):[0-5]\d$/
  return ok.test(start) && ok.test(end) && start < end
}

/** 편집을 적용한 칸 모양. 칸을 고칠 수 없으면(none·잠김) 편집을 무시한다 */
export function viewOf(row: RosterRow, cell: RosterCell, edit: DayEdit | undefined): CellView {
  if (!edit || !editable(cell)) return { state: cell.state, startTime: cell.startTime, endTime: cell.endTime }
  if (edit.kind === 'skip') return { state: 'skip', startTime: null, endTime: null }
  if (edit.kind === 'time') return { state: 'time', startTime: `${edit.start}:00`, endTime: `${edit.end}:00` }
  return { state: 'work', startTime: row.startTime, endTime: row.endTime }
}

/** 고칠 수 있는 칸 — 근무가 있고 잠기지 않았다 */
export function editable(cell: RosterCell): boolean {
  return cell.state !== 'none' && cell.state !== 'holiday' && cell.locked === null
}

/**
 * 칸을 이 모양으로 만들려면 서버에 보낼 편집. 이미 그 모양이면(서버 값 그대로) null — 보낼 것이 없다.
 * 다른 시간이 배정 시간과 같으면 「배정대로」다.
 */
export function editToward(row: RosterRow, cell: RosterCell, target: CellView): DayEdit | null {
  if (!editable(cell)) return null
  const assigned = hhmm(row.startTime) === hhmm(target.startTime) && hhmm(row.endTime) === hhmm(target.endTime)
  const want: CellView['state'] = target.state === 'time' && assigned ? 'work' : target.state
  if (want === 'skip') return cell.state === 'skip' ? null : { kind: 'skip' }
  if (want === 'work') return cell.state === 'work' ? null : { kind: 'revert' }
  if (want !== 'time') return null
  const start = hhmm(target.startTime)
  const end = hhmm(target.endTime)
  if (cell.state === 'time' && hhmm(cell.startTime) === start && hhmm(cell.endTime) === end) return null
  return { kind: 'time', start, end }
}

/** 끌어 복사 범위 — 시작 칸과 끝 칸이 만드는 사각형의 (줄, 칸) 번호. 시작 칸은 뺀다 */
export function fillArea(
  from: { row: number; col: number },
  to: { row: number; col: number },
): { row: number; col: number }[] {
  const out: { row: number; col: number }[] = []
  for (let r = Math.min(from.row, to.row); r <= Math.max(from.row, to.row); r++) {
    for (let c = Math.min(from.col, to.col); c <= Math.max(from.col, to.col); c++) {
      if (r !== from.row || c !== from.col) out.push({ row: r, col: c })
    }
  }
  return out
}

/**
 * 시작 칸의 모양(편집 반영)을 범위 칸들에 복사한 편집 목록. 고칠 수 없는 칸·이미 같은 칸은 건너뛴다.
 * 돌려주는 값을 편집 표에 그대로 덮는다 — null 은 「편집 지우기」(서버 값과 같아짐)다.
 */
export function copyEdits(
  rows: RosterRow[],
  edits: Map<string, DayEdit>,
  from: { row: number; col: number },
  to: { row: number; col: number },
): Map<string, DayEdit | null> {
  const srcRow = rows[from.row]
  const srcCell = srcRow?.cells[from.col]
  const out = new Map<string, DayEdit | null>()
  if (!srcRow || !srcCell || srcCell.state === 'none') return out
  const source = viewOf(srcRow, srcCell, edits.get(cellKey(srcRow.assignmentId, srcCell.date)))
  if (source.state === 'holiday') return out
  for (const { row, col } of fillArea(from, to)) {
    const r = rows[row]
    const c = r?.cells[col]
    if (!r || !c || !editable(c)) continue
    // 「배정대로」를 복사하면 대상 줄의 배정 시간이다 — 줄마다 배정 시간이 다르다
    const target: CellView = source.state === 'work'
      ? { state: 'work', startTime: r.startTime, endTime: r.endTime }
      : source
    out.set(cellKey(r.assignmentId, c.date), editToward(r, c, target))
  }
  return out
}

export type SaveItem = { assignmentId: string; date: string; name: string; edit: DayEdit }

/** 저장할 편집 목록 — 이름·날짜 순. 표에 없는 칸(기간을 옮긴 뒤 남은 편집)은 뺀다 */
export function saveItems(rows: RosterRow[], edits: Map<string, DayEdit>): SaveItem[] {
  const out: SaveItem[] = []
  for (const r of rows) {
    for (const c of r.cells) {
      const edit = edits.get(cellKey(r.assignmentId, c.date))
      if (edit && editable(c)) out.push({ assignmentId: r.assignmentId, date: c.date, name: r.name, edit })
    }
  }
  return out
}

/** 칸 글자. 월간 표(compact)는 칸이 좁아 시간 대신 「근무」·「변경」만 쓰고 시간은 마우스를 올리면 보인다 */
export function cellText(view: CellView, compact = false): string {
  if (view.state === 'none') return ''
  if (view.state === 'holiday') return '휴무'
  if (view.state === 'skip') return '쉼'
  if (compact) return view.state === 'time' ? '변경' : '근무'
  return `${hhmm(view.startTime)}–${hhmm(view.endTime)}`
}

/** 다시 받은 표에서 서버 값과 같아진 편집(저장됐거나 남이 같은 값으로 바꾼 칸)과 고칠 수 없게 된 칸의 편집을 지운다 */
export function pruneEdits(rows: RosterRow[], edits: Map<string, DayEdit>): Map<string, DayEdit> {
  const out = new Map<string, DayEdit>()
  for (const r of rows) {
    for (const c of r.cells) {
      const key = cellKey(r.assignmentId, c.date)
      const edit = edits.get(key)
      if (!edit) continue
      const still = editToward(r, c, viewOf(r, c, edit))
      if (still) out.set(key, still)
    }
  }
  return out
}

/** 잠긴 칸에 마우스를 올리면 보일 까닭 */
export function lockReason(cell: RosterCell): string | null {
  if (cell.locked === 'past') return '지난 날은 바꿀 수 없습니다.'
  if (cell.locked === 'recorded') return '출결 기록이 있는 날은 바꿀 수 없습니다.'
  if (cell.locked === 'holiday') return '근무지 휴무일입니다.'
  return null
}

/** 날짜 변경 저장 실패 까닭(서버 오류 코드) */
export function dayErrorMessage(e: any): string {
  const code: string | undefined = e?.data?.error
  const messages: Record<string, string> = {
    past_date: '지난 날이라 바꿀 수 없습니다.',
    recorded: '그날 출결 기록이 생겨 바꿀 수 없습니다.',
    holiday: '그날 근무지 휴무가 잡혀 바꿀 수 없습니다.',
    not_working_day: '그날은 배정된 근무가 없습니다(배정이 바뀌었을 수 있습니다).',
    inactive: '활동을 마친 분입니다.',
    bad_time: '시작 시간이 끝 시간보다 앞이어야 합니다.',
    same_as_assignment: '배정 시간과 같습니다. 「배정대로」를 골라 주세요.',
    too_far: '1년 넘게 앞의 날은 바꿀 수 없습니다.',
    not_found: '되돌릴 변경이 없습니다(이미 되돌렸을 수 있습니다).',
    forbidden: '이 근무지의 근무표를 바꿀 권한이 없습니다.',
    shift_sync_failed: '변경은 저장됐지만 오늘·내일 근무에 바로 반영하지 못했습니다. 같은 칸을 다시 저장해 주세요.',
  }
  return (code && messages[code]) || '저장하지 못했습니다.'
}

/** 실패 줄의 앞머리 — '김순자 11/12(목)' */
export function saveItemLabel(item: SaveItem): string {
  return `${item.name} ${dayHeader(item.date)}`
}
