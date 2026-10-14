// 외래키(난수 UUID)를 참조 테이블의 이름으로 해석해 `${column}__ref` 를 붙인다 — 목록·단건 조회 공용
import type { RefDef } from '#shared/tables'
import type { serviceClient } from './admin'

export async function resolveRefs(
  db: ReturnType<typeof serviceClient>,
  rows: Record<string, any>[],
  refs: RefDef[] | undefined,
): Promise<void> {
  if (!refs?.length || !rows.length) return
  for (const rf of refs) {
    const ids = [...new Set(rows.map((r) => r[rf.column]).filter(Boolean))]
    if (!ids.length) continue
    const map = new Map<string, unknown>()
    for (let i = 0; i < ids.length; i += 200) {
      const chunk = ids.slice(i, i + 200)
      const { data: refRows } = await db.from(rf.table).select(`id,${rf.field}`).in('id', chunk)
      for (const rr of refRows ?? []) map.set((rr as any).id, (rr as any)[rf.field])
    }
    const key = `${rf.column}__ref`
    for (const r of rows) r[key] = map.get(r[rf.column]) ?? r[rf.column] ?? null
  }
}
