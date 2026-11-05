// 출결 조정 요청의 버튼 판정·요청 본문·표기·오류 문구 순수 유틸(QA 2026-11-02 PARTNER-01 · PARTNER-02, 서버 2026-11-04 계약 3b묶음 2번)
import type { AttendanceRequest, AttendanceRequestItem, AttendanceRequestStatus } from '../types/dbo'
import { attendanceLabel, fmtClock, fromLocalInput, toLocalInput } from './dbo'

/** 사유·처리 메모 상한. 서버 `REASON_MAX` 와 같다 */
export const REQUEST_REASON_MAX = 1000

/** 조정 요청 경로가 없는 옛 서버에서 적는 안내 */
export const REQUESTS_UNSUPPORTED = '조정 요청은 서버 업데이트 뒤에 쓸 수 있습니다.'

const status = (e: any): number | undefined => e?.status ?? e?.statusCode
const code = (e: any): string | undefined => (typeof e?.data?.error === 'string' ? e.data.error : undefined)

/**
 * 처리됐는지 모르는 실패 — 응답이 없거나, 서버 처리기가 아니라 앞단(게이트웨이)이 낸 5xx. 처리기가 내는 500 은
 * `internal`·`approve_incomplete` 다(서버 `attendanceRequests.ts`)
 */
const outcomeUnknown = (e: any): boolean => {
  const s = status(e)
  return !s || (s >= 500 && code(e) !== 'internal' && code(e) !== 'approve_incomplete')
}

/**
 * 옛 서버(경로 없음)인가 — 목록·요청 경로가 404.
 * 담당자는 다르다: 옛 서버는 경로를 찾기 전에 담당자 허용 목록(`managerMayCall`)으로 막아 403 `forbidden` 을 낸다.
 * 새 서버의 목록은 활동 중인 담당자에게 403 을 내지 않는다(범위가 비면 빈 목록).
 */
export function requestsUnsupported(e: any, role?: string): boolean {
  const s = status(e)
  return s === 404 || s === 405 || (role === 'manager' && s === 403 && code(e) === 'forbidden')
}

/**
 * 「조정 요청」 버튼을 낼지 — 수요처만, 오늘까지의 근무만(서버 400 `future_shift` 와 같은 경계).
 * 수요처는 출결을 직접 고치지 못한다(1묶음 D9, `canEditAttendance`). 그 「기록 수정」 자리에 이 버튼이 선다.
 */
export function canRequestAdjustment(role: string | undefined, workDate: string, today: string): boolean {
  return role === 'worksite' && workDate <= today
}

export const REQUEST_STATUS_LABELS: Record<AttendanceRequestStatus, string> = {
  pending: '기다림',
  approved: '확정',
  rejected: '반려',
}

export function requestStatusTone(s: AttendanceRequestStatus): 'amber' | 'green' | 'gray' {
  return s === 'pending' ? 'amber' : s === 'approved' ? 'green' : 'gray'
}

type Times = { status: string | null; started_at: string | null; ended_at: string | null }

function line(t: Times): string {
  return [
    t.status ? `상태 ${attendanceLabel(t.status)}` : null,
    t.started_at ? `출근 ${fmtClock(t.started_at)}` : null,
    t.ended_at ? `퇴근 ${fmtClock(t.ended_at)}` : null,
  ]
    .filter(Boolean)
    .join(' · ')
}

/** 출결 한 벌 — 「상태 결석 · 출근 09:00 · 퇴근 18:00」. 기록이 없으면 「기록 없음」 */
export function attendanceLine(rec: Times | null): string {
  return (rec && line(rec)) || '기록 없음'
}

/** 바란 칸만 — 「상태 출근 · 출근 09:00」. 보내지 않은 칸은 그대로 두길 바란 것이다 */
export function requestedLine(
  r: Pick<AttendanceRequest, 'requested_status' | 'requested_started_at' | 'requested_ended_at'>,
): string {
  return line({ status: r.requested_status, started_at: r.requested_started_at, ended_at: r.requested_ended_at }) || '—'
}

/** 조정 요청 창의 칸. 시각은 <input type="datetime-local"> 값, 상태 빈 값은 「그대로」(기록이 없으면 「고르지 않음」) */
export type AdjustmentForm = {
  status: string
  startedAt: string | null
  endedAt: string | null
  reason: string
}

/** 창을 열 때의 값 — 시각은 지금 기록으로 채우고 상태·사유는 비운다 */
export function adjustmentInitial(rec: { started_at: string | null; ended_at: string | null } | null): AdjustmentForm {
  return { status: '', startedAt: toLocalInput(rec?.started_at), endedAt: toLocalInput(rec?.ended_at), reason: '' }
}

export interface AdjustmentBody {
  status?: string
  startedAt?: string
  endedAt?: string
  reason: string
}
export type AdjustmentErrors = { status?: string; startedAt?: string; endedAt?: string; reason?: string; form?: string }

const CANNOT_CLEAR = '시각은 지울 수 없습니다. 지워야 하면 사유에 적어 주세요.'

/**
 * 요청 본문 — **바꾼 칸만** 싣는다. 서버는 보내지 않은 칸을 「그대로」로 본다. 시각을 지우는 요청은 서버에 없다 —
 * 있던 시각을 비우면 막는다(말없이 빼면 요청한 사람은 지워 달라고 했다고 믿는다).
 * 서버 판정(`decideRequestCreate`)과 같은 것을 먼저 본다 — 기록 없는 근무의 상태 · 퇴근이 출근보다 이름(지금 값과 합쳐) · 바뀐 것 없음.
 *
 * @param current 지금 출결. 기록이 없으면 null
 * @param initial 창을 열 때의 값(`adjustmentInitial`)
 */
export function buildAdjustmentRequest(
  current: Times | null,
  initial: AdjustmentForm,
  form: AdjustmentForm,
): { ok: true; body: AdjustmentBody } | { ok: false; errors: AdjustmentErrors } {
  const errors: AdjustmentErrors = {}
  const reason = form.reason.trim()
  if (!reason) errors.reason = '사유를 입력해 주세요.'
  else if (reason.length > REQUEST_REASON_MAX) errors.reason = `사유는 ${REQUEST_REASON_MAX}자까지 적을 수 있습니다.`

  const body: AdjustmentBody = { reason }
  if (form.status && form.status !== current?.status) body.status = form.status
  else if (!current) errors.status = '기록이 없는 근무라 상태를 골라 주세요.'
  if (initial.startedAt && !form.startedAt) errors.startedAt = CANNOT_CLEAR
  if (initial.endedAt && !form.endedAt) errors.endedAt = CANNOT_CLEAR
  const startedAt = form.startedAt !== initial.startedAt ? fromLocalInput(form.startedAt) : null
  const endedAt = form.endedAt !== initial.endedAt ? fromLocalInput(form.endedAt) : null
  if (startedAt) body.startedAt = startedAt
  if (endedAt) body.endedAt = endedAt

  const start = startedAt ?? current?.started_at ?? null
  const end = endedAt ?? current?.ended_at ?? null
  if (!errors.endedAt && start && end && Date.parse(end) <= Date.parse(start)) {
    errors.endedAt = '퇴근 시각은 출근 시각보다 늦어야 합니다.'
  }
  if (!errors.status && !errors.startedAt && !errors.endedAt && !body.status && !body.startedAt && !body.endedAt) {
    errors.form = '지금 기록과 같습니다. 바꿀 칸을 고쳐 주세요.'
  }
  return Object.keys(errors).length ? { ok: false, errors } : { ok: true, body }
}

/**
 * 조정 요청(`POST /attendance/{shiftId}/requests`) 실패 문구.
 *
 * 404 는 둘 중 하나다 — 옛 서버(경로 없음)이거나, 새 서버에서 근무가 없다. 같은 화면에서 「내 요청」 목록이 읽혔으면
 * (`routeKnown`) 새 서버라 근무가 없는 것이다.
 */
export function adjustmentRequestErrorMessage(e: any, routeKnown: boolean): string {
  const c = code(e)
  const s = status(e)
  if (c === 'future_shift') return '지난 근무만 조정을 요청할 수 있습니다.'
  if (c === 'status_required') return '기록이 없는 근무라 상태를 골라 주세요.'
  if (c === 'bad_times') return '퇴근 시각은 출근 시각보다 늦어야 합니다.'
  if (c === 'no_change') return '지금 기록과 같습니다. 바꿀 칸을 고쳐 주세요.'
  if (c === 'request_pending') return '처리를 기다리는 요청이 이미 있습니다. 담당자가 처리한 뒤 다시 요청해 주세요.'
  if (s === 404 || s === 405) return routeKnown ? '근무를 찾을 수 없습니다. 목록을 새로고침해 주세요.' : REQUESTS_UNSUPPORTED
  if (s === 400) return '입력값을 확인해 주세요. 사유는 1000자까지 적을 수 있습니다.'
  if (s === 401) return '로그인이 만료되었습니다. 다시 로그인해 주세요.'
  if (s === 403) return '이 근무에 조정을 요청할 권한이 없습니다.'
  if (outcomeUnknown(e)) return '응답을 확인하지 못했습니다. 「내 요청」에서 요청이 들어갔는지 확인해 주세요.'
  return '조정 요청을 보내지 못했습니다. 잠시 뒤 다시 시도해 주세요.'
}

/** 조정 요청 목록을 못 읽었을 때 — 옛 서버는 따로 안내한다(`requestsUnsupported`) */
export function requestListErrorMessage(e: any): string {
  if (code(e) === 'worksite_unassigned') return '담당 근무지가 없는 계정입니다. 운영관리자에게 근무지 지정을 요청해 주세요.'
  const s = status(e)
  if (s === 401) return '로그인이 만료되었습니다. 다시 로그인해 주세요.'
  if (s === 403) return '조정 요청을 볼 권한이 없습니다.'
  return '조정 요청을 불러오지 못했습니다. 잠시 뒤 다시 시도해 주세요.'
}

/**
 * 확정을 막을 까닭 — 서버가 409 로 거절할 것이 목록에서 보이면 미리 막는다(반려는 된다). 막지 않으면 null.
 * 근무가 다른 근무지로 옮겨진 것(`shift_moved`)은 목록에 없어 서버만 안다.
 */
export function approveBlock(item: Pick<AttendanceRequestItem, 'status' | 'shift_id' | 'stale'>): string | null {
  if (item.status !== 'pending') return null
  if (!item.shift_id) return '근무가 지워진 요청이라 반려만 할 수 있습니다.'
  if (item.stale) return '요청 뒤 기록이 바뀌었습니다. 지금 기록을 보고 반려하거나 다시 요청받아 주세요.'
  return null
}

/** 확정·반려(`POST /attendance-requests/{id}/approve|reject`) 실패 문구. 목록을 읽은 뒤라 404 는 요청이 없는 것이다 */
export function requestDecisionErrorMessage(e: any, action: 'approve' | 'reject'): string {
  const c = code(e)
  const s = status(e)
  if (c === 'request_decided') return '이미 처리된 요청입니다.'
  if (c === 'shift_gone') return '근무가 지워진 요청이라 반려만 할 수 있습니다.'
  if (c === 'shift_moved') return '요청 뒤 근무지가 바뀐 근무라 반려만 할 수 있습니다. 새 근무지에서 다시 요청받아 주세요.'
  if (c === 'request_stale') return '다른 곳에서 기록이 바뀌었습니다. 지금 기록을 보고 다시 처리해 주세요.'
  if (c === 'approve_incomplete') {
    return '확정이 끝나지 않았습니다. 요청은 「확정」으로 남았고 출결은 그대로입니다. 출결 수정으로 바로잡아 주세요.'
  }
  if (s === 404 || s === 405) return '요청을 찾을 수 없습니다.'
  if (s === 400) return `메모는 ${REQUEST_REASON_MAX}자까지 적을 수 있습니다.`
  if (s === 401) return '로그인이 만료되었습니다. 다시 로그인해 주세요.'
  if (s === 403) return '이 요청을 처리할 권한이 없습니다. 맡은 근무지의 요청만 처리할 수 있습니다.'
  // 확정의 500 internal 은 출결을 못 써 요청을 「기다림」으로 되돌린 것이다
  if (c === 'internal' && action === 'approve') {
    return '출결을 쓰지 못했습니다. 요청은 「기다림」으로 돌아갔으니 잠시 뒤 다시 확정해 주세요.'
  }
  if (outcomeUnknown(e)) return '응답을 확인하지 못했습니다. 다시 불러온 목록에서 처리됐는지 확인해 주세요.'
  return action === 'approve' ? '확정하지 못했습니다. 잠시 뒤 다시 시도해 주세요.' : '반려하지 못했습니다. 잠시 뒤 다시 시도해 주세요.'
}

/** 메뉴의 기다림 수 — 없거나 0 이면 숨긴다(null). 100 이상은 「99+」 */
export function pendingBadge(total: number | null): string | null {
  if (!total || total <= 0) return null
  return total > 99 ? '99+' : String(total)
}
