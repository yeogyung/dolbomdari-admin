// 명부에서 여러 명을 골라 같은 근무를 배정·삭제하는 규칙 — 대상 고르기, 입력 검사, 실패 문구(QA 2026-11-07 SHIFT-02 · SHIFT-09, 결정 D25)
import type { Assignment, DirectoryEntry } from '~/types/dbo'
import { assignmentPeriodErrors, assignmentSaveError, fmtPhone } from './dbo'

type Person = Pick<DirectoryEntry, 'id' | 'name' | 'phone' | 'role' | 'status'>

/** 결과·확인 창의 사람 이름 — 동명이인을 가르려고 번호를 붙인다 */
export function personLine(p: Pick<DirectoryEntry, 'name' | 'phone'>): string {
  return p.phone ? `${p.name} (${fmtPhone(p.phone)})` : p.name
}

/**
 * 배정할 사람과 빼는 사람. 배정은 시니어에게만 근무지를 잇는다(명부 상세와 같다). 종료된 사람은 근무가 생기지 않아 뺀다
 */
export function bulkAssignTargets<T extends Person>(people: T[]): { targets: T[]; skipped: { row: T; reason: string }[] } {
  const out: { targets: T[]; skipped: { row: T; reason: string }[] } = { targets: [], skipped: [] }
  for (const p of people) {
    if (p.role !== 'senior') out.skipped.push({ row: p, reason: '시니어가 아니라 배정하지 않습니다.' })
    else if (p.status !== 'active') out.skipped.push({ row: p, reason: '종료된 사람이라 배정하지 않습니다.' })
    else out.targets.push(p)
  }
  return out
}

export type BulkAssignForm = {
  worksiteId: string | null
  weekdays: number[]
  startTime: string
  endTime: string
  periodStart: string | null
  periodEnd: string | null
}

/**
 * 저장 전 검사 — 칸마다 문구(빈 객체면 통과). 기간 규칙은 명부 상세의 배정과 같다(`assignmentPeriodErrors`).
 * 종료 시간이 시작 시간보다 늦어야 한다 — 서버도 자정을 넘는 배정을 다루지 않고(겹침 판정이 하루 안의 초로 본다), 일괄이면
 * 잘못된 배정과 알림이 사람 수만큼 한 번에 생긴다(리뷰 반영)
 */
export function bulkAssignFormErrors(f: BulkAssignForm): {
  worksite?: string
  weekdays?: string
  time?: string
  start?: string
  end?: string
} {
  return {
    ...(f.worksiteId ? {} : { worksite: '근무지를 선택해 주세요.' }),
    ...(f.weekdays.length ? {} : { weekdays: '근무 요일을 하나 이상 선택해 주세요.' }),
    ...(!f.startTime || !f.endTime
      ? { time: '시작·종료 시간을 입력해 주세요.' }
      : f.endTime <= f.startTime
        ? { time: '종료 시간은 시작 시간보다 늦어야 합니다.' }
        : {}),
    ...assignmentPeriodErrors(f.periodStart, f.periodEnd),
  }
}

/** 배정은 저장됐는데 오늘·내일 근무 정리만 실패했다(500 `shift_sync_failed`) — 실패가 아니라 따로 알린다 */
export function isShiftSyncFailed(e: any): boolean {
  return e?.data?.error === 'shift_sync_failed'
}

/**
 * 한 사람 배정이 실패한 까닭. 겹친 배정(409 `assignment_overlap`)은 겹친 배정까지 한 줄에 적는다.
 * 모르는 오류면 null — 호출부가 공용 문구(dboErrorMessage)로 넘긴다
 */
export function bulkAssignErrorMessage(e: any): string | null {
  const known = assignmentSaveError(e)
  if (known) return known.conflicts.length ? `${known.message} (${known.conflicts.join(' / ')})` : known.message
  if (e?.data?.error === 'bad_reference') return '근무지나 사람을 찾을 수 없습니다. 목록을 새로 고쳐 주세요.'
  return null
}

/** 배정 일괄 삭제의 근무지 선택지 — 고른 사람들의 배정이 있는 근무지만, 배정 수와 함께 이름순 */
export function assignmentWorksiteOptions(
  assignments: Pick<Assignment, 'worksite_id'>[],
  nameOf: (worksiteId: string) => string,
): { label: string; value: string }[] {
  const counts = new Map<string, number>()
  for (const a of assignments) counts.set(a.worksite_id, (counts.get(a.worksite_id) ?? 0) + 1)
  return [...counts]
    .map(([id, n]) => ({ name: nameOf(id), id, n }))
    .sort((a, b) => a.name.localeCompare(b.name, 'ko'))
    .map(({ name, id, n }) => ({ label: `${name} (${n}건)`, value: id }))
}

/** 배정 삭제 한 건이 실패한 까닭. 서버는 근무 정리를 먼저 하고 실패하면 배정을 지우지 않는다. 모르는 오류면 null */
export function bulkUnassignErrorMessage(e: any): string | null {
  if (isShiftSyncFailed(e)) return '근무 정리에 실패해 이 배정은 지우지 않았습니다. 잠시 뒤 다시 해 주세요.'
  if (e?.data?.error === 'not_found') return '이미 지워진 배정입니다.'
  return null
}
