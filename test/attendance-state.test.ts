// 출퇴근 표시 상태·「수정됨」 판정·이력 문구 테스트(QA 2026-10-14 11·12·13번)
import { describe, expect, it } from 'vitest'
import {
  attendanceDisplay,
  describeChange,
  groupChangesByShift,
  isHumanEdited,
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
