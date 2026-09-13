// 대시보드 KPI 집계 — 세그먼트/오늘 카운트 (제네릭 목록 필터가 eq/neq만 지원하므로 전용 엔드포인트)
import { requireAdmin, serviceClient } from '~~/server/utils/admin'

// KST 자정(오늘 00:00) ISO — '오늘' 집계 기준
function kstTodayStartIso(): string {
  const KST = 9 * 60 * 60 * 1000
  const now = Date.now()
  const kst = new Date(now + KST)
  const midnightUtcMs = Date.UTC(kst.getUTCFullYear(), kst.getUTCMonth(), kst.getUTCDate()) - KST
  return new Date(midnightUtcMs).toISOString()
}

export default defineEventHandler(async (event) => {
  const actor = await requireAdmin(event)
  // 대시보드는 전체 집계다 — 종사자 수, 공고 수처럼 스코프가 없는 숫자를 준다.
  // 범위가 제한된 롤에게 열면 목록에서 막아 둔 규모를 집계로 되돌려 주는 셈이다.
  if (actor.role !== 'master') {
    throw createError({ statusCode: 404, statusMessage: '알 수 없는 경로입니다.' })
  }
  const db = serviceClient()
  const today = kstTodayStartIso()

  const countOf = async (
    table: string,
    build?: (q: any) => any,
  ): Promise<number> => {
    let q = db.from(table).select('*', { count: 'exact', head: true })
    if (build) q = build(q)
    const { count, error } = await q
    if (error) return 0
    return count ?? 0
  }

  const [
    workersTotal,
    jobSeekers,
    resumesTotal,
    jobsActive,
    recommendationsToday,
    sharesToday,
    contactViewsToday,
    unreadRecommendations,
  ] = await Promise.all([
    countOf('users'),
    countOf('users', (q) => q.eq('is_job_seeking', true)),
    countOf('resumes'),
    countOf('jobs', (q) => q.eq('is_active', true)),
    countOf('job_recommendations', (q) => q.gte('created_at', today)),
    countOf('job_shares', (q) => q.gte('created_at', today)),
    countOf('job_contact_views', (q) => q.gte('viewed_at', today)),
    countOf('job_recommendations', (q) => q.is('read_at', null)),
  ])

  return {
    workersTotal,
    jobSeekers,
    resumesTotal,
    jobsActive,
    recommendationsToday,
    sharesToday,
    contactViewsToday,
    unreadRecommendations,
  }
})
