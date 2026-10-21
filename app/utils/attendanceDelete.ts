// 출결 삭제 화면 규칙 — 사유 필수, 버튼 노출(역할·기록 유무·당일), 서버 오류 문구
import type { AttendanceShift } from '~/types/dbo'
import type { NavRole } from '#shared/nav'
import { attendanceOf } from './dbo'

/** 사유 상한. 바꿀 수 없는 기록이라 서버·DB 도 같은 값으로 막는다 */
export const DELETE_REASON_MAX = 1000

/** 사유가 비거나 너무 길면 문구, 아니면 null. 서버(reason_required·reason_too_long)와 같은 규칙이다 */
export function deleteReasonError(reason: string): string | null {
  const trimmed = reason.trim()
  if (!trimmed) return '삭제 사유를 입력해 주세요.'
  if (trimmed.length > DELETE_REASON_MAX) return `삭제 사유는 ${DELETE_REASON_MAX}자까지 쓸 수 있습니다.`
  return null
}

/**
 * 삭제 버튼을 보일지. master·담당자이고, 기록이 있고, 오늘 활동일 때만.
 *
 * 화면을 거르는 용도다. 담당자가 맡은 수요처인지는 목록이 이미 그 범위만 주고,
 * 최종 판정은 서버(`decideAttendanceDelete`)가 한다.
 */
export function canDeleteAttendance(
  role: NavRole | undefined,
  row: Pick<AttendanceShift, 'work_date' | 'attendance'>,
  today: string,
): boolean {
  if (role !== 'master' && role !== 'manager') return false
  return attendanceOf(row) !== null && row.work_date === today
}

/** 삭제 기록 목록의 검색이 너무 넓을 때(query_too_broad) */
export const QUERY_TOO_BROAD = '검색어에 맞는 사람이 너무 많습니다. 이름을 더 자세히 입력해 주세요.'

const DELETE_ERRORS: Record<string, string> = {
  not_today: '오늘 활동의 출결만 삭제할 수 있습니다.',
  forbidden: '이 출결을 삭제할 권한이 없습니다.',
  not_found: '활동을 찾을 수 없습니다. 목록을 새로 고쳐 주세요.',
  attendance_not_found: '이미 삭제됐거나 기록이 없는 출결입니다. 목록을 새로 고쳐 주세요.',
  actor_not_found: '계정 정보를 찾을 수 없습니다. 다시 로그인해 주세요.',
  reason_required: '삭제 사유를 입력해 주세요.',
  reason_too_long: `삭제 사유는 ${DELETE_REASON_MAX}자까지 쓸 수 있습니다.`,
}

/**
 * 삭제 실패 문구. 모르는 오류면 null — 호출부가 공용 dboErrorMessage 로 넘긴다.
 * 공용 문구의 403 은 「master 로 로그인」이라 담당자에게 틀린 말이어서 따로 둔다.
 */
export function deleteErrorMessage(e: any): string | null {
  const code: string | undefined = e?.data?.error
  return (code && DELETE_ERRORS[code]) || null
}
