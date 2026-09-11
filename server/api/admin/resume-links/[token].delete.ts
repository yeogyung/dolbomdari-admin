// 이력서 공유 링크 폐기 — 행을 지우지 않고 revoked_at 을 찍는다 (AGENTS §1.9)
import { requireAdmin, serviceClient } from '~~/server/utils/admin'

export default defineEventHandler(async (event) => {
  await requireAdmin(event)
  const token = getRouterParam(event, 'token')
  if (!token) {
    throw createError({ statusCode: 400, statusMessage: '토큰이 없습니다.' })
  }

  const { error } = await serviceClient()
    .from('resume_share_links')
    .update({ revoked_at: new Date().toISOString() })
    .eq('token', token)
    .is('revoked_at', null)

  if (error) throw createError({ statusCode: 500, statusMessage: error.message })
  return { ok: true }
})
