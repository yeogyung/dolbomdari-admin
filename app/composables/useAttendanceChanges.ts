// 출결 변경 이력 조회 — 브라우저 supabase-js 로 dbo_attendance_changes 를 직접 읽는다(RLS: dbo_can_read_shift)
import type { AttendanceChange } from '~/types/dbo'

/** PostgREST 가 한 번에 주는 최대 행 수(서버 `max_rows`) */
const PAGE = 1000

export function useAttendanceChanges() {
  const supabase = useSupabase()

  return {
    /**
     * 여러 근무의 이력을 한 번에, 최근 것부터. 목록 한 페이지(최대 100건)마다 한 번 부른다.
     *
     * **끝까지 이어 받는다.** 서버는 한 번에 1000행까지만 준다(`max_rows`). 잘리면 오래된 근무의 이력이 통째로
     * 빠져 「수정됨」이 틀리고, 동시 수정 검사가 그 근무를 매번 충돌로 막았다(QA 2026-11-02 ADM-02 리뷰).
     */
    async listChangesByShifts(shiftIds: string[]): Promise<AttendanceChange[]> {
      if (shiftIds.length === 0) return []
      const out: AttendanceChange[] = []
      for (let from = 0; ; from += PAGE) {
        const { data, error } = await supabase
          .from('dbo_attendance_changes')
          .select('id, shift_id, created_at, changed_by_name, changed_by_role, before, after')
          .in('shift_id', shiftIds)
          .order('created_at', { ascending: false })
          .order('id')
          .range(from, from + PAGE - 1)
        if (error) throw error
        out.push(...((data ?? []) as unknown as AttendanceChange[]))
        if ((data ?? []).length < PAGE) return out
      }
    },
  }
}
