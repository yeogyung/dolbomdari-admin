// 근무표 도우미(QA SHIFT-03·05·07) — 주간·월간 날짜, 칸 편집, 끌어 복사, 저장 목록, 편집 정리를 고정한다
import { describe, expect, it } from 'vitest'
import {
  type DayEdit,
  type RosterCell,
  type RosterRow,
  cellKey,
  cellText,
  copyEdits,
  dayErrorMessage,
  editToward,
  fillArea,
  monthRange,
  moveAnchor,
  pruneEdits,
  saveItems,
  viewOf,
  weekRange,
} from '../app/utils/roster'

const cell = (date: string, over: Partial<RosterCell> = {}): RosterCell => ({
  date,
  state: 'work',
  startTime: '09:00:00',
  endTime: '12:00:00',
  recorded: false,
  locked: null,
  ...over,
})
const row = (id: string, cells: RosterCell[], over: Partial<RosterRow> = {}): RosterRow => ({
  assignmentId: id,
  directoryId: `d-${id}`,
  name: id,
  weekdays: [1, 2, 3, 4, 5],
  startTime: '09:00:00',
  endTime: '12:00:00',
  periodStart: null,
  periodEnd: null,
  cells,
  ...over,
})

describe('기간', () => {
  it('주는 월~일, 달은 1일~말일이다', () => {
    expect(weekRange('2026-11-12')).toEqual({ from: '2026-11-09', to: '2026-11-15' })
    expect(weekRange('2026-11-15')).toEqual({ from: '2026-11-09', to: '2026-11-15' })
    expect(monthRange('2026-02-10')).toEqual({ from: '2026-02-01', to: '2026-02-28' })
    expect(monthRange('2028-02-10')).toEqual({ from: '2028-02-01', to: '2028-02-29' })
  })

  it('앞뒤로 옮기면 주는 7일, 달은 1일로 맞춰 한 달씩이다', () => {
    expect(moveAnchor('2026-11-12', 'week', 1)).toBe('2026-11-19')
    expect(moveAnchor('2026-01-31', 'month', 1)).toBe('2026-02-01')
    expect(moveAnchor('2026-01-15', 'month', -1)).toBe('2025-12-01')
  })
})

describe('칸 편집', () => {
  const r = row('a', [cell('2026-11-12')])
  const c = r.cells[0]!

  it('이미 그 모양이면 보낼 것이 없다, 배정 시간과 같은 다른 시간은 배정대로다', () => {
    expect(editToward(r, c, { state: 'work', startTime: '09:00:00', endTime: '12:00:00' })).toBeNull()
    expect(editToward(r, c, { state: 'time', startTime: '09:00:00', endTime: '12:00:00' })).toBeNull()
    expect(editToward(r, c, { state: 'skip', startTime: null, endTime: null })).toEqual({ kind: 'skip' })
    expect(editToward(r, c, { state: 'time', startTime: '13:00:00', endTime: '16:00:00' })).toEqual({
      kind: 'time',
      start: '13:00',
      end: '16:00',
    })
  })

  it('쉼·다른 시간인 칸을 배정대로 하면 되돌리기다', () => {
    const skipped = cell('2026-11-12', { state: 'skip', startTime: null, endTime: null })
    expect(editToward(r, skipped, { state: 'work', startTime: null, endTime: null })).toEqual({ kind: 'revert' })
    const timed = cell('2026-11-12', { state: 'time', startTime: '13:00:00', endTime: '16:00:00' })
    expect(editToward(r, timed, { state: 'time', startTime: '13:00:00', endTime: '16:00:00' })).toBeNull()
  })

  it('잠긴 칸·근무 없는 칸·휴무 칸은 편집하지 않는다', () => {
    for (const locked of [
      cell('2026-11-12', { locked: 'past' }),
      cell('2026-11-12', { locked: 'recorded' }),
      cell('2026-11-12', { state: 'none' }),
      cell('2026-11-12', { state: 'holiday', locked: 'holiday' }),
    ]) {
      expect(editToward(r, locked, { state: 'skip', startTime: null, endTime: null })).toBeNull()
      expect(viewOf(r, locked, { kind: 'skip' }).state).toBe(locked.state)
    }
  })

  it('칸 글자 — 주간은 시간, 월간은 근무·변경', () => {
    expect(cellText({ state: 'work', startTime: '09:00:00', endTime: '12:00:00' })).toBe('09:00–12:00')
    expect(cellText({ state: 'time', startTime: '13:00:00', endTime: '16:00:00' }, true)).toBe('변경')
    expect(cellText({ state: 'skip', startTime: null, endTime: null })).toBe('쉼')
    expect(cellText({ state: 'none', startTime: null, endTime: null })).toBe('')
  })
})

describe('끌어 복사', () => {
  it('사각형 범위에서 시작 칸만 뺀다', () => {
    expect(fillArea({ row: 0, col: 0 }, { row: 1, col: 1 })).toEqual([
      { row: 0, col: 1 },
      { row: 1, col: 0 },
      { row: 1, col: 1 },
    ])
    expect(fillArea({ row: 1, col: 2 }, { row: 1, col: 0 })).toEqual([{ row: 1, col: 0 }, { row: 1, col: 1 }])
  })

  it('시작 칸의 모양(편집 반영)을 복사하고, 잠긴 칸·근무 없는 칸은 건너뛴다', () => {
    const rows = [
      row('a', [cell('d1'), cell('d2'), cell('d3', { locked: 'recorded' }), cell('d4', { state: 'none' })]),
    ]
    const edits = new Map<string, DayEdit>([[cellKey('a', 'd1'), { kind: 'skip' }]])
    const out = copyEdits(rows, edits, { row: 0, col: 0 }, { row: 0, col: 3 })
    expect([...out]).toEqual([[cellKey('a', 'd2'), { kind: 'skip' }]])
  })

  it('「배정대로」를 복사하면 줄마다 그 줄의 배정 시간이다 — 이미 배정대로인 칸은 편집을 지운다', () => {
    const rows = [
      row('a', [cell('d1')]),
      row('b', [cell('d1', { state: 'time', startTime: '15:00:00', endTime: '17:00:00' })], {
        startTime: '13:00:00',
        endTime: '16:00:00',
      }),
      row('c', [cell('d1')]),
    ]
    const out = copyEdits(rows, new Map([[cellKey('c', 'd1'), { kind: 'skip' }]]), { row: 0, col: 0 }, { row: 2, col: 0 })
    expect(out.get(cellKey('b', 'd1'))).toEqual({ kind: 'revert' })
    expect(out.get(cellKey('c', 'd1'))).toBeNull()
  })

  it('다른 시간을 복사하면 같은 시간이고, 그 줄 배정 시간과 같으면 배정대로다', () => {
    const rows = [
      row('a', [cell('d1')]),
      row('b', [cell('d1')], { startTime: '13:00:00', endTime: '16:00:00' }),
    ]
    const edits = new Map<string, DayEdit>([[cellKey('a', 'd1'), { kind: 'time', start: '13:00', end: '16:00' }]])
    const out = copyEdits(rows, edits, { row: 0, col: 0 }, { row: 1, col: 0 })
    expect(out.get(cellKey('b', 'd1'))).toBeNull()
  })

  it('근무 없는 칸·휴무 칸에서 시작하면 아무것도 복사하지 않는다', () => {
    const rows = [row('a', [cell('d1', { state: 'none' }), cell('d2'), cell('d3', { state: 'holiday', locked: 'holiday' })])]
    expect(copyEdits(rows, new Map(), { row: 0, col: 0 }, { row: 0, col: 1 }).size).toBe(0)
    expect(copyEdits(rows, new Map(), { row: 0, col: 2 }, { row: 0, col: 1 }).size).toBe(0)
  })
})

describe('저장', () => {
  it('표에 있고 고칠 수 있는 칸의 편집만 이름·날짜 순으로 낸다', () => {
    const rows = [row('a', [cell('d1'), cell('d2', { locked: 'recorded' })])]
    const edits = new Map<string, DayEdit>([
      [cellKey('a', 'd2'), { kind: 'skip' }],
      [cellKey('a', 'd1'), { kind: 'skip' }],
      [cellKey('gone', 'd1'), { kind: 'skip' }],
    ])
    expect(saveItems(rows, edits).map((i) => `${i.assignmentId}|${i.date}`)).toEqual(['a|d1'])
  })

  it('다시 받은 표에서 저장된 편집과 잠긴 칸 편집을 지운다', () => {
    const rows = [row('a', [
      cell('d1', { state: 'skip', startTime: null, endTime: null }),
      cell('d2', { locked: 'recorded' }),
      cell('d3'),
    ])]
    const edits = new Map<string, DayEdit>([
      [cellKey('a', 'd1'), { kind: 'skip' }],
      [cellKey('a', 'd2'), { kind: 'skip' }],
      [cellKey('a', 'd3'), { kind: 'skip' }],
    ])
    expect([...pruneEdits(rows, edits).keys()]).toEqual([cellKey('a', 'd3')])
  })

  it('저장 실패 까닭은 서버 오류 코드로 고른다', () => {
    expect(dayErrorMessage({ data: { error: 'recorded' } })).toContain('출결')
    expect(dayErrorMessage({ data: { error: 'unknown_code' } })).toBe('저장하지 못했습니다.')
    expect(dayErrorMessage(new Error('x'))).toBe('저장하지 못했습니다.')
  })
})
