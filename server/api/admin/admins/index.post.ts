// 어드민 접근 계정 생성 — Supabase Auth 사용자 생성 + app_metadata.admin=true
import { requireAdmin, serviceClient } from '~~/server/utils/admin'

export default defineEventHandler(async (event) => {
  await requireAdmin(event)
  const body = (await readBody(event)) as { email?: string; password?: string }
  const email = String(body.email || '').trim().toLowerCase()
  const password = String(body.password || '')

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw createError({ statusCode: 400, statusMessage: '올바른 이메일을 입력하세요.' })
  }
  if (password.length < 8) {
    throw createError({ statusCode: 400, statusMessage: '비밀번호는 8자 이상이어야 합니다.' })
  }

  const db = serviceClient()
  const { data, error } = await db.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    app_metadata: { admin: true },
  })

  if (error) {
    // 이미 존재하는 이메일이면 관리자 권한만 부여하도록 안내
    const msg = /already|exist|registered/i.test(error.message)
      ? '이미 가입된 이메일입니다. 기존 계정에 권한 부여는 별도 처리하세요.'
      : error.message
    throw createError({ statusCode: 400, statusMessage: '생성 실패: ' + msg })
  }

  return { ok: true, id: data.user?.id, email }
})
