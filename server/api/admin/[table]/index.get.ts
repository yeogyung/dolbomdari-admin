// 테이블 목록 조회 — 페이지네이션 + 검색 + 정렬 + 컬럼 필터 (엑셀용 all=true 지원)
import {
  requireAdmin,
  assertTable,
  assertTableAccess,
  applyRoleScope,
  serviceClient,
} from '~~/server/utils/admin'
import { resolveRefs } from '~~/server/utils/refs'
import { attachCounts } from '~~/server/utils/counts'

const EXPORT_CAP = 10000
const DB_PAGE = 1000 // PostgREST 한 번 응답 상한 — 이보다 크게 range 를 줘도 1000행에서 잘린다
const COL = /^[a-z_][a-z0-9_]*$/ // 안전한 컬럼명 패턴

export default defineEventHandler(async (event) => {
  const actor = await requireAdmin(event)
  const def = assertTable(event)
  assertTableAccess(actor, def.name)

  const q = getQuery(event)
  const all = q.all === 'true' || q.all === '1'
  const page = Math.max(1, Number(q.page) || 1)
  const pageSize = Math.min(200, Math.max(1, Number(q.pageSize) || 20))
  const search = (q.q ? String(q.q) : '').trim()

  // 엑셀은 같은 조건으로 여러 번 받아야 해서 조건 붙이기를 함수로 둔다(빌더는 한 번 await 하면 끝난다)
  const build = () => {
    let query = serviceClient()
      .from(def.name)
      .select('*', { count: 'exact' })

    // 롤 스코프 — 기관 관리자는 자기 기관만 본다
    query = applyRoleScope(query, actor, def.name)

    // 검색 (ilike or)
    if (search && def.searchColumns?.length) {
      const safe = search.replace(/[,()*]/g, ' ').trim()
      if (safe) {
        const orExpr = def.searchColumns.map((c) => `${c}.ilike.%${safe}%`).join(',')
        query = query.or(orExpr)
      }
    }

    // 컬럼 필터 (f=컬럼, op=eq|neq, v=값)
    const f = q.f ? String(q.f) : ''
    const op = String(q.op || 'eq')
    const v = q.v !== undefined ? String(q.v) : ''
    if (f && COL.test(f) && v !== '') {
      query = op === 'neq' ? query.neq(f, v) : query.eq(f, v)
    }

    // 정렬 (sort=컬럼, dir=asc|desc) — 없으면 레지스트리 기본 정렬
    const sortCol = q.sort ? String(q.sort) : ''
    // 집계 가상 컬럼은 DB 에 없어 정렬하면 PostgREST 오류가 난다 — 기본 정렬로 떨어뜨린다
    const isCountKey = def.counts?.some((c) => c.key === sortCol) ?? false
    if (sortCol && COL.test(sortCol) && !isCountKey) {
      query = query.order(sortCol, { ascending: String(q.dir) === 'asc', nullsFirst: false })
    } else if (def.defaultSort) {
      query = query.order(def.defaultSort.column, {
        ascending: def.defaultSort.ascending,
        nullsFirst: false,
      })
    }

    // 여러 쪽으로 나눠 받을 때 쪽 경계에서 행이 겹치거나 빠지지 않게 pk 로 순서를 고정한다
    for (const col of def.pk) query = query.order(col, { ascending: true })
    return query
  }

  let rows: Record<string, any>[] = []
  let count: number | null = null
  if (all) {
    // 1000행씩 이어 받는다 — 한 번에 range(0, 9999) 를 주면 조용히 1000행만 온다
    for (let from = 0; from < EXPORT_CAP; from += DB_PAGE) {
      const res = await build().range(from, Math.min(from + DB_PAGE, EXPORT_CAP) - 1)
      if (res.error) throw createError({ statusCode: 500, statusMessage: res.error.message })
      const chunk = res.data ?? []
      rows.push(...chunk)
      count = res.count
      if (chunk.length < DB_PAGE || (count !== null && rows.length >= count)) break
    }
  } else {
    const from = (page - 1) * pageSize
    const res = await build().range(from, from + pageSize - 1)
    if (res.error) throw createError({ statusCode: 500, statusMessage: res.error.message })
    rows = res.data ?? []
    count = res.count
  }

  // 외래키(난수 UUID) → 참조 테이블 이름으로 해석하여 `${column}__ref` 컬럼 추가
  await resolveRefs(serviceClient(), rows, def.refs)
  // 집계 컬럼 — 행은 이미 applyRoleScope 로 걸렀으므로 그 행들의 숫자만 붙는다
  await attachCounts(serviceClient(), rows, def.counts)

  return { rows, total: count ?? 0 }
})
