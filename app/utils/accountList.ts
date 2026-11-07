// 계정·권한 목록 화면의 이름 검색·권한·상태·담당 근무지 필터 — 계정은 전부 받으므로 화면에서 거른다(QA 2026-11-07 ADMIN-13)
import type { AdminAccount } from '../types/dbo'
import { nameIncludes } from './nameSearch'

/** 받은 순서를 그대로 두고 거른다. 각 조건의 '' 은 전체다 */
export function filterAccounts<T extends Pick<AdminAccount, 'name' | 'role' | 'status' | 'worksite_id'>>(
  items: T[],
  opts: { q: string; role: string; status: string; worksite: string },
): T[] {
  return items.filter(
    (a) =>
      nameIncludes(a.name, opts.q) &&
      (!opts.role || a.role === opts.role) &&
      (!opts.status || a.status === opts.status) &&
      (!opts.worksite || a.worksite_id === opts.worksite),
  )
}

/** 담당 근무지 필터 선택지 — 계정에 지정된 근무지만, 이름순. 이름을 모르는 근무지는 id 로 둔다 */
export function accountWorksiteOptions(
  items: Pick<AdminAccount, 'worksite_id'>[],
  nameOf: (id: string) => string,
): { label: string; value: string }[] {
  const ids = [...new Set(items.map((a) => a.worksite_id).filter((id): id is string => !!id))]
  return ids.map((id) => ({ label: nameOf(id), value: id })).sort((a, b) => a.label.localeCompare(b.label, 'ko'))
}
