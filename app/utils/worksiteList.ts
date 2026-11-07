// 근무지 목록 화면의 거르기·정렬 — 근무지를 전부 받아 화면에서 한다(QA 2026-11-07 ADMIN-07)
import type { LifeStatus, Worksite } from '../types/dbo'
import type { SortDir } from './sortToggle'

type Row = Pick<
  Worksite,
  'name' | 'program_id' | 'status' | 'manager_directory_id' | 'care_manager_directory_id' | 'senior_count'
>

export type WorksiteListFilter = {
  /** 근무지 이름 검색어. 서버 검색(`ilike name`)과 같이 이름에 들어 있으면 찾는다 */
  q: string
  /** 사업 id. '' 은 전체 */
  program: string
  /** 'none' — 근무지 담당자(사회복지사, `care_manager_directory_id`)를 지정하지 않은 곳만 */
  care: string
  /** 'none' — 수요처 담당자(수요처 계정, `manager_directory_id`)를 지정하지 않은 곳만 */
  contact: string
  /** '0' — 배정 인원 0명인 곳만. 서버가 인원을 세지 못한 곳(`senior_count` 없음)은 0명으로 단정하지 않고 뺀다 */
  seniors: string
  /** 상태. '' 은 전체 */
  status: '' | LifeStatus | string
}

export function filterWorksiteList<T extends Row>(rows: T[], f: WorksiteListFilter): T[] {
  const needle = f.q.trim().toLowerCase()
  return rows.filter(
    (w) =>
      (!needle || w.name.toLowerCase().includes(needle)) &&
      (!f.program || w.program_id === f.program) &&
      (f.care !== 'none' || !w.care_manager_directory_id) &&
      (f.contact !== 'none' || !w.manager_directory_id) &&
      (f.seniors !== '0' || w.senior_count === 0) &&
      (!f.status || w.status === f.status),
  )
}

/**
 * 이름(가나다) 또는 배정 인원으로 정렬한다. 인원을 모르는 곳은 방향과 관계없이 맨 뒤, 인원이 같으면 이름순.
 * 모르는 정렬 칸(옛 주소의 `created_at` 등)은 이름순이다.
 */
export function sortWorksiteList<T extends Row>(rows: T[], key: string, dir: SortDir): T[] {
  const sign = dir === 'desc' ? -1 : 1
  const byName = (a: T, b: T) => a.name.localeCompare(b.name, 'ko')
  return [...rows].sort((a, b) => {
    if (key === 'senior_count') {
      const x = a.senior_count
      const y = b.senior_count
      if (x == null || y == null) return x == null ? (y == null ? byName(a, b) : 1) : -1
      return (x - y) * sign || byName(a, b)
    }
    return byName(a, b) * sign
  })
}
