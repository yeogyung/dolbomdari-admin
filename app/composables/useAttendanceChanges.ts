// 출결 변경 이력 조회 — 브라우저 supabase-js 로 dbo_attendance_changes 를 직접 읽는다(RLS: dbo_can_read_shift)
import type { AttendanceChange } from '~/types/dbo'

export function useAttendanceChanges() {
  const supabase = useSupabase()

  return {
    /** 여러 근무의 이력을 한 번에, 최근 것부터. 목록 한 페이지(최대 100건)마다 한 번 부른다 */
    async listChangesByShifts(shiftIds: string[]): Promise<AttendanceChange[]> {
      if (shiftIds.length === 0) return []
      const { data, error } = await supabase
        .from('dbo_attendance_changes')
        .select('id, shift_id, created_at, changed_by_name, changed_by_role, before, after')
        .in('shift_id', shiftIds)
        .order('created_at', { ascending: false })
      if (error) throw error
      return (data ?? []) as unknown as AttendanceChange[]
    },
  }
}
