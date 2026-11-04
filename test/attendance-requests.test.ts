// 출결 조정 요청 유틸 테스트 — 버튼 판정, 바꾼 칸만 싣는 요청 본문, 표기, 확정 막음, 오류 문구, 메뉴 기다림 수
import { describe, it, expect } from 'vitest'
import {
  adjustmentInitial,
  adjustmentRequestErrorMessage,
  approveBlock,
  attendanceLine,
  buildAdjustmentRequest,
  canRequestAdjustment,
  pendingBadge,
  requestDecisionErrorMessage,
  requestedLine,
  requestListErrorMessage,
  requestsUnsupported,
  REQUESTS_UNSUPPORTED,
} from '../app/utils/attendanceRequests'
import { canEditAttendance, fromLocalInput } from '../app/utils/dbo'

const err = (status: number, data?: Record<string, unknown>) => ({ status, data })

// QA 2026-11-02 PARTNER-01 — 수요처는 고치지 못하고(D9) 그 자리에서 조정을 요청한다
describe('조정 요청 버튼', () => {
  const today = '2026-11-05'
  it('수요처에게만, 오늘까지의 근무에만 낸다(서버 future_shift 경계)', () => {
    expect(canRequestAdjustment('worksite', '2026-11-04', today)).toBe(true)
    expect(canRequestAdjustment('worksite', today, today)).toBe(true)
    expect(canRequestAdjustment('worksite', '2026-11-06', today)).toBe(false)
  })
  it('master·담당자는 직접 고치므로 내지 않는다', () => {
    for (const role of ['master', 'manager', undefined]) expect(canRequestAdjustment(role, '2026-11-04', today)).toBe(false)
  })
  it('기록 수정과 조정 요청이 한 줄에 함께 나오지 않는다', () => {
    for (const role of ['master', 'manager', 'worksite']) {
      expect(canEditAttendance(role, '2026-11-04', today) && canRequestAdjustment(role, '2026-11-04', today)).toBe(false)
    }
  })
})

describe('조정 요청 본문', () => {
  const rec = { status: 'absent', started_at: null, ended_at: null }
  const withTimes = { status: 'present', started_at: '2026-11-03T00:00:00.000Z', ended_at: '2026-11-03T03:00:00.000Z' }

  it('바꾼 칸만 싣는다 — 그대로인 시각·상태는 보내지 않는다', () => {
    const initial = adjustmentInitial(withTimes)
    const form = { ...initial, endedAt: '2026-11-03T13:30', reason: ' 퇴근 QR 누락 ' }
    expect(buildAdjustmentRequest(withTimes, initial, form)).toEqual({
      ok: true,
      body: { endedAt: fromLocalInput('2026-11-03T13:30'), reason: '퇴근 QR 누락' },
    })
  })
  it('지금과 같은 상태를 골라도 바꾼 것이 아니다', () => {
    const initial = adjustmentInitial(rec)
    const r = buildAdjustmentRequest(rec, initial, { ...initial, status: 'absent', reason: '사유' })
    expect(r).toEqual({ ok: false, errors: { form: '지금 기록과 같습니다. 바꿀 칸을 고쳐 주세요.' } })
  })
  it('상태를 바꾸면 상태만 싣는다', () => {
    const initial = adjustmentInitial(rec)
    expect(buildAdjustmentRequest(rec, initial, { ...initial, status: 'present', reason: '출석함' })).toEqual({
      ok: true,
      body: { status: 'present', reason: '출석함' },
    })
  })
  it('기록이 없는 근무는 상태를 골라야 한다(서버 status_required)', () => {
    const initial = adjustmentInitial(null)
    const r = buildAdjustmentRequest(null, initial, { ...initial, startedAt: '2026-11-03T09:00', reason: '사유' })
    expect(r).toEqual({ ok: false, errors: { status: '기록이 없는 근무라 상태를 골라 주세요.' } })
  })
  it('퇴근이 출근보다 이르면 막는다 — 지금 값과 합쳐 본다(서버 bad_times)', () => {
    const initial = adjustmentInitial(withTimes)
    // 출근만 퇴근(지금 값)보다 늦게 바꾼다
    const r = buildAdjustmentRequest(withTimes, initial, {
      ...initial,
      startedAt: toLocal('2026-11-03T04:00:00.000Z'),
      reason: '사유',
    })
    expect(r).toEqual({ ok: false, errors: { endedAt: '퇴근 시각은 출근 시각보다 늦어야 합니다.' } })
  })
  it('사유는 필수이고 1000자까지다', () => {
    const initial = adjustmentInitial(rec)
    expect(buildAdjustmentRequest(rec, initial, { ...initial, status: 'present', reason: '  ' })).toEqual({
      ok: false,
      errors: { reason: '사유를 입력해 주세요.' },
    })
    const long = buildAdjustmentRequest(rec, initial, { ...initial, status: 'present', reason: 'a'.repeat(1001) })
    expect(long.ok).toBe(false)
  })
  it('시각을 비워도 지우는 요청이 아니라 그대로다', () => {
    const initial = adjustmentInitial(withTimes)
    const r = buildAdjustmentRequest(withTimes, initial, { ...initial, endedAt: null, reason: '사유' })
    expect(r).toEqual({ ok: false, errors: { form: '지금 기록과 같습니다. 바꿀 칸을 고쳐 주세요.' } })
  })
})

function toLocal(iso: string): string {
  const d = new Date(iso)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

describe('조정 요청 표기', () => {
  it('기록 한 벌을 한 줄로 — 시각은 서울 시각', () => {
    expect(attendanceLine({ status: 'present', started_at: '2026-11-03T00:00:00Z', ended_at: '2026-11-03T03:00:00Z' })).toBe(
      '상태 출근 · 출근 09:00 · 퇴근 12:00',
    )
    expect(attendanceLine(null)).toBe('기록 없음')
    expect(attendanceLine({ status: null, started_at: null, ended_at: null })).toBe('기록 없음')
  })
  it('바란 칸만 적는다', () => {
    expect(requestedLine({ requested_status: 'present', requested_started_at: '2026-11-03T00:00:00Z', requested_ended_at: null })).toBe(
      '상태 출근 · 출근 09:00',
    )
    expect(requestedLine({ requested_status: null, requested_started_at: null, requested_ended_at: null })).toBe('—')
  })
})

// QA 2026-11-02 PARTNER-02 — 서버가 409 로 거절할 것이 보이면 확정을 미리 막는다(반려는 된다)
describe('확정 막음', () => {
  it('근무가 지워졌거나 요청 뒤 기록이 바뀌면 막는다', () => {
    expect(approveBlock({ status: 'pending', shift_id: null, stale: false })).toContain('반려만')
    expect(approveBlock({ status: 'pending', shift_id: 's', stale: true })).toContain('기록이 바뀌었습니다')
    expect(approveBlock({ status: 'pending', shift_id: 's', stale: false })).toBeNull()
  })
  it('처리된 요청은 버튼이 없어 막을 것도 없다', () => {
    expect(approveBlock({ status: 'approved', shift_id: null, stale: false })).toBeNull()
  })
})

describe('조정 요청 오류 문구', () => {
  it('계약 표의 요청 오류', () => {
    expect(adjustmentRequestErrorMessage(err(400, { error: 'future_shift' }), true)).toBe('지난 근무만 조정을 요청할 수 있습니다.')
    expect(adjustmentRequestErrorMessage(err(400, { error: 'status_required' }), true)).toContain('상태를 골라')
    expect(adjustmentRequestErrorMessage(err(400, { error: 'bad_times' }), true)).toContain('퇴근 시각')
    expect(adjustmentRequestErrorMessage(err(400, { error: 'no_change' }), true)).toContain('지금 기록과 같습니다')
    expect(adjustmentRequestErrorMessage(err(409, { error: 'request_pending' }), true)).toContain('처리를 기다리는 요청')
    expect(adjustmentRequestErrorMessage(err(403, { error: 'forbidden' }), true)).toContain('권한이 없습니다')
  })
  // 옛 서버(지금 운영)는 경로가 없어 404. 목록이 읽힌 새 서버에서 404 는 근무가 없는 것이다
  it('404 는 목록이 읽혔는지로 가른다', () => {
    expect(adjustmentRequestErrorMessage(err(404, { error: 'not_found' }), false)).toBe(REQUESTS_UNSUPPORTED)
    expect(adjustmentRequestErrorMessage(err(404, { error: 'not_found' }), true)).toContain('근무를 찾을 수 없습니다')
  })
  it('응답을 못 받았으면 들어갔는지 확인하라고 적는다', () => {
    expect(adjustmentRequestErrorMessage(new Error('fetch failed'), true)).toContain('「내 요청」에서')
  })
  it('목록 오류', () => {
    expect(requestsUnsupported(err(404))).toBe(true)
    expect(requestsUnsupported(err(500))).toBe(false)
    expect(requestListErrorMessage(err(403, { error: 'worksite_unassigned' }))).toContain('담당 근무지가 없는 계정')
  })

  it('확정·반려의 409·500', () => {
    expect(requestDecisionErrorMessage(err(409, { error: 'request_decided' }), 'approve')).toBe('이미 처리된 요청입니다.')
    expect(requestDecisionErrorMessage(err(409, { error: 'shift_gone' }), 'approve')).toContain('반려만')
    expect(requestDecisionErrorMessage(err(409, { error: 'shift_moved' }), 'approve')).toContain('근무지가 바뀐')
    expect(requestDecisionErrorMessage(err(409, { error: 'request_stale' }), 'approve')).toBe(
      '다른 곳에서 기록이 바뀌었습니다. 지금 기록을 보고 다시 처리해 주세요.',
    )
    expect(requestDecisionErrorMessage(err(500, { error: 'approve_incomplete', requestId: 'r' }), 'approve')).toContain(
      '출결 수정으로 바로잡아',
    )
    expect(requestDecisionErrorMessage(err(500, { error: 'internal' }), 'approve')).toContain('「기다림」으로 돌아갔으니')
    expect(requestDecisionErrorMessage(err(500, { error: 'internal' }), 'reject')).toBe('반려하지 못했습니다. 잠시 뒤 다시 시도해 주세요.')
    expect(requestDecisionErrorMessage(err(403, { error: 'forbidden' }), 'reject')).toContain('맡은 근무지')
    expect(requestDecisionErrorMessage(err(502), 'approve')).toContain('처리됐는지 확인')
  })
})

describe('메뉴 기다림 수', () => {
  it('0·모름은 숨기고 100 이상은 줄인다', () => {
    expect(pendingBadge(null)).toBeNull()
    expect(pendingBadge(0)).toBeNull()
    expect(pendingBadge(3)).toBe('3')
    expect(pendingBadge(120)).toBe('99+')
  })
})
