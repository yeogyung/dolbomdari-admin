// 월간 리포트 화면의 표기 유틸 — 월 선택 목록·비율·근무시간·집계 기준일 (서버는 원값만 준다)

/** 이번 달(서울 오늘 기준)부터 거꾸로 count 개월. 서버 parseMonth 와 같은 12개월 창 */
export function recentMonths(today: string, count = 12): { label: string; value: string }[] {
  let y = Number(today.slice(0, 4))
  let m = Number(today.slice(5, 7))
  const out: { label: string; value: string }[] = []
  for (let i = 0; i < count; i++) {
    out.push({ label: `${y}년 ${m}월`, value: `${y}-${String(m).padStart(2, '0')}` })
    m--
    if (m === 0) {
      m = 12
      y--
    }
  }
  return out
}

/** 비율 — 분모가 0 이면 「—」(0% 로 쓰면 나빴던 것처럼 읽힌다) */
export function pct(n: number, d: number): string {
  if (!d) return '—'
  const v = Math.round((n / d) * 1000) / 10
  return `${v}%`
}

/** 분 → 「N시간 M분」 */
export function fmtMinutes(min: number): string {
  const h = Math.floor(min / 60)
  const m = min % 60
  if (h === 0) return `${m}분`
  return m === 0 ? `${h.toLocaleString()}시간` : `${h.toLocaleString()}시간 ${m}분`
}

/** 'YYYY-MM-DD' → 'M월 D일' */
export function throughLabel(through: string): string {
  return `${Number(through.slice(5, 7))}월 ${Number(through.slice(8, 10))}일`
}
