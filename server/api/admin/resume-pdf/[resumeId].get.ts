// 이력서 PDF 다운로드 — resumes 행을 읽어 서류 양식 PDF 로 렌더해 내려준다
//
// 경로가 /api/admin/resumes/... 가 아닌 이유는 그 아래를 제네릭 [table] 라우트가
// 이미 잡고 있어 assertTable 이 먼저 돌기 때문이다.
import { requireAdmin, serviceClient } from '~~/server/utils/admin'
import { renderResumePdf } from '~~/server/utils/resume-pdf'
import type { Resume } from '#shared/resume-form'

// 폰트는 한 번만 읽어 모듈 스코프에 캐시한다 — 요청마다 4MB 를 읽지 않는다
// node:fs 로 읽으면 안 된다 — Nitro 는 server/assets/ 를 디스크에 그대로 두지 않고
// assets:server 스토리지(빌드 시 raw 청크로 인라인)로 노출한다. dev 에서는 원본
// 파일이 남아 있어 readFile 이 우연히 성공하지만, 빌드 후에는 파일이 없어 깨진다.
let fontCache: Uint8Array | null = null
async function nanumGothic(): Promise<Uint8Array> {
  if (fontCache) return fontCache
  const raw = await useStorage('assets:server').getItemRaw('fonts/NanumGothic.ttf')
  if (!raw) {
    throw createError({ statusCode: 500, statusMessage: '이력서 서식 폰트를 불러오지 못했습니다.' })
  }
  fontCache = raw instanceof Uint8Array ? raw : new Uint8Array(raw as ArrayBufferLike)
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
