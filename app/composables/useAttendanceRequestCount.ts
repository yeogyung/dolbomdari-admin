// 「조정 요청」 메뉴의 기다림 수 — 사이드바와 조정 요청 화면이 같은 값을 본다(QA 2026-11-02 PARTNER-02)

/** 늦게 온 옛 응답이 새 수를 덮지 않게 마지막 조회만 반영한다(SPA 라 모듈 변수로 충분하다) */
let sequence = 0

export function useAttendanceRequestCount() {
  const api = useDboAdmin()
  /** 기다리는 요청 수. 모르면 null — 메뉴는 숨긴다 */
  const count = useState<number | null>('attendance-request-pending', () => null)

  /** `GET /attendance-requests?status=pending` 의 total 을 다시 센다 */
  async function refresh() {
    const current = ++sequence
    try {
      const res = await api.listAttendanceRequests({ status: 'pending', size: 1 })
      if (current === sequence) count.value = res.total
    } catch {
      // 옛 서버(404)·권한·일시 오류면 수를 숨긴다. 메뉴의 수는 편의이고, 조정 요청 화면이 못 읽은 까닭을 따로 알린다
      if (current === sequence) count.value = null
    }
  }

  /** 화면이 같은 조건(기다림·전체 근무지)의 목록을 읽었으면 그 total 을 그대로 쓴다 — 한 번 덜 부른다 */
  function set(total: number) {
    sequence++
    count.value = total
  }

  return { count, refresh, set }
}
