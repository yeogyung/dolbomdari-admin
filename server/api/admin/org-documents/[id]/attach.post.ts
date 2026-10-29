// 관리자가 올린 사업자등록증을 담당자에 연결 (master 전용) — document_path 만 바꾸고 승인 상태는 그대로 둔다
import { assertWriteAllowed, requireAdmin, serviceClient } from '~~/server/utils/admin'

export default defineEventHandler(async (event) => {
  assertWriteAllowed(await requireAdmin(event))
  const id = getRouterParam(event, 'id')
  const body = await readBody<{ path?: string }>(event)
  const path = String(body?.path ?? '')
  // upload-url 이 이 담당자 폴더에 만든 모양({id}/{시각}.{확장자})만 받는다 — `..` 로 다른 담당자의 서류를 끌어다 붙이지 못하게
  if (!id || !path.startsWith(`${id}/`) || !/^\d+\.(jpg|png|webp)$/.test(path.slice(id.length + 1))) {
    throw createError({ statusCode: 400, statusMessage: '잘못된 서류 경로입니다.' })
  }

  const db = serviceClient()
  const { data: found } = await db.storage.from('org-documents').exists(path)
  if (!found) throw createError({ statusCode: 400, statusMessage: '올린 서류를 찾을 수 없습니다. 다시 올려 주세요.' })

  // 이미 승인된 기존 기관에 서류만 채우는 용도다 — 상태를 바꾸면 승인된 기관이 대기로 떨어진다.
  // 교체 전 파일은 지우지 않는다 — 앱 재제출과 같은 규칙이고, 잘못 올렸을 때 되찾을 수 있다
  const { data, error } = await db
    .from('organization_manager')
    .update({ document_path: path })
    .eq('id', id)
    .select('id')
    .maybeSingle()
  if (error) throw createError({ statusCode: 500, statusMessage: '서류 연결 실패: ' + error.message })
  if (!data) throw createError({ statusCode: 404, statusMessage: '담당자를 찾을 수 없습니다.' })
  return { ok: true }
})
