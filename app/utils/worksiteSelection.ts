// 근무지 일괄 선택 — 검색·사업으로 좁혀 보이는 근무지만 한꺼번에 넣고 뺀다

/** 보이는 근무지를 모두 더한다. 이미 고른 것은 그대로 두고 중복을 만들지 않는다. */
export function addAll(selected: string[], visible: string[]): string[] {
  const out = [...selected]
  for (const id of visible) if (!out.includes(id)) out.push(id)
  return out
}

/** 보이는 근무지만 뺀다. 다른 사업·검색에서 고른 근무지는 남긴다. */
export function removeAll(selected: string[], visible: string[]): string[] {
  const hide = new Set(visible)
  return selected.filter((id) => !hide.has(id))
}
