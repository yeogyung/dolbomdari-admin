// 내 어드민 롤 조회 — 프론트가 사이드바를 거르는 근거. 판정은 requireAdmin 한 곳에서만 한다
import { requireAdmin } from '~~/server/utils/admin'

export default defineEventHandler(async (event) => {
  // 담당자도 자기 롤은 알아야 사이드바를 그린다. 다른 Nitro 라우트는 담당자를 막는다.
  const actor = await requireAdmin(event, { allowManager: true })
  return {
    name: actor.name,
    role: actor.role,
    organizationId: actor.organizationId,
    worksiteId: actor.worksiteId,
    email: actor.email,
  }
})
