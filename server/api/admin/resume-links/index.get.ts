// 이력서 공유 링크 발급 이력 — 종사자 기준 최신순
import { requireAdmin, serviceClient } from '~~/server/utils/admin'

export default defineEventHandler(async (event) => {
  await requireAdmin(event)
  const userId = String(getQuery(event).userId || '')
  if (!userId) {
    throw createError({ statusCode: 400, statusMessage: 'userId 가 필요합니다.' })
  }

  const { data, error } = await serviceClient()
    .from('resume_share_links')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(50)

  if (error) throw createError({ statusCode: 500, statusMessage: error.message })
  return { rows: data ?? [] }
})
