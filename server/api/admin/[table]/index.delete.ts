// 행 삭제 — PK 컬럼값을 쿼리 파라미터로 받아 매칭 (복합키 지원)
import { requireAdmin, assertTable, serviceClient } from '~~/server/utils/admin'

export default defineEventHandler(async (event) => {
  await requireAdmin(event)
  const def = assertTable(event)

  const q = getQuery(event)
  let query = serviceClient().from(def.name).delete()

  for (const col of def.pk) {
    const value = q[col]
    if (value === undefined || value === '') {
      throw createError({ statusCode: 400, statusMessage: `삭제 키 누락: ${col}` })
    }
    query = query.eq(col, String(value))
  }

  const { error } = await query
  if (error) {
    throw createError({ statusCode: 400, statusMessage: error.message })
  }
  return { ok: true }
})
