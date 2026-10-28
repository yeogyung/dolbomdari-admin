// 이력서 공유 링크 발급 — 토큰＋비밀번호를 만들고 만료일을 박은 뒤, 이전에 살아 있던 링크를 폐기한다
import { requireMaster, serviceClient } from '~~/server/utils/admin'
import { generatePassword, generateToken } from '~~/server/utils/resume-link'

const DEFAULT_DAYS = 7
const MAX_DAYS = 90

export default defineEventHandler(async (event) => {
  await requireMaster(event)
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

  // 공개 링크는 종사자당 하나만 살려 둔다 — 새 링크보다 먼저 만든 살아 있는 링크를 폐기한다.
  // 발급을 먼저 해야 발급이 실패해도 쓰던 링크를 잃지 않는다. 만료된 링크는 「만료됨」 표시를 지키려고 그대로 둔다.
  // 「먼저 만든」으로 거르는 이유: 두 곳에서 거의 동시에 발급해도 서로의 새 링크를 지워 하나도 안 남는 일이 없다
  const now = new Date().toISOString()
  const { data: revoked, error: revokeError } = await serviceClient()
    .from('resume_share_links')
    .update({ revoked_at: now })
    .eq('user_id', userId)
    .lt('created_at', data.created_at)
    .is('revoked_at', null)
    .gt('expires_at', now)
    .select('token')

  // 새 링크는 이미 만들어졌다 — 발급 실패로 보이면 다시 눌러 링크가 쌓이므로 성공으로 돌려주고 폐기 실패만 알린다
  if (revokeError) {
    console.error('[resume-links] 이전 링크 폐기 실패', { userId, token: data.token, revokeError })
    return { ...data, revoked_count: 0, revoke_error: revokeError.message }
  }
  return { ...data, revoked_count: revoked?.length ?? 0 }
})
