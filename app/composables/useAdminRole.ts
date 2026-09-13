// 로그인한 관리자의 롤 — 사이드바를 거르는 근거. 판정 자체는 서버(requireAdmin)가 한다
import type { NavRole } from '#shared/nav'

export interface AdminMe {
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
export function useAdminRole() {
  const supabase = useSupabase()
  const me = useState<AdminMe | null>('admin-me', () => null)
  const loading = useState<boolean>('admin-me-loading', () => false)

  async function load(force = false): Promise<AdminMe | null> {
    if (me.value && !force) return me.value
    if (loading.value) return me.value

    loading.value = true
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession()
      if (!session) {
        me.value = null
        return null
      }
      me.value = await $fetch<AdminMe>('/api/admin/me', {
        headers: { Authorization: `Bearer ${session.access_token}` },
      })
      return me.value
    } catch {
      // 권한이 없으면 null 로 둔다 — 화면은 빈 사이드바가 되고 요청은 서버가 막는다
      me.value = null
      return null
    } finally {
      loading.value = false
    }
  }

  function clear() {
    me.value = null
  }

  return { me, loading, load, clear }
}
