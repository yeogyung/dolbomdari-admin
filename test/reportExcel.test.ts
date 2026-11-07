// 월간 리포트 엑셀 시트 구성 테스트 — 파일 이름, 요약 지표, 표마다 한 장, 빈 표 생략(QA 2026-11-07 ADMIN-08)
import { describe, expect, it } from 'vitest'
import { reportFileName, reportSheets } from '../app/utils/reportExcel'
import { sheetOf } from '../app/utils/excel'
import type { MonthlyReport } from '../app/types/dbo'

const stats = (noticeCount: number, read: number, readable: number) => ({ noticeCount, read, readable, avgReadSeconds: 600 })

function sample(over: Partial<MonthlyReport['attendance']> = {}, extra: Partial<MonthlyReport> = {}): MonthlyReport {
  return {
    month: '2026-11',
    firstDay: '2026-11-01',
    through: '2026-11-06',
    attendance: {
      shifts: 10,
      byStatus: { present: 6, late: 1, absent: 1, excused: 1, missing: 1, other: 0 },
      checkedIn: 7,
      workedMinutes: 125,
      workedCount: 5,
      byMethod: { qr: 6, manual: 1, other: 0 },
      daily: [{ date: '2026-11-03', shifts: 10, checkedIn: 7, absent: 1, missing: 1 }],
      byWorksite: [{ worksiteId: 'w1', name: '동방점', programId: 'p1', shifts: 10, checkedIn: 7, late: 1, absent: 1, excused: 1, missing: 1 }],
      byProgram: [{ programId: 'p1', name: '시니어카페', shifts: 10, checkedIn: 7, late: 1, absent: 1, excused: 1, missing: 1 }],
      topAbsentees: [{ directoryId: 'd1', name: '홍길동', worksiteName: '동방점', shifts: 4, absent: 1, missing: 1 }],
      ...over,
    },
    people: { activeSeniors: 20, activeManagers: 2, activeWorksites: 3, seniorsWithApp: 15, workedSeniors: 9, newSeniors: 1 },
    notices: {
      untracked: 0,
      normal: stats(2, 8, 10),
      special: stats(0, 0, 0),
      urgent: stats(1, 5, 5),
      delivery: { sms: { accepted: 3, failed: 0 }, push: { accepted: 12, failed: 1 } },
      lowest: [{ id: 'n1', title: '안내', publishedAt: '2026-11-02T01:00:00Z', readable: 10, read: 8 }],
    },
    ...extra,
  }
}

const valueOf = (rows: Record<string, unknown>[], item: string) => rows.find((r) => r.item === item)?.value

describe('reportFileName', () => {
  it('돌봄다리_리포트_YYYY-MM.xlsx', () => {
    expect(reportFileName('2026-11')).toBe('돌봄다리_리포트_2026-11.xlsx')
  })
})

describe('reportSheets', () => {
  it('요약 한 장과 표마다 한 장', () => {
    expect(reportSheets(sample()).map((s) => s.name)).toEqual([
      '요약',
      '근무지별',
      '사업별',
      '일별',
      '결석·미기록 상위',
      '열람률 낮은 공지',
    ])
  })
  it('요약에 화면의 지표를 담는다', () => {
    const rows = reportSheets(sample())[0]!.rows
    expect(valueOf(rows, '집계 기간')).toBe('2026-11-01 ~ 2026-11-06')
    expect(valueOf(rows, '예정 근무')).toBe(10)
    expect(valueOf(rows, '출근 기록률')).toBe('70%')
    expect(valueOf(rows, '총 근무시간')).toBe('2시간 5분')
    expect(valueOf(rows, '앱 가입률')).toBe('75%')
    expect(valueOf(rows, '일반 공지 열람률')).toBe('80%')
    // 분모가 0 이면 화면처럼 「—」
    expect(valueOf(rows, '특별 공지 열람률')).toBe('—')
    // 옛 서버(ai 칸 없음)면 AI 줄을 넣지 않는다
    expect(valueOf(rows, 'AI 자동응답률')).toBeUndefined()
  })
  it('AI·문자 실제 결과가 오면 요약에 붙인다', () => {
    const r = sample(
      {},
      { ai: { questions: 4, autoAnswered: 3, handedOver: 1 } },
    )
    r.notices.smsResults = { messages: 3, rejected: 1, delivered: 1, failed: 1, pending: 0, unknown: 0, reasons: [] }
    const rows = reportSheets(r)[0]!.rows
    expect(valueOf(rows, 'AI 자동응답률')).toBe('75%')
    expect(valueOf(rows, '문자 실제 실패(접수 실패 + 수신 실패)')).toBe(2)
  })
  it('근무지별 표에 사업 이름과 출근 기록률을 붙인다', () => {
    const ws = reportSheets(sample()).find((s) => s.name === '근무지별')!
    expect(ws.rows[0]).toMatchObject({ name: '동방점', program: '시니어카페', rate: '70%' })
    expect(ws.columns.map((c) => c.label)).toContain('출근 기록률')
  })
  it('빈 표는 시트를 만들지 않는다', () => {
    const r = sample({ byWorksite: [], byProgram: [], topAbsentees: [], daily: [] })
    r.notices.lowest = []
    expect(reportSheets(r).map((s) => s.name)).toEqual(['요약'])
  })
  it('시트 이름은 엑셀 제한(31자, 금지 글자 없음)을 지키고 모두 시트로 만들어진다', () => {
    for (const s of reportSheets(sample())) {
      expect(s.name.length).toBeLessThanOrEqual(31)
      expect(s.name).not.toMatch(/[\\/?*[\]:]/)
      expect(sheetOf(s.rows, s.columns).A1?.v).toBe(s.columns[0]!.label)
    }
  })
})
