// 테이블 목록 조회 — 페이지네이션 + 검색 + 정렬 + 컬럼 필터 (엑셀용 all=true 지원)
import { requireAdmin, assertTable, serviceClient } from '~~/server/utils/admin'

const EXPORT_CAP = 10000
const COL = /^[a-z_][a-z0-9_]*$/ // 안전한 컬럼명 패턴

export default defineEventHandler(async (event) => {
  await requireAdmin(event)
  const def = assertTable(event)

  const q = getQuery(event)
  const all = q.all === 'true' || q.all === '1'
  const page = Math.max(1, Number(q.page) || 1)
  const pageSize = Math.min(200, Math.max(1, Number(q.pageSize) || 20))
  const search = (q.q ? String(q.q) : '').trim()

  let query = serviceClient()
    .from(def.name)
    .select('*', { count: 'exact' })

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
  return { rows: data ?? [], total: count ?? 0 }
})
