// 명부 목록의 근무지·사업 칸 표기 — 여러 곳이면 첫 하나와 「외 N」(QA 2026-11-07 ADMIN-02)
import type { RosterSite } from '~/types/dbo'

/** 첫 하나 + 「외 N」. 없으면 '—' */
export function firstAndMore(names: string[]): string {
  if (!names.length) return '—'
  return names.length === 1 ? names[0]! : `${names[0]} 외 ${names.length - 1}`
}

/** 사업 이름 — 같은 사업은 한 번, 근무지 순서(이름순)대로. 사업이 없는 근무지는 세지 않는다 */
export function rosterProgramNames(sites: Pick<RosterSite, 'program_name'>[]): string[] {
  return [...new Set(sites.map((s) => s.program_name).filter((n): n is string => !!n))]
}

/**
 * 목록 칸 표기. `worksites` 가 없으면(옛 서버) null — 칸을 '—' 로 두고 「근무지 없음」과 섞지 않는다.
 * `full` 은 마우스를 올렸을 때·엑셀에 쓰는 전체 이름
 */
export function rosterSiteCells(sites: RosterSite[] | undefined): {
  worksite: string
  program: string
  fullWorksites: string
  fullPrograms: string
} | null {
  if (!sites) return null
  const names = sites.map((s) => s.name)
  const programs = rosterProgramNames(sites)
  return {
    worksite: firstAndMore(names),
    program: firstAndMore(programs),
    fullWorksites: names.join(', '),
    fullPrograms: programs.join(', '),
  }
}
