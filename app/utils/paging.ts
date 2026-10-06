// 서버 페이지 상한(size ≤ 100)을 넘는 목록을 끝까지, 빠짐없이 이어 받는 헬퍼

/**
 * total 에 닿을 때까지 페이지를 이어 받는다. 빠진 행이 있으면 던진다(`incomplete_list`).
 *
 * 근무지는 300곳 가까이 되는데 dbo-admin 목록은 한 번에 100건까지다. 첫 페이지만 받아
 * 고르게 하면 101번째부터는 선택지에 없고, 「보낸 목록이 곧 결과」인 저장에서는 화면에
 * 없던 값이 지워진다.
 *
 * 행 수가 아니라 **고유 키 수**로 센다. 정렬이 불안정하면 페이지 경계에서 같은 행이 두 번
 * 오고 다른 행이 빠지는데, 행 수로 세면 그 상태가 「다 받았다」로 보인다. 다 못 받았으면
 * 반쯤 채운 목록을 돌려주지 않고 던져 호출한 화면이 저장을 막게 한다.
 */
export async function fetchAllPages<T>(
  fetchPage: (page: number, size: number) => Promise<{ items: T[]; total: number }>,
  key: (item: T) => string | number,
  size = 100,
): Promise<T[]> {
  const seen = new Map<string | number, T>()
  for (let page = 1; ; page++) {
    const { items, total } = await fetchPage(page, size)
    for (const item of items) if (!seen.has(key(item))) seen.set(key(item), item)
    if (seen.size >= total) return [...seen.values()]
    if (items.length === 0) throw new Error('incomplete_list')
  }
}
