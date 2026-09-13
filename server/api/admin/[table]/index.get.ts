// 테이블 목록 조회 — 페이지네이션 + 검색 + 정렬 + 컬럼 필터 (엑셀용 all=true 지원)
import {
  requireAdmin,
  assertTable,
  assertTableAccess,
  applyRoleScope,
  serviceClient,
} from '~~/server/utils/admin'

const EXPORT_CAP = 10000
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
  if (sortCol && COL.test(sortCol)) {
    query = query.order(sortCol, { ascending: String(q.dir) === 'asc', nullsFirst: false })
  } else if (def.defaultSort) {
    query = query.order(def.defaultSort.column, {
      ascending: def.defaultSort.ascending,
      nullsFirst: false,
    })
  }

  // 범위
  if (all) {
    query = query.range(0, EXPORT_CAP - 1)
  } else {
    const from = (page - 1) * pageSize
    query = query.range(from, from + pageSize - 1)
  }

  const { data, error, count } = await query
  if (error) {
    throw createError({ statusCode: 500, statusMessage: error.message })
  }

  const rows = data ?? []

  // 외래키(난수 UUID) → 참조 테이블 이름으로 해석하여 `${column}__ref` 컬럼 추가
  if (def.refs?.length && rows.length) {
    const db = serviceClient()
    for (const rf of def.refs) {
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

  return { rows, total: count ?? 0 }
})
