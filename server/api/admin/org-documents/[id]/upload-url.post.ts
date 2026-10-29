// 관리자가 기관 사업자등록증을 대신 올릴 서명 업로드 주소 발급 (master 전용) — 파일은 브라우저가 Storage 로 바로 올린다
import { assertWriteAllowed, requireAdmin, serviceClient } from '~~/server/utils/admin'
import { orgDocumentExt } from '#shared/orgDocument'

export default defineEventHandler(async (event) => {
  assertWriteAllowed(await requireAdmin(event))
  const id = getRouterParam(event, 'id')
  const body = await readBody<{ contentType?: string }>(event)
  const ext = orgDocumentExt(String(body?.contentType ?? ''))
  if (!id || !ext) {
    throw createError({ statusCode: 400, statusMessage: '서류는 JPG·PNG·WEBP 이미지로 올려 주세요.' })
  }

  const db = serviceClient()
  const { data: manager, error } = await db.from('organization_manager').select('id').eq('id', id).maybeSingle()
  if (error) throw createError({ statusCode: 500, statusMessage: '담당자 조회 실패: ' + error.message })
  if (!manager) throw createError({ statusCode: 404, statusMessage: '담당자를 찾을 수 없습니다.' })

  // 앱과 같은 {담당자 id}/{시각}.{확장자} — 담당자 id 가 곧 auth uid 이고, 앱 업로드 정책이 첫 폴더를 본인 uid 로 본다
  const path = `${id}/${Date.now()}.${ext}`
  const { data, error: signErr } = await db.storage.from('org-documents').createSignedUploadUrl(path)
  if (signErr) throw createError({ statusCode: 500, statusMessage: '업로드 주소 발급 실패: ' + signErr.message })
  return { path: data.path, token: data.token }
})
