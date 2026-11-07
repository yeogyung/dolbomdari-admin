// 채팅방 참여자 후보·명단 조회 — 어드민 명부에 프로필 id 가 없어 마스터 권한으로 dbo_profiles·dbo_room_members 를 직접 읽는다(QA 2026-11-02 CHAT-01 · CHAT-03)
//
// RLS `profile select master`·`member select master` 가 master 에게 읽기를 연다(서버 2026-11-04 계약 3a묶음 4·5번). 지금 운영에도
// 있는 정책이라 옛 서버에서도 명단은 보인다 — 막히는 것은 방 만들기·참여자 추가·내보내기 경로뿐이다.
import type { ChatRoom, DirectoryEntry, PersonRoom } from '~/types/dbo'
import { fetchAllPages } from '~/utils/paging'
import { personRooms } from '~/utils/personActivity'

/** `directory_id=in.(…)` 한 번에 싣는 id 수. 주소 길이(약 8KB)를 넘지 않게 나눈다 */
const IN_CHUNK = 100

export type ProfileLink = { id: string; directory_id: string }

/** 방 멤버 한 줄. 계정이 지워졌으면 profile 이 null 일 수 있다 */
export type RoomMemberRow = {
  profile_id: string
  joined_at: string
  profile: { name: string; role: string } | null
}

/** PostgREST 는 한 번에 1000행까지 준다(useRoomStats 와 같다) */
const PAGE = 1000

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

    /** 방의 지금 참여자 — 들어온 순. 실패하면 던진다 */
    async members(roomId: string): Promise<RoomMemberRow[]> {
      const out: RoomMemberRow[] = []
      for (let from = 0; ; from += PAGE) {
        const { data, error } = await supabase
          .from('dbo_room_members')
          .select('profile_id, joined_at, profile:dbo_profiles(name, role)')
          .eq('room_id', roomId)
          .order('joined_at')
          .order('profile_id')
          .range(from, from + PAGE - 1)
        if (error) throw error
        out.push(...((data ?? []) as unknown as RoomMemberRow[]))
        if ((data ?? []).length < PAGE) break
      }
      return out
    },

    /**
     * 한 사람(명부)이 들어가 있는 방(QA 2026-11-07 ADMIN-03). 어드민 방 목록 API 는 방 이름으로만 찾아서
     * 명부 → 앱 계정(dbo_profiles) → 멤버(dbo_room_members) 순으로 직접 읽는다. 앱 계정이 없으면 []. 실패하면 던진다
     */
    async roomsOf(directoryId: string): Promise<PersonRoom[]> {
      const { data: profiles, error } = await supabase.from('dbo_profiles').select('id').eq('directory_id', directoryId)
      if (error) throw error
      const ids = ((profiles ?? []) as { id: string }[]).map((p) => p.id)
      if (!ids.length) return []
      const rows: { room: PersonRoom | null }[] = []
      for (let from = 0; ; from += PAGE) {
        const { data, error: memberError } = await supabase
          .from('dbo_room_members')
          .select('room:dbo_rooms(id, title, kind, status, ai_enabled)')
          .in('profile_id', ids)
          .order('room_id')
          .order('profile_id')
          .range(from, from + PAGE - 1)
        if (memberError) throw memberError
        rows.push(...((data ?? []) as unknown as { room: PersonRoom | null }[]))
        if ((data ?? []).length < PAGE) break
      }
      return personRooms(rows)
    },

    /** 방 하나 — 채팅방 화면이 목록 쪽에 없는 방을 바로 열 때 쓴다(명부 상세의 바로가기·이미 있던 두 사람 방). 없으면 null */
    async room(roomId: string): Promise<ChatRoom | null> {
      const { data, error } = await supabase
        .from('dbo_rooms')
        .select('id, title, kind, status, ai_enabled, created_by, created_at')
        .eq('id', roomId)
        .maybeSingle()
      if (error) throw error
      return (data as ChatRoom | null) ?? null
    },
  }
}
