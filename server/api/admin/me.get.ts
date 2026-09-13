// 내 어드민 롤 조회 — 프론트가 사이드바를 거르는 근거. 판정은 requireAdmin 한 곳에서만 한다
import { requireAdmin } from '~~/server/utils/admin'

export default defineEventHandler(async (event) => {
  const actor = await requireAdmin(event)
  return {
    role: actor.role,
    organizationId: actor.organizationId,
    worksiteId: actor.worksiteId,
    email: actor.email,
  }
})
