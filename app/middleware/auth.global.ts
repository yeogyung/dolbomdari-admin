// 전역 인증 가드 — 세션과 어드민 롤을 화면이 그려지기 전에 확정한다
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

  if (!session) {
    return to.path === '/login' ? undefined : navigateTo('/login')
  }

  // 세션이 있어도 어드민 자격은 별개다.
  //
  // 구인구직 OTP 는 종사자에게도 세션을 준다. 여기서 걸러 내지 않으면 자격 없는
  // 사람이 홈까지 들어와 빈 화면을 보고 고장으로 받아들인다.
  //
  // 그리고 롤을 **여기서** 채워야 한다. 페이지가 먼저 그려지면 master 에게도
  // 잠깐 "권한 없음" 화면이 스치는데, 쓰기 버튼의 표시 여부가 이 값에 달려 있다.
  const { me, load, clear } = useAdminRole()
  const role = await load()

  if (!role) {
    if (to.path === '/login') return
    clear()
    await supabase.auth.signOut()
    return navigateTo('/login')
  }

  if (to.path === '/login') {
    // 롤에 따라 첫 화면이 다르다 — 수요처 담당자에게 구인구직 홈은 빈 화면이다
    return navigateTo(me.value?.role === 'worksite' ? '/senior/worksites' : '/')
  }
})
