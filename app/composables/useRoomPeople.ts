// 채팅방 참여자 후보 조회 — 어드민 명부에 프로필 id 가 없어 마스터 권한으로 dbo_profiles 를 직접 읽어 잇는다(QA 2026-11-02 CHAT-01)
//
// RLS `profile select master` 가 master 에게 `dbo_profiles` 읽기를 연다(서버 2026-11-04 계약 3a묶음 4번). 지금 운영에도 있는
// 정책이라 옛 서버에서도 명단은 보인다 — 막히는 것은 방 만들기 경로뿐이다.
import type { DirectoryEntry } from '~/types/dbo'
import { fetchAllPages } from '~/utils/paging'

/** `directory_id=in.(…)` 한 번에 싣는 id 수. 주소 길이(약 8KB)를 넘지 않게 나눈다 */
const IN_CHUNK = 100

export type ProfileLink = { id: string; directory_id: string }

export function useRoomPeople() {
  const supabase = useSupabase()
  const api = useDboAdmin()

  return {
    /** 방에 넣을 수 있는 후보의 원자료 — 활성 명부 전부(시니어·담당자·수요처)와 그 앱 계정. 실패하면 던진다 */
    async candidates(): Promise<{ rows: DirectoryEntry[]; profiles: ProfileLink[] }> {
      const rows = await fetchAllPages(
        (page, size) => api.listDirectory({ status: 'active', page, size, sort: 'name' }),
        (d) => d.id,
      )
      const ids = rows.map((r) => r.id)
      const chunks: string[][] = []
      for (let i = 0; i < ids.length; i += IN_CHUNK) chunks.push(ids.slice(i, i + IN_CHUNK))
      const parts = await Promise.all(
        chunks.map(async (chunk) => {
          const { data, error } = await supabase.from('dbo_profiles').select('id, directory_id').in('directory_id', chunk)
          if (error) throw error
          return (data ?? []) as ProfileLink[]
        }),
      )
      return { rows, profiles: parts.flat() }
    },
  }
}
