// 어드민 접근 권한 해제 — 계정을 삭제하지 않고 app_metadata.admin 플래그만 해제
import { requireAdmin, serviceClient } from '~~/server/utils/admin'

export default defineEventHandler(async (event) => {
  const me = await requireAdmin(event)
  const q = getQuery(event)
  const id = String(q.id || '')
  if (!id) throw createError({ statusCode: 400, statusMessage: 'id가 필요합니다.' })

  const db = serviceClient()
  const { data: target, error: getErr } = await db.auth.admin.getUserById(id)
  if (getErr || !target?.user) {
    throw createError({ statusCode: 404, statusMessage: '계정을 찾을 수 없습니다.' })
  }
  // 본인 권한은 UI에서 해제 불가 (잠금 방지)
  if ((target.user.email || '').toLowerCase() === me) {
    throw createError({ statusCode: 400, statusMessage: '본인 권한은 해제할 수 없습니다.' })
  }

  const { error } = await db.auth.admin.updateUserById(id, {
    app_metadata: { admin: false },
  })
  if (error) throw createError({ statusCode: 500, statusMessage: '해제 실패: ' + error.message })
  return { ok: true }
})
