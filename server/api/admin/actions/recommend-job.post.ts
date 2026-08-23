// 어드민 수동 공고 추천 — job_recommendations insert (AFTER INSERT 트리거가 종사자에게 W5 푸시)
import { requireAdmin, serviceClient } from '~~/server/utils/admin'

export default defineEventHandler(async (event) => {
  await requireAdmin(event)
  const body = (await readBody(event)) as { jobId?: string; workerId?: string }
  const jobId = String(body.jobId || '').trim()
  const workerId = String(body.workerId || '').trim()
  if (!jobId || !workerId) {
    throw createError({ statusCode: 400, statusMessage: 'jobId·workerId가 필요합니다.' })
  }

  const db = serviceClient()

  // 공고의 소속 기관 확인 (추천은 기관 등록 공고만 가능 — job_recommendations.organization_id NOT NULL)
  const { data: job, error: jErr } = await db
    .from('jobs')
    .select('organization_id')
    .eq('id', jobId)
    .maybeSingle()
  if (jErr) throw createError({ statusCode: 500, statusMessage: '공고 조회 실패' })
  if (!job) throw createError({ statusCode: 404, statusMessage: '공고를 찾을 수 없습니다.' })
  if (!job.organization_id) {
    throw createError({ statusCode: 400, statusMessage: '기관이 등록한 공고만 추천할 수 있습니다.' })
  }

  const { error } = await db.from('job_recommendations').insert({
    organization_id: job.organization_id,
    job_id: jobId,
    worker_id: workerId,
  })
  if (error) {
    if ((error as { code?: string }).code === '23505') return { ok: true, duplicated: true }
    throw createError({ statusCode: 500, statusMessage: '추천 저장 실패: ' + error.message })
  }
  return { ok: true }
})
