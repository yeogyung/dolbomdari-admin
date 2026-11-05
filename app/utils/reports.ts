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

/**
 * 열람률 분모에서 뺀 사람 — 「앱 미연결 n명 제외」(QA 2026-11-02 REPORT-02). 받은 사람(recipients) 중 앱으로
 * 읽을 수 없는 사람(readable 밖)이다. 옛 서버는 recipients 가 없어 붙이지 않고, 뺀 사람이 없어도 붙이지 않는다.
 */
export function unconnectedNote(s: { recipients?: number; readable: number }): string | null {
  if (typeof s.recipients !== 'number') return null
  const n = s.recipients - s.readable
  return n > 0 ? `앱 미연결 ${n.toLocaleString()}명 제외` : null
}

/**
 * AI 자동응답률 항목(QA 2026-11-02 REPORT-01, 결정 S9) — 자동 처리 ÷ 받은 질문과 그 분자·분모, 담당자 전환 수.
 * 질문이 0건이면 비율은 「—」(`pct`). 옛 서버는 `ai` 칸이 없어 null — 화면이 항목을 숨긴다.
 */
export function aiReplySummary(
  ai: { questions: number; autoAnswered: number; handedOver: number } | undefined,
): { rate: string; ratio: string; handedOver: string } | null {
  if (!ai) return null
  return {
    rate: pct(ai.autoAnswered, ai.questions),
    ratio: `${ai.autoAnswered.toLocaleString()} / ${ai.questions.toLocaleString()}건`,
    handedOver: `${ai.handedOver.toLocaleString()}건`,
  }
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

/**
 * 「문자 접수 · 실패」 줄 끝의 실제 결과(QA 2026-11-02 ANOTICE-05) — 실제 실패(접수 실패 + 수신 실패)와 사유 상위 3.
 * 결과를 기다리는 문자·72시간 안에 결과를 못 받은 문자가 있으면 덧붙인다(실패 0 이 「모두 도착」으로 읽히지 않게).
 * 옛 서버는 `smsResults` 가 없어 null
 */
export function smsResultNote(
  s:
    | { rejected: number; failed: number; pending: number; unknown: number; reasons: { label: string; count: number }[] }
    | undefined,
): string | null {
  if (!s) return null
  const reasons = s.reasons
    .slice(0, 3)
    .map((r) => `${r.label} ${r.count.toLocaleString()}`)
    .join(' · ')
  let note = `실제 실패 ${(s.failed + s.rejected).toLocaleString()}${reasons ? `(${reasons})` : ''}`
  if (s.pending) note += ` · 결과 확인 중 ${s.pending.toLocaleString()}`
  if (s.unknown) note += ` · 결과 모름 ${s.unknown.toLocaleString()}`
  return note
}
