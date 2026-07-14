// 행 수정 — 단일 PK(id) crud 테이블 전용
import { requireAdmin, assertTable, serviceClient, sanitizePayload } from '~~/server/utils/admin'

export default defineEventHandler(async (event) => {
  await requireAdmin(event)
  const def = assertTable(event)
  const id = getRouterParam(event, 'id')

  if (def.mode !== 'crud' || def.pk.length !== 1) {
    throw createError({ statusCode: 405, statusMessage: '이 테이블은 수정할 수 없습니다.' })
  }

  const body = (await readBody(event)) as Record<string, unknown>
  const payload = sanitizePayload(def, body, false)

  const { data, error } = await serviceClient()
    .from(def.name)
    .update(payload)
    .eq(def.pk[0]!, id)
    .select()
    .single()

  if (error) {
    throw createError({ statusCode: 400, statusMessage: error.message })
  }
  return data
})
