// 표 머리글 정렬 전환 — 같은 칸을 다시 누르면 방향을 뒤집고, 다른 칸은 오름차순부터

export type SortDir = 'asc' | 'desc'
export type SortState = { key: string; dir: SortDir }

/** 명부 이름의 「가나다순 · 역순」(QA 2026-10-11). 첫 누름은 늘 오름차순이다. */
export function nextSort(current: SortState, clicked: string): SortState {
  if (current.key !== clicked) return { key: clicked, dir: 'asc' }
  return { key: clicked, dir: current.dir === 'asc' ? 'desc' : 'asc' }
}
