// 어드민 접근 계정 목록 — Auth 사용자 중 app_metadata.admin=true 또는 env allowlist 이메일
import { requireAdmin, serviceClient } from '~~/server/utils/admin'

export default defineEventHandler(async (event) => {
  await requireAdmin(event)
  const db = serviceClient()

  const allow = (useRuntimeConfig().adminEmails || '')
    .split(',')
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean)

  const rows: Record<string, unknown>[] = []
  const perPage = 1000
  // 관리자는 소수이지만 auth.users 전체를 스캔해 표시 대상만 추림 (최대 20페이지 = 2만명)
  for (let page = 1; page <= 20; page++) {
    const { data, error } = await db.auth.admin.listUsers({ page, perPage })
    if (error) throw createError({ statusCode: 500, statusMessage: error.message })
    const users = data?.users ?? []
    for (const u of users) {
      const metaAdmin = (u.app_metadata as Record<string, unknown> | undefined)?.admin === true
      const envAdmin = allow.includes((u.email || '').toLowerCase())
      if (metaAdmin || envAdmin) {
        rows.push({
          id: u.id,
          email: u.email ?? '',
          source: metaAdmin ? '생성' : '설정(env)',
          created_at: u.created_at,
          last_sign_in_at: u.last_sign_in_at ?? null,
        })
      }
    }
    if (users.length < perPage) break
  }

  rows.sort((a, b) => String(b.created_at).localeCompare(String(a.created_at)))
  return { rows, total: rows.length }
})
