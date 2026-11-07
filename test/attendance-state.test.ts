// 출퇴근 표시 상태·「수정됨」 판정·이력 문구 테스트(QA 2026-10-14 11·12·13번)
import { describe, expect, it } from 'vitest'
import {
  ATTENDANCE_DISPLAY_OPTIONS,
  attendanceDisplay,
  attendanceVersion,
  attentionRank,
  changedSince,
  describeChange,
  editDefaultStatus,
  filterShiftsByScope,
  groupChangesByShift,
  isAttendanceConflict,
  isHumanEdited,
  tallyDay,
} from '../app/utils/attendanceState'
import type { AttendanceChange } from '../app/types/dbo'

// 서울 2026-10-14 14:00
const NOW = new Date('2026-10-14T05:00:00Z')

function shift(workDate: string, rec: Record<string, unknown> | null, plannedStart: string | null = '09:00:00') {
  return {
    work_date: workDate,
    planned_start: plannedStart,
    attendance: rec
      ? { status: 'present', started_at: null, ended_at: null, method: 'qr', ...rec }
      : null,
  } as any
}
// 서울 시각 → ISO
const at = (date: string, hm: string) => new Date(`${date}T${hm}+09:00`).toISOString()

describe('attendanceDisplay', () => {
  it('예정 시각 전에 출근하고 퇴근했으면 정상', () => {
    const row = shift('2026-10-14', { started_at: at('2026-10-14', '08:59:00'), ended_at: at('2026-10-14', '13:00:00') })
    expect(attendanceDisplay(row, NOW)).toBe('normal')
  })

  it('1분 미만 늦으면 정상, 1분 늦으면 지각', () => {
    const ended = at('2026-10-14', '13:00:00')
    expect(attendanceDisplay(shift('2026-10-14', { started_at: at('2026-10-14', '09:00:59'), ended_at: ended }), NOW)).toBe('normal')
    expect(attendanceDisplay(shift('2026-10-14', { started_at: at('2026-10-14', '09:01:00'), ended_at: ended }), NOW)).toBe('late')
  })

  it('저장된 상태가 지각이면 지각', () => {
    const row = shift('2026-10-14', { status: 'late', started_at: at('2026-10-14', '09:00:00'), ended_at: at('2026-10-14', '13:00:00') })
    expect(attendanceDisplay(row, NOW)).toBe('late')
  })

  it('사람이 출근으로 정정한 기록은 시각이 늦어도 정상', () => {
    const row = shift('2026-10-14', { method: 'manual', started_at: at('2026-10-14', '09:30:00'), ended_at: at('2026-10-14', '13:00:00') })
    expect(attendanceDisplay(row, NOW)).toBe('normal')
  })

  it('오늘 출근하고 퇴근이 없으면 근무 중', () => {
    expect(attendanceDisplay(shift('2026-10-14', { started_at: at('2026-10-14', '09:00:00') }), NOW)).toBe('working')
  })

  it('지난 날 출근하고 퇴근이 없으면 퇴근 누락', () => {
    expect(attendanceDisplay(shift('2026-10-13', { started_at: at('2026-10-13', '09:00:00') }), NOW)).toBe('missing_checkout')
  })

  it('서울 자정이 지나면 전날 근무는 퇴근 누락', () => {
    const justAfterMidnight = new Date('2026-10-13T15:30:00Z') // 서울 10/14 00:30
    expect(attendanceDisplay(shift('2026-10-13', { started_at: at('2026-10-13', '09:00:00') }), justAfterMidnight)).toBe('missing_checkout')
  })

  it('기록이 없으면 지난 날·예정 시각 지난 오늘은 미출근, 그 밖은 출근 전', () => {
    expect(attendanceDisplay(shift('2026-10-13', null), NOW)).toBe('not_arrived')
    expect(attendanceDisplay(shift('2026-10-14', null, '09:00:00'), NOW)).toBe('not_arrived')
    expect(attendanceDisplay(shift('2026-10-14', null, '18:00:00'), NOW)).toBe('scheduled')
    expect(attendanceDisplay(shift('2026-10-15', null), NOW)).toBe('scheduled')
    expect(attendanceDisplay(shift('2026-10-14', null, null), NOW)).toBe('scheduled')
  })

  it('결석·인정 결석은 시각이 있어도 그대로', () => {
    expect(attendanceDisplay(shift('2026-10-14', { status: 'absent', started_at: at('2026-10-14', '09:00:00') }), NOW)).toBe('absent')
    expect(attendanceDisplay(shift('2026-10-14', { status: 'excused' }), NOW)).toBe('excused')
  })
})

function change(role: string, after: Record<string, unknown>, before: Record<string, unknown> | null = null, createdAt = '2026-10-14T01:00:00Z'): AttendanceChange {
  const empty = { status: null, started_at: null, ended_at: null, memo: null }
  return {
    id: `${role}-${createdAt}`,
    shift_id: 's1',
    created_at: createdAt,
    changed_by_name: role === 'senior' ? '김시니어' : '박담당',
    changed_by_role: role,
    before: before ? { ...empty, ...before } : null,
    after: { ...empty, ...after },
  }
}

describe('isHumanEdited', () => {
  // QR 기록이 전부 「수정됨」으로 보이던 버그의 회귀 테스트
  it('이력 없는 QR 기록은 수정되지 않은 것', () => {
    expect(isHumanEdited([], { method: 'qr' } as any)).toBeNull()
  })

  it('시니어 본인 QR 이력만 있으면 수정되지 않은 것', () => {
    expect(isHumanEdited([change('senior', { status: 'present' })], { method: 'qr' } as any)).toBeNull()
  })

  it('사람이 고친 이력이 있으면 수정됨. 뒤에 QR 퇴근이 와도 유지', () => {
    const list = [change('senior', { ended_at: 'x' }, {}, '2026-10-14T05:00:00Z'), change('manager', { status: 'late' })]
    expect(isHumanEdited(list, { method: 'qr' } as any)).toBe('edited')
  })

  it('이력 기능 전에 사람이 고친 기록은 legacy', () => {
    expect(isHumanEdited([], { method: 'manual' } as any)).toBe('legacy')
  })
})

describe('groupChangesByShift', () => {
  it('근무별로 묶고 순서를 지킨다', () => {
    const a = { ...change('manager', {}), id: 'a', shift_id: 's1' }
    const b = { ...change('manager', {}), id: 'b', shift_id: 's2' }
    const c = { ...change('manager', {}), id: 'c', shift_id: 's1' }
    const map = groupChangesByShift([a, b, c])
    expect(map.get('s1')?.map((x) => x.id)).toEqual(['a', 'c'])
    expect(map.get('s2')?.map((x) => x.id)).toEqual(['b'])
  })
})

describe('describeChange', () => {
  it('처음 기록은 상태만 적는다', () => {
    expect(describeChange(change('senior', { status: 'present' })).what).toBe('출근')
  })

  it('상태와 시각 변경을 서울 시각으로 적는다', () => {
    const c = change(
      'manager',
      { status: 'present', started_at: '2026-10-14T00:05:00Z', memo: ' QR 미인식 ' },
      { status: 'absent', started_at: null },
    )
    const d = describeChange(c)
    expect(d.what).toBe('결석 → 출근 · 출근 09:05')
    expect(d.who).toBe('박담당 (담당자)')
    expect(d.memo).toBe('QR 미인식')
  })

  it('지운 시각은 「없음」으로 적는다', () => {
    const c = change('manager', { ended_at: null, memo: '정정' }, { ended_at: '2026-10-14T09:00:00Z' })
    expect(describeChange(c).what).toBe('퇴근 18:00 → 없음')
  })

  it('바뀐 칸이 없으면 사유 수정', () => {
    const c = change('manager', { status: 'present', memo: '새 사유' }, { status: 'present', memo: '옛 사유' })
    expect(describeChange(c).what).toBe('사유 수정')
  })

  it('시니어 줄에는 사유를 붙이지 않는다', () => {
    const c = change('senior', { ended_at: '2026-10-14T04:00:00Z', memo: '담당자가 쓴 옛 사유' }, { ended_at: null, memo: '담당자가 쓴 옛 사유' })
    const d = describeChange(c)
    expect(d.memo).toBeNull()
    expect(d.who).toBe('김시니어 (본인 QR)')
    expect(d.what).toBe('퇴근 13:00')
  })
})

// 리뷰 지적: 퇴근만 채우려고 열었다가 그대로 저장하면 지각이 「출근」으로 덮여 사라지던 문제
describe('editDefaultStatus', () => {
  it('시각으로 지각인 QR 기록은 지각으로 연다', () => {
    const row = shift('2026-10-13', { started_at: at('2026-10-13', '09:20:00') })
    expect(editDefaultStatus(row)).toBe('late')
  })

  it('제시간 출근은 저장된 상태 그대로', () => {
    const row = shift('2026-10-13', { started_at: at('2026-10-13', '08:50:00') })
    expect(editDefaultStatus(row)).toBe('present')
  })

  it('기록이 없으면 출근', () => {
    expect(editDefaultStatus(shift('2026-10-13', null))).toBe('present')
  })
})

// QA 2026-11-02 ADM-03 — 10:46 에 14:00 시작 근무 2건이 대시보드 미기록으로 잡혔다(출퇴근 기록은 「출근 전」).
describe('tallyDay', () => {
  it('예정 시각 전 근무는 미기록·결근에 넣지 않는다', () => {
    const rows = [
      shift('2026-10-14', null, '09:00:00'), // 14:00 기준 미출근
      shift('2026-10-14', null, '15:00:00'), // 출근 전
      shift('2026-10-14', null, '15:30:00'), // 출근 전
      shift('2026-10-14', { started_at: at('2026-10-14', '08:55:00') }), // 근무 중
      shift('2026-10-14', { started_at: at('2026-10-14', '08:55:00'), ended_at: at('2026-10-14', '12:00:00') }), // 정상
      shift('2026-10-14', { status: 'absent' }),
      shift('2026-10-14', { status: 'excused' }),
    ]
    expect(tallyDay(rows, NOW)).toEqual({ total: 7, done: 1, working: 1, missing: 1, absent: 1, scheduled: 2 })
  })

  it('출퇴근 기록 화면과 같은 판정이다 — 출근 전은 attendanceDisplay 의 scheduled 와 같다', () => {
    const row = shift('2026-10-14', null, '15:00:00')
    expect(attendanceDisplay(row, NOW)).toBe('scheduled')
    expect(tallyDay([row], NOW).scheduled).toBe(1)
  })

  it('확인 순서는 미출근, 결석, 지각, 나머지다', () => {
    expect(attentionRank(shift('2026-10-14', null, '09:00:00'), NOW)).toBe(0)
    expect(attentionRank(shift('2026-10-14', { status: 'absent' }), NOW)).toBe(1)
    expect(attentionRank(shift('2026-10-14', null, '15:00:00'), NOW)).toBe(3)
  })
})

// QA 2026-11-07 ADMIN-06 — 대시보드 「확인이 필요한 근무」 사업·근무지 필터
describe('filterShiftsByScope', () => {
  const rows = [
    { id: 's1', worksite_id: 'w1' },
    { id: 's2', worksite_id: 'w2' },
    { id: 's3', worksite_id: 'w3' },
  ]
  const programOf = new Map<string, string | null>([
    ['w1', 'p1'],
    ['w2', 'p1'],
    ['w3', null],
  ])
  const ids = (list: { id: string }[]) => list.map((r) => r.id)

  it('고르지 않으면 모두', () => {
    expect(ids(filterShiftsByScope(rows, { programId: '', worksiteId: '' }, programOf))).toEqual(['s1', 's2', 's3'])
  })
  it('사업은 근무지의 사업으로 거른다', () => {
    expect(ids(filterShiftsByScope(rows, { programId: 'p1', worksiteId: '' }, programOf))).toEqual(['s1', 's2'])
  })
  it('근무지를 고르면 그 근무지만 — 사업보다 좁다', () => {
    expect(ids(filterShiftsByScope(rows, { programId: 'p1', worksiteId: 'w2' }, programOf))).toEqual(['s2'])
  })
  it('사업을 모르는 근무지(목록에 없음)는 사업 필터에 걸리지 않는다', () => {
    expect(ids(filterShiftsByScope(rows, { programId: 'p1', worksiteId: '' }, new Map()))).toEqual([])
  })
})

// QA 2026-11-02 ADM-02 — 두 탭에서 같은 기록을 열고 차례로 저장하면 뒤 것이 경고 없이 덮었다.
describe('changedSince', () => {
  it('창을 연 뒤 새 이력이 생겼으면 고친 것이다', () => {
    expect(changedSince('c1', [{ id: 'c2' }, { id: 'c1' }])).toBe(true)
    // 이력이 없던 기록에 누군가 처음 기록을 남겼다
    expect(changedSince(null, [{ id: 'c1' }])).toBe(true)
  })

  it('그대로면 고친 것이 아니다', () => {
    expect(changedSince('c1', [{ id: 'c1' }])).toBe(false)
    expect(changedSince(null, [])).toBe(false)
  })

  // 목록의 이력 조회가 실패했으면 기준이 없다. 그때 비교하면 매번 충돌로 막힌다.
  it('기준을 모르면 판정하지 않는다', () => {
    expect(changedSince(undefined, [{ id: 'c9' }])).toBe(false)
  })
})

// QA 2026-11-02 ADM-02 · 서버 2026-11-04 — 저장 본문의 expectedUpdatedAt
describe('attendanceVersion', () => {
  // 서버가 밀리초까지 비교한다. Date 로 바꿨다 보내면 마이크로초가 잘려 표기가 달라진다 — 받은 그대로 보낸다
  it('목록에서 받은 updated_at 을 그대로 준다', () => {
    const stamp = '2026-10-24T00:10:00.123456+00:00'
    expect(attendanceVersion(shift('2026-10-24', { updated_at: stamp }))).toBe(stamp)
  })

  it('기록이 없던 근무는 null 이다', () => {
    expect(attendanceVersion(shift('2026-10-24', null))).toBeNull()
  })

  // null 로 보내면 서버가 「기록 없음」으로 읽어 매번 충돌로 막는다
  it('기록은 있는데 시각 칸이 없으면 싣지 않는다', () => {
    expect(attendanceVersion(shift('2026-10-24', {}))).toBeUndefined()
  })
})

describe('isAttendanceConflict', () => {
  it('409 attendance_conflict 만 동시 수정이다', () => {
    expect(isAttendanceConflict({ status: 409, data: { error: 'attendance_conflict' } })).toBe(true)
    expect(isAttendanceConflict({ statusCode: 409, data: { error: 'attendance_conflict' } })).toBe(true)
  })

  it('다른 오류는 동시 수정이 아니다', () => {
    expect(isAttendanceConflict({ status: 409, data: { error: 'duplicate' } })).toBe(false)
    expect(isAttendanceConflict({ status: 400, data: { error: 'bad_request' } })).toBe(false)
    expect(isAttendanceConflict(new Error('network'))).toBe(false)
  })
})

describe('상태 필터 선택지', () => {
  // 서버 dolbomdari-server routes.ts 의 ATTENDANCE_DISPLAY_STATES 와 같아야 한다.
  // 다르면 고른 상태를 서버가 400 으로 거부하거나, 서버가 아는 상태를 화면에서 고를 수 없다.
  it('서버가 받는 8가지 상태와 같다', () => {
    expect(ATTENDANCE_DISPLAY_OPTIONS.map((o) => o.value).sort()).toEqual(
      ['absent', 'excused', 'late', 'missing_checkout', 'normal', 'not_arrived', 'scheduled', 'working'],
    )
    expect(ATTENDANCE_DISPLAY_OPTIONS.find((o) => o.value === 'late')?.label).toBe('지각')
  })
})
