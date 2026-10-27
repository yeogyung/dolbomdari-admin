// 전역 인증 가드 — 세션과 어드민 롤을 화면이 그려지기 전에 확정한다
import { managerAllows } from '#shared/nav'
// 공개 경로(공유 링크 랜딩 등)는 인증 없이 접근 허용
const PUBLIC_PREFIXES = ['/l/']

/** 롤별 첫 화면 — 그 롤이 실제로 볼 수 있는 첫 메뉴여야 한다 */
const ROLE_HOME: Record<string, string> = {
  master: '/',
  worksite: '/senior/worksites',
  org: '/users',
  manager: '/senior/attendance',
}

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
    // 다른 탭 로그아웃·토큰 만료로 세션이 사라진 경우도 앞 계정의 롤·화면 캐시를 남기지 않는다
    useAdminRole().clear()
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
  let role
  try {
    role = await load()
  } catch {
    // 네트워크·서버 오류 — 자격이 없다는 뜻이 아니니 세션은 지우지 않는다. 새로고침하면 다시 판정한다
    if (to.path === '/login') return
    return abortNavigation(
      createError({ statusCode: 503, statusMessage: '관리자 정보를 불러오지 못했습니다. 잠시 후 새로고침해 주세요.', fatal: true }),
    )
  }

  if (!role) {
    if (to.path === '/login') return
    clear()
    await supabase.auth.signOut()
    // 인증번호까지 맞았는데 말없이 로그인 화면으로 돌아오면 고장으로 보인다. 이유를 알린다.
    // 값을 매번 바꾼다 — 이미 ?denied 가 붙은 로그인 화면에서 또 거부돼도 화면이 알아채게.
    return navigateTo({ path: '/login', query: { denied: String(Date.now()) } })
  }

  // 대시보드·리포트는 전체 집계 화면이라 master 만 본다. 범위가 제한된 롤에게는
  // 목록에서 막아 둔 규모를 숫자로 되돌려 주는 셈이 된다.
  const home = ROLE_HOME[me.value?.role ?? 'master'] ?? '/'
  const isMasterOnly =
    to.path === '/' || to.path === '/senior' || to.path.startsWith('/senior/reports')
  if (isMasterOnly && me.value?.role !== 'master') {
    return navigateTo(home)
  }

  // 담당자에게 연 화면은 출퇴근 기록과 휴무 관리다(`managerAllows`). 다른 화면은 열어도 데이터가
  // 403 이라 빈 화면이 된다.
  if (me.value?.role === 'manager' && !managerAllows(to.path)) {
    return navigateTo(home)
  }

  if (to.path === '/login') {
    return navigateTo(home)
  }
})
