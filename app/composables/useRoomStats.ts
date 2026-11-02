// 채팅방 목록에 붙일 참여 인원·마지막 메시지 시각 — 서버 목록 API 에 없어 마스터 권한으로 직접 읽는다(QA 2026-11-02 CHAT-02)
//
// RLS 가 master 에게 `dbo_room_members`·`dbo_messages` 읽기를 연다(`member select master`·`message select master`).
// 「최근 메시지 순 정렬」은 쪽을 넘나드는 정렬이라 여기서 못 한다 — 서버 목록 API 가 해야 한다.

export type RoomStats = { members: number; lastMessageAt: string | null }

/** 멤버 행을 방별 인원으로 센다. 받은 방 중 멤버가 없는 방은 0 이다 */
export function countMembers(roomIds: string[], rows: { room_id: string }[]): Map<string, number> {
  const out = new Map<string, number>(roomIds.map((id) => [id, 0]))
  for (const r of rows) out.set(r.room_id, (out.get(r.room_id) ?? 0) + 1)
  return out
}

/** PostgREST 는 한 번에 1000행까지 준다. 단체방이 많으면 넘을 수 있어 이어 받는다 */
const PAGE = 1000

export function useRoomStats() {
  const supabase = useSupabase()

  return {
    /** 한 쪽(최대 20방)의 인원과 마지막 메시지 시각. 실패하면 던진다 — 화면이 칸만 비운다 */
    async statsFor(roomIds: string[]): Promise<Map<string, RoomStats>> {
      if (roomIds.length === 0) return new Map()
      const members: { room_id: string }[] = []
      for (let from = 0; ; from += PAGE) {
        const { data, error } = await supabase
          .from('dbo_room_members')
          .select('room_id')
          .in('room_id', roomIds)
          .order('room_id')
          .order('profile_id')
          .range(from, from + PAGE - 1)
        if (error) throw error
        members.push(...((data ?? []) as { room_id: string }[]))
        if ((data ?? []).length < PAGE) break
      }
      // 방마다 가장 최근 1건만 읽는다. 한 번에 받으면 메시지가 많은 방이 창을 다 차지한다
      const last = await Promise.all(
        roomIds.map(async (id) => {
          const { data, error } = await supabase
            .from('dbo_messages')
            .select('created_at')
            .eq('room_id', id)
            .order('created_at', { ascending: false })
            .limit(1)
          if (error) throw error
          return [id, ((data ?? [])[0] as { created_at: string } | undefined)?.created_at ?? null] as const
        }),
      )
      const counts = countMembers(roomIds, members)
      return new Map(roomIds.map((id) => [id, { members: counts.get(id) ?? 0, lastMessageAt: new Map(last).get(id) ?? null }]))
    },
  }
}
