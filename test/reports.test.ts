// 리포트 화면 표기 유틸 — 월 목록·비율·근무시간·집계 기준일
import { describe, expect, it } from 'vitest'
import { aiReplySummary, fmtMinutes, pct, recentMonths, smsResultNote, throughLabel, unconnectedNote } from '../app/utils/reports'

describe('recentMonths', () => {
  it('이번 달부터 거꾸로 12개월, 해를 넘긴다', () => {
    const m = recentMonths('2026-02-15')
    expect(m).toHaveLength(12)
    expect(m[0]).toEqual({ label: '2026년 2월', value: '2026-02' })
    expect(m[2]).toEqual({ label: '2025년 12월', value: '2025-12' })
    expect(m[11]!.value).toBe('2025-03')
  })
})

describe('pct', () => {
  it('소수 첫째 자리', () => expect(pct(1, 3)).toBe('33.3%'))
  it('분모 0 은 —', () => expect(pct(0, 0)).toBe('—'))
  it('100%', () => expect(pct(4, 4)).toBe('100%'))
})

describe('fmtMinutes', () => {
  it('시간과 분', () => expect(fmtMinutes(125)).toBe('2시간 5분'))
  it('1시간 미만', () => expect(fmtMinutes(45)).toBe('45분'))
  it('정시', () => expect(fmtMinutes(120)).toBe('2시간'))
  it('천 단위 구분', () => expect(fmtMinutes(60 * 1234)).toBe('1,234시간'))
})

describe('throughLabel', () => {
  it('M월 D일', () => expect(throughLabel('2026-10-05')).toBe('10월 5일'))
})

// QA 2026-11-02 REPORT-02 — 열람률 분모(앱 연결)에서 뺀 사람을 따로 적는다
describe('unconnectedNote', () => {
  it('받은 사람 − 앱으로 읽을 수 있는 사람', () => {
    expect(unconnectedNote({ recipients: 41, readable: 6 })).toBe('앱 미연결 35명 제외')
    expect(unconnectedNote({ recipients: 1665, readable: 5 })).toBe('앱 미연결 1,660명 제외')
  })
  it('옛 서버(받은 사람 수 없음)는 붙이지 않는다', () => {
    expect(unconnectedNote({ readable: 6 })).toBeNull()
  })
  it('뺀 사람이 없으면 붙이지 않는다', () => {
    expect(unconnectedNote({ recipients: 6, readable: 6 })).toBeNull()
    expect(unconnectedNote({ recipients: 0, readable: 0 })).toBeNull()
  })
})

// QA 2026-11-02 REPORT-01 — AI 자동응답률 = 자동 처리 / 받은 질문
describe('aiReplySummary', () => {
  it('비율과 분자·분모, 담당자 전환 수', () => {
    expect(aiReplySummary({ questions: 78, autoAnswered: 36, handedOver: 42 })).toEqual({
      rate: '46.2%',
      ratio: '36 / 78건',
      handedOver: '42건',
    })
  })
  it('질문이 0건이면 비율은 —', () => {
    expect(aiReplySummary({ questions: 0, autoAnswered: 0, handedOver: 0 })).toEqual({
      rate: '—',
      ratio: '0 / 0건',
      handedOver: '0건',
    })
  })
  it('천 단위 구분', () => {
    expect(aiReplySummary({ questions: 1200, autoAnswered: 1000, handedOver: 200 })?.ratio).toBe('1,000 / 1,200건')
  })
  it('옛 서버(ai 칸 없음)는 null — 항목을 숨긴다', () => {
    expect(aiReplySummary(undefined)).toBeNull()
  })
})

// QA 2026-11-02 ANOTICE-05 — 「문자 실패 n건」(접수 실패)만으로는 실제로 안 간 문자를 모른다
describe('smsResultNote', () => {
  const base = { rejected: 0, failed: 0, pending: 0, unknown: 0, reasons: [] as { label: string; count: number }[] }
  it('실제 실패 = 접수 실패 + 수신 실패, 사유는 많은 것부터 셋', () => {
    expect(
      smsResultNote({
        ...base,
        rejected: 2,
        failed: 4,
        reasons: [
          { label: '없는 번호(가입자 없음)', count: 3 },
          { label: '전화번호 없음', count: 2 },
          { label: '수신 거절', count: 1 },
          { label: '스팸 차단(이통사)', count: 0 },
        ],
      }),
    ).toBe('실제 실패 6(없는 번호(가입자 없음) 3 · 전화번호 없음 2 · 수신 거절 1)')
  })
  it('결과를 기다리는 문자를 덧붙인다 — 실패 0 이 「모두 도착」으로 읽히지 않게', () => {
    expect(smsResultNote({ ...base, pending: 12 })).toBe('실제 실패 0 · 결과 확인 중 12')
  })
  // 접수 응답에 그룹 id 가 없으면 서버가 바로 unknown 으로 닫는다 — 실패 모아 보기에도 안 나오니 여기서 보인다
  it('결과를 못 받은 문자도 덧붙인다', () => {
    expect(smsResultNote({ ...base, pending: 1, unknown: 5 })).toBe('실제 실패 0 · 결과 확인 중 1 · 결과 모름 5')
  })
  it('옛 서버는 칸이 없어 붙이지 않는다', () => {
    expect(smsResultNote(undefined)).toBeNull()
  })
})
