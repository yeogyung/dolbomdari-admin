// 담당자 명부(읽기 전용) — 맡은 근무지에 배정된 시니어 줄 만들기·거르기. 근무지 칸은 서버 명부 목록과 같은 「지금 유효한 배정」 기준
import type { Assignment, LifeStatus, Worksite } from '~/types/dbo'
import { nameIncludes } from './nameSearch'

/** RLS(`dbo_can_read_directory`)로 읽은 명부 한 사람 */
export type ManagerPerson = { id: string; name: string; phone: string | null; status: LifeStatus }
export type ManagerWorkerRow = ManagerPerson & { worksites: { id: string; name: string }[] }
export type ManagerWorkerFilter = { q: string; worksiteId: string; status: '' | LifeStatus }

/** 서버 `isCurrentAssignment`(worksiteHeadcount.ts)와 같다 — 시작 전·끝난 배정은 지금 근무지가 아니다 */
export function isCurrentAssignment(a: Pick<Assignment, 'period_start' | 'period_end'>, today: string): boolean {
  return (!a.period_start || a.period_start <= today) && (!a.period_end || a.period_end >= today)
}

/**
 * 사람마다 지금 유효한 배정의 근무지를 붙인다. 배정·근무지는 서버가 맡은 근무지로 좁혀 준 목록이라,
 * 근무지 목록에 없는 배정(맡지 않은 곳)은 칸에 넣지 않는다. 이름순, 근무지도 이름순.
 */
export function managerWorkerRows(
  people: ManagerPerson[],
  assignments: Assignment[],
  worksites: Pick<Worksite, 'id' | 'name'>[],
  today: string,
): ManagerWorkerRow[] {
  const siteName = new Map(worksites.map((w) => [w.id, w.name]))
  const sitesOf = new Map<string, Set<string>>()
  for (const a of assignments) {
    if (!siteName.has(a.worksite_id) || !isCurrentAssignment(a, today)) continue
    const set = sitesOf.get(a.directory_id) ?? new Set<string>()
    set.add(a.worksite_id)
    sitesOf.set(a.directory_id, set)
  }
  const byName = (x: { name: string }, y: { name: string }) => x.name.localeCompare(y.name, 'ko')
  return people
    .map((p) => ({
      ...p,
      worksites: [...(sitesOf.get(p.id) ?? [])].map((id) => ({ id, name: siteName.get(id)! })).sort(byName),
    }))
    .sort(byName)
}

/** 이름(띄어쓰기 무시) 또는 전화번호(숫자만)·근무지·상태로 거른다. 빈 조건은 거르지 않는다 */
export function filterManagerWorkers(rows: ManagerWorkerRow[], f: ManagerWorkerFilter): ManagerWorkerRow[] {
  const digits = f.q.replace(/\D/g, '')
  return rows.filter(
    (r) =>
      (nameIncludes(r.name, f.q) || (!!digits && (r.phone ?? '').includes(digits))) &&
      (!f.worksiteId || r.worksites.some((w) => w.id === f.worksiteId)) &&
      (!f.status || r.status === f.status),
  )
}
