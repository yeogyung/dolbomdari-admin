// 로그인한 관리자의 롤 — 사이드바를 거르는 근거. 판정 자체는 서버(requireAdmin)가 한다
import type { NavRole } from '#shared/nav'

export interface AdminMe {
  name: string
  role: NavRole
  organizationId: string | null
  worksiteId: string | null
  email: string
}

/**
 * `/api/admin/me` 를 한 번만 부르고 앱 전체가 공유한다.
 *
 * 화면을 거르는 용도이지 권한 판정이 아니다. 서버는 매 요청마다 다시 판정하므로
 * 이 값이 조작돼도 데이터가 새지 않는다.
 */
/** 진행 중인 조회 — 동시에 부르면 같은 결과를 기다린다(SPA 라 모듈 변수로 충분하다) */
let inflight: Promise<AdminMe | null> | null = null

export function useAdminRole() {
  const supabase = useSupabase()
  const me = useState<AdminMe | null>('admin-me', () => null)
  const loading = useState<boolean>('admin-me-loading', () => false)

  /**
   * 세션이 없거나 서버가 자격을 거부(401·403)하면 null — 호출한 쪽이 로그아웃시킨다.
   * 네트워크 오류·서버 오류는 던진다. null 로 바꾸면 잠깐의 끊김에도 로그아웃된다.
   */
  async function load(force = false): Promise<AdminMe | null> {
    if (me.value && !force) return me.value
    // 조회 중에 또 부르면 null 을 돌려주지 않는다 — 미들웨어가 그걸 「자격 없음」으로 읽고 로그아웃시킨다
    if (inflight) return inflight

    loading.value = true
    inflight = (async () => {
      try {
        const {
          data: { session },
          error,
        } = await supabase.auth.getSession()
        // 토큰 갱신이 네트워크 문제로 실패해도 session 이 null 로 온다 — 「세션 없음」과 구분해 던진다.
        // 4xx(만료된 갱신 토큰 등)는 진짜 세션 없음이라 아래로 보내 로그아웃시킨다 — 던지면 오류 화면에 갇힌다
        const sessionStatus = (error as { status?: number } | null)?.status ?? 0
        if (error && !(sessionStatus >= 400 && sessionStatus < 500)) throw error
        if (!session) {
          me.value = null
          return null
        }
        me.value = await $fetch<AdminMe>('/api/admin/me', {
          headers: { Authorization: `Bearer ${session.access_token}` },
        })
        return me.value
      } catch (e: any) {
        const status = e?.status ?? e?.statusCode
        if (status === 401 || status === 403) {
          me.value = null
          return null
        }
        throw e
      } finally {
        loading.value = false
        inflight = null
      }
    })()
    return inflight
  }

  /** 로그아웃·권한 거부 때 부른다. 같은 탭에서 다음 계정이 앞 계정의 집계를 보지 않게 화면 캐시도 비운다 */
  function clear() {
    me.value = null
    screenCache.clear()
  }

  return { me, loading, load, clear }
}
