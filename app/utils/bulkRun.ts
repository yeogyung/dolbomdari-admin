// 여러 건을 기존 건별 API 로 차례로 처리하고 결과를 모으는 도우미 — 출결 일괄 수정·선택 삭제·여러 명 배정이 쓴다

export type BulkFailure<T> = { item: T; error: unknown }
export type BulkResult<T> = { done: T[]; failed: BulkFailure<T>[] }

/**
 * 하나씩 **차례로** 부른다. 한꺼번에 보내지 않는다 — 서버가 건마다 이력·알림을 남기고, 몰아 보내 한도에 걸리면
 * 어디까지 됐는지 알기 어렵다. 한 건이 실패해도 멈추지 않고 다음 건을 한다(성공한 건은 그대로 둔다, 결정 D25).
 * `onProgress` 는 한 건 끝날 때마다 (끝낸 수, 전체 수)
 */
export async function runSequential<T>(
  items: T[],
  run: (item: T) => Promise<unknown>,
  onProgress?: (finished: number, total: number) => void,
): Promise<BulkResult<T>> {
  const result: BulkResult<T> = { done: [], failed: [] }
  for (const [i, item] of items.entries()) {
    try {
      await run(item)
      result.done.push(item)
    } catch (error) {
      result.failed.push({ item, error })
    }
    onProgress?.(i + 1, items.length)
  }
  return result
}

/** 결과 화면에 보일 실패 명단 — 「누구 · 왜」 한 줄씩 */
export function failureLines<T>(
  failed: BulkFailure<T>[],
  nameOf: (item: T) => string,
  reasonOf: (error: unknown) => string,
): { name: string; reason: string }[] {
  return failed.map((f) => ({ name: nameOf(f.item), reason: reasonOf(f.error) }))
}
