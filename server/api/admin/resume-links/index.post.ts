// 이력서 공유 링크 발급 — 토큰＋비밀번호를 만들고 만료일을 박는다
import { requireAdmin, serviceClient } from '~~/server/utils/admin'
import { generatePassword, generateToken } from '~~/server/utils/resume-link'

const DEFAULT_DAYS = 7
const MAX_DAYS = 90

export default defineEventHandler(async (event) => {
  await requireAdmin(event)
  const body = await readBody<{ userId?: string; expiresInDays?: number }>(event)
  const userId = String(body?.userId || '')
  if (!userId) {
    throw createError({ statusCode: 400, statusMessage: 'userId 가 필요합니다.' })
  }

  const days = Math.min(MAX_DAYS, Math.max(1, Number(body?.expiresInDays) || DEFAULT_DAYS))
  const expiresAt = new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString()

  // 발급자를 남긴다 — 누가 개인정보를 외부로 열었는지 추적할 수 있어야 한다
  const auth = getRequestHeader(event, 'authorization') || ''
  const { data: me } = await serviceClient().auth.getUser(auth.slice(7))

  const { data, error } = await serviceClient()
    .from('resume_share_links')
    .insert({
      token: generateToken(),
      user_id: userId,
      password: generatePassword(),
      created_by: me?.user?.id ?? null,
      expires_at: expiresAt,
    })
    .select()
    .single()

  if (error) throw createError({ statusCode: 500, statusMessage: error.message })
  return data
})
