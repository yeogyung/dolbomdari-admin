// 이력서 공개 링크를 문자로 보낸다 — URL 과 비밀번호를 한 통에 담는다 (설계 D10)
import { requireAdmin, serviceClient } from '~~/server/utils/admin'
import { sendSms } from '~~/server/utils/sms'

export default defineEventHandler(async (event) => {
  await requireAdmin(event)
  const token = getRouterParam(event, 'token')
  const body = await readBody<{ to?: string }>(event)
  const to = String(body?.to ?? '').trim()

  if (!token || !to) {
    throw createError({ statusCode: 400, statusMessage: '토큰과 수신번호가 필요합니다.' })
  }

  const { data: link } = await serviceClient()
    .from('resume_share_links')
    .select('token,expires_at,revoked_at,locked_at')
    .eq('token', token)
    .maybeSingle()

  if (!link) throw createError({ statusCode: 404, statusMessage: '링크를 찾을 수 없습니다.' })
  if ((link as { revoked_at: string | null }).revoked_at) {
    throw createError({ statusCode: 400, statusMessage: '폐기된 링크는 보낼 수 없습니다.' })
  }
  if (new Date((link as { expires_at: string }).expires_at) <= new Date()) {
    throw createError({ statusCode: 400, statusMessage: '만료된 링크는 보낼 수 없습니다.' })
  }
  if ((link as { locked_at: string | null }).locked_at) {
    throw createError({ statusCode: 400, statusMessage: '잠긴 링크는 보낼 수 없습니다.' })
  }

  // 비밀번호는 상태 확인에 쓰인 위 객체와 섞이지 않도록 발송 직전에 따로 읽는다
  const { data: full } = await serviceClient()
    .from('resume_share_links')
    .select('password,expires_at')
    .eq('token', token)
    .single()

  const base = useRuntimeConfig().public.linkBaseUrl
  const days = Math.max(
    1,
    Math.ceil(
      (new Date((full as { expires_at: string }).expires_at).getTime() - Date.now()) / 86_400_000,
    ),
  )

  const text = [
    '[돌봄다리] 이력서 열람',
    `${base}/r/${token}`,
    `비밀번호 ${(full as { password: string }).password}`,
    `(${days}일 뒤 만료)`,
  ].join('\n')

  const result = await sendSms({ to, text })
  if (!result.ok) {
    throw createError({ statusCode: 502, statusMessage: `문자 발송 실패: ${result.reason}` })
  }

  return { ok: true }
})
