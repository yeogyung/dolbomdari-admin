// 전역 인증 가드 — 세션 없으면 /login 으로, 세션 있는데 /login 이면 홈으로
// 공개 경로(공유 링크 랜딩 등)는 인증 없이 접근 허용
const PUBLIC_PREFIXES = ['/l/']

export default defineNuxtRouteMiddleware(async (to) => {
  // SPA 모드: 클라이언트에서만 세션 확인
  if (import.meta.server) return

  // 공유 링크 랜딩 등 공개 경로는 세션 검사 없이 통과
  if (PUBLIC_PREFIXES.some((p) => to.path.startsWith(p))) return

  const supabase = useSupabase()
  const {
    data: { session },
  } = await supabase.auth.getSession()

  if (!session && to.path !== '/login') {
    return navigateTo('/login')
  }
  if (session && to.path === '/login') {
    return navigateTo('/')
  }
})
