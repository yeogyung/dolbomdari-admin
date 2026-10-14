// 목록 집계 가상 컬럼을 붙인다 — 현재 페이지 행 id 묶음으로 연관 테이블을 조회해 센다
//
// id 마다 count 요청을 보내면 페이지 20행·컬럼 3개에 60회가 나간다. 묶음 조회 한 번에 받아 tallyCounts 로 센다.
// service 클라이언트로 읽지만 대상 id 는 호출부가 롤 스코프로 거른 행에서 오므로, 기관 관리자는 자기 기관 숫자만 얻는다.
import type { CountDef } from '#shared/tables'
import { tallyCounts } from '#shared/counts'
import type { serviceClient } from './admin'

const ID_CHUNK = 200
/** PostgREST 한 응답의 최대 행 수. 이보다 짧은 페이지가 올 때까지 이어 받는다 — 잘린 채 세지 않게 */
const PAGE = 1000

export async function attachCounts(
  db: ReturnType<typeof serviceClient>,
  rows: Record<string, any>[],
  counts: CountDef[] | undefined,
): Promise<void> {
  if (!counts?.length || !rows.length) return
  const ids = [...new Set(rows.map((r) => r.id).filter(Boolean))] as string[]
  for (const c of counts) {
    const cols = c.distinct ? `${c.fk},${c.distinct}` : c.fk
    const found: Record<string, unknown>[] = []
    for (let i = 0; i < ids.length; i += ID_CHUNK) {
      const chunk = ids.slice(i, i + ID_CHUNK)
      for (let from = 0; ; from += PAGE) {
        const { data, error } = await db
          .from(c.table)
          .select(cols)
          .in(c.fk, chunk)
          // 페이지 경계에서 행이 겹치거나 빠지지 않게 고유한 id 로 순서를 고정한다(대상 테이블은 id PK 를 가진다)
          .order(c.fk)
          .order('id')
          .range(from, from + PAGE - 1)
        if (error) throw createError({ statusCode: 500, statusMessage: `${c.label} 집계 실패: ${error.message}` })
        found.push(...((data ?? []) as unknown as Record<string, unknown>[]))
        if (!data || data.length < PAGE) break
      }
    }
    const tally = tallyCounts(found, ids, c.fk, c.distinct)
    for (const r of rows) r[c.key] = tally.get(r.id) ?? 0
  }
}
