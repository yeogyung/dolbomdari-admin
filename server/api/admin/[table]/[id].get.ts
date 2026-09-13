// 단건 조회 — 단일 PK(id) crud 테이블 전용 (수정 폼 로딩용)
import {
  requireAdmin,
  assertTable,
  assertTableAccess,
  applyRoleScope,
  serviceClient,
} from '~~/server/utils/admin'

export default defineEventHandler(async (event) => {
  const actor = await requireAdmin(event)
  const def = assertTable(event)
  assertTableAccess(actor, def.name)
  const id = getRouterParam(event, 'id')

  if (def.pk.length !== 1) {
    throw createError({ statusCode: 400, statusMessage: '복합키 테이블은 단건 조회를 지원하지 않습니다.' })
  }

  // 스코프 밖 행은 조회되지 않아 404 가 된다 — 목록에 안 보이는 것을 URL 로 직접 열 수 없다
  const { data, error } = await applyRoleScope(
    serviceClient().from(def.name).select('*').eq(def.pk[0]!, id),
    actor,
    def.name,
  ).single()

  if (error) {
    throw createError({ statusCode: 404, statusMessage: error.message })
  }
  return data
})
