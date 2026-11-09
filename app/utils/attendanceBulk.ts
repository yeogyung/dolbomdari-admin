// 출퇴근 기록 일괄 상태 변경·선택 삭제 규칙 — 고를 수 있는 기록과 빼는 까닭, 실패 문구(QA 2026-11-07 ADMIN-05 · ADMIN-15)
import type { AttendanceShift } from '~/types/dbo'
import type { NavRole } from '#shared/nav'
import { canEditAttendance } from './dbo'
import { canDeleteAttendance, deleteErrorMessage } from './attendanceDelete'
import { isAttendanceConflict } from './attendanceState'

type Row = Pick<AttendanceShift, 'id' | 'work_date' | 'attendance'>

export type BulkSplit<T> = { targets: T[]; skipped: { row: T; reason: string }[] }

/** 행 선택 체크박스를 둘 역할 — 출결을 고치거나 지울 수 있는 운영관리자·담당자. 수요처는 조정 요청만 한다 */
export function canSelectAttendance(role: string | undefined): boolean {
  return role === 'master' || role === 'manager'
}

/**
 * 일괄 상태 변경에 넣을 기록과 빼는 기록. 건별 「기록 수정」과 같은 경계(`canEditAttendance`) — 앞으로 할 근무는 못 고친다.
 * 기록이 없는 근무(미출근 등)는 넣는다 — 결석·인정 결석으로 한꺼번에 적는 데 쓴다
 */
export function bulkEditTargets<T extends Row>(rows: T[], role: string | undefined, today: string): BulkSplit<T> {
  const out: BulkSplit<T> = { targets: [], skipped: [] }
  for (const row of rows) {
    if (canEditAttendance(role, row.work_date, today)) out.targets.push(row)
    else
      out.skipped.push({
        row,
        reason: role === 'worksite' ? '수요처 계정은 고칠 수 없습니다.' : '앞으로 할 근무는 고칠 수 없습니다.',
      })
  }
  return out
}

/**
 * 선택 삭제에 넣을 기록과 빼는 기록. 건별 삭제와 같은 경계(`canDeleteAttendance`) — master 는 날짜 제한 없이, 담당자는
 * 오늘 기록만 지운다(결정 D24, 서버·DB `not_today`).
 */
export function bulkDeleteTargets<T extends Row>(
  rows: T[],
  role: NavRole | undefined,
  today: string,
): BulkSplit<T> {
  const out: BulkSplit<T> = { targets: [], skipped: [] }
  for (const row of rows) {
    if (canDeleteAttendance(role, row, today)) out.targets.push(row)
    else if (role !== 'master' && role !== 'manager') out.skipped.push({ row, reason: '삭제할 권한이 없습니다.' })
    else if (!row.attendance) out.skipped.push({ row, reason: '지울 출결 기록이 없는 근무입니다.' })
    else out.skipped.push({ row, reason: '오늘 기록만 지울 수 있습니다.' })
  }
  return out
}

/**
 * 일괄 상태 변경 한 건이 실패한 까닭. 모르는 오류면 null — 호출부가 공용 문구(dboErrorMessage)로 넘긴다.
 * 동시 수정(409)은 덮어쓰지 않고 실패로 둔다 — 그 기록은 목록을 새로 고친 뒤 건별로 확인한다
 */
export function bulkEditErrorMessage(e: any): string | null {
  if (isAttendanceConflict(e)) return '다른 곳에서 먼저 고친 기록이라 바꾸지 않았습니다.'
  const code: string | undefined = e?.data?.error
  if (code === 'not_found') return '근무를 찾을 수 없습니다.'
  if (code === 'forbidden') return '이 기록을 고칠 권한이 없습니다.'
  return null
}

/** 선택 삭제 한 건이 실패한 까닭. 건별 삭제와 같은 문구, 모르는 오류면 null */
export function bulkDeleteErrorMessage(e: any): string | null {
  return deleteErrorMessage(e)
}

/** 결과·확인 창의 한 줄 이름 — 「홍길동 · 2026-11-07 · 서대문점」 */
export function attendanceRowName(row: Pick<AttendanceShift, 'work_date' | 'directory' | 'worksite'>): string {
  return `${row.directory?.name ?? '—'} · ${row.work_date} · ${row.worksite?.name ?? '—'}`
}
