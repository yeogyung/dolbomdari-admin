// 근무지 상세의 근무자 표 — 배정 한 건이 한 줄이고 이름·상태는 명부에서 붙인다
import type { Assignment, DirectoryEntry, LifeStatus } from '~/types/dbo'

export type RosterRow = {
  assignment: Assignment
  name: string
  /** 명부 상태. 명부에서 못 찾으면 null */
  status: LifeStatus | null
}

/**
 * 이름순, 같은 사람이면 시작 시각순. 명부에서 못 찾은 배정도 **줄을 지우지 않는다** —
 * 배정이 남아 있다는 사실이 운영자에게 필요한 정보다.
 */
export function worksiteRoster(assignments: Assignment[], people: DirectoryEntry[]): RosterRow[] {
  const byId = new Map(people.map((p) => [p.id, p]))
  return assignments
    .map((assignment) => {
      const person = byId.get(assignment.directory_id)
      return { assignment, name: person?.name ?? '(명부에 없음)', status: person?.status ?? null }
    })
    .sort(
      (x, y) =>
        x.name.localeCompare(y.name, 'ko') ||
        x.assignment.start_time.localeCompare(y.assignment.start_time),
    )
}
