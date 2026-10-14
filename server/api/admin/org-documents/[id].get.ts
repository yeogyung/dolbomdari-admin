// 기관 가입 서류의 임시 열람 URL (master 전용) — 비공개 버킷 org-documents 의 signed URL 5분
import { assertWriteAllowed, requireAdmin, serviceClient } from '~~/server/utils/admin'

export default defineEventHandler(async (event) => {
  // 사업자등록증은 기관 관리자 롤에도 보여 주지 않는다 — 검토하는 master 만 본다
  assertWriteAllowed(await requireAdmin(event))
  const id = getRouterParam(event, 'id')
  const db = serviceClient()

  const { data, error } = await db
    .from('organization_manager')
    .select('document_path')
    .eq('id', id)
    .maybeSingle()
  if (error) throw createError({ statusCode: 500, statusMessage: '서류 조회 실패' })
  if (!data?.document_path) return { url: null }

  const { data: signed, error: signErr } = await db.storage
    .from('org-documents')
    .createSignedUrl(data.document_path as string, 300)
  if (signErr) throw createError({ statusCode: 500, statusMessage: '서류 URL 생성 실패: ' + signErr.message })
  return { url: signed.signedUrl }
})
