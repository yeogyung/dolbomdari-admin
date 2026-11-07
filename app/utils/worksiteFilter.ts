// 목록 툴바 근무지 필터의 선택지 규칙 — 사업으로 좁히고, 입력한 글자로 이름·사업 이름을 찾는다(QA 2026-11-07 ADMIN-04)
import { searchByName } from './nameSearch'

type Site = { id: string; name: string; program_id: string | null }

/** 사업을 골랐으면 그 사업의 근무지만. 고르지 않았으면('') 전부 */
export function inProgram<T extends Site>(worksites: T[], programId: string): T[] {
  return programId ? worksites.filter((w) => w.program_id === programId) : worksites
}

/**
 * 근무지 필터 선택지. 사업으로 먼저 좁힌다. 검색어가 없으면 이름 가나다순 전부, 있으면 대시보드 날씨 카드와 같은
 * 규칙(`searchByName` — 띄어쓰기·대소문자 무시, 이름이 검색어로 시작하는 곳을 앞에, 사업 이름으로도 찾음)으로 찾는다.
 */
export function worksiteChoices<T extends Site>(
  worksites: T[],
  term: string,
  programId: string,
  programName: (programId: string | null) => string | null = () => null,
): T[] {
  const pool = inProgram(worksites, programId)
  if (!term.trim()) return [...pool].sort((a, b) => a.name.localeCompare(b.name, 'ko'))
  const withSub = pool.map((w) => ({ site: w, name: w.name, sub: programName(w.program_id) }))
  return searchByName(withSub, term, withSub.length).items.map((x) => x.site)
}

/** 고른 근무지가 지금 사업 밖인가 — 사업을 바꾸면 근무지 선택을 푼다. 근무지를 모르면(목록 전) 풀지 않는다 */
export function worksiteOutsideProgram(worksites: Site[], worksiteId: string, programId: string): boolean {
  if (!worksiteId || !programId) return false
  const site = worksites.find((w) => w.id === worksiteId)
  return !!site && site.program_id !== programId
}
