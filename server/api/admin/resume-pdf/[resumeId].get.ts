// 이력서 PDF 다운로드 — resumes 행을 읽어 서류 양식 PDF 로 렌더해 내려준다
//
// 경로가 /api/admin/resumes/... 가 아닌 이유는 그 아래를 제네릭 [table] 라우트가
// 이미 잡고 있어 assertTable 이 먼저 돌기 때문이다.
import { readFile } from 'node:fs/promises'
import { requireAdmin, serviceClient } from '~~/server/utils/admin'
import { renderResumePdf } from '~~/server/utils/resume-pdf'
import type { Resume } from '#shared/resume-form'

// 폰트는 한 번만 읽어 모듈 스코프에 캐시한다 — 요청마다 4MB 를 읽지 않는다
let fontCache: Uint8Array | null = null
async function nanumGothic(): Promise<Uint8Array> {
  if (fontCache) return fontCache
  const buf = await readFile(
    new URL('../../../assets/fonts/NanumGothic.ttf', import.meta.url),
  )
  fontCache = new Uint8Array(buf)
  return fontCache
}

export default defineEventHandler(async (event) => {
  await requireAdmin(event)
  const resumeId = getRouterParam(event, 'resumeId')
  if (!resumeId) {
    throw createError({ statusCode: 400, statusMessage: '이력서 ID가 없습니다.' })
  }

  const { data, error } = await serviceClient()
    .from('resumes')
    .select('*')
    .eq('id', resumeId)
    .maybeSingle()

  if (error || !data) {
    throw createError({ statusCode: 404, statusMessage: '이력서를 찾을 수 없습니다.' })
  }

  const bytes = await renderResumePdf(data as Resume, await nanumGothic())
  const filename = encodeURIComponent(`이력서_${(data as Resume).name || '무명'}.pdf`)

  setHeader(event, 'content-type', 'application/pdf')
  setHeader(event, 'content-disposition', `attachment; filename*=UTF-8''${filename}`)
  return bytes
})
