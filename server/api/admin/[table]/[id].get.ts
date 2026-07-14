// 단건 조회 — 단일 PK(id) crud 테이블 전용 (수정 폼 로딩용)
import { requireAdmin, assertTable, serviceClient } from '~~/server/utils/admin'

export default defineEventHandler(async (event) => {
  await requireAdmin(event)
  const def = assertTable(event)
  const id = getRouterParam(event, 'id')

  if (def.pk.length !== 1) {
    throw createError({ statusCode: 400, statusMessage: '복합키 테이블은 단건 조회를 지원하지 않습니다.' })
  }

  const { data, error } = await serviceClient()
    .from(def.name)
    .select('*')
    .eq(def.pk[0]!, id)
    .single()

  if (error) {
    throw createError({ statusCode: 404, statusMessage: error.message })
  }
  return data
})
