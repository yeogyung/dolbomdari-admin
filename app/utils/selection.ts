// 표 행 선택 규칙 — 머리글 체크박스로 현재 페이지 전체를 고르거나 푼다

/** 페이지 행이 전부 선택돼 있으면 그 행만 풀고, 아니면 빠진 행을 더한다. 다른 페이지 선택은 건드리지 않는다. */
export function togglePageSelection(selected: string[], pageIds: string[]): string[] {
  if (pageIds.length === 0) return selected
  const all = pageIds.every((id) => selected.includes(id))
  if (all) return selected.filter((id) => !pageIds.includes(id))
  return [...selected, ...pageIds.filter((id) => !selected.includes(id))]
}
