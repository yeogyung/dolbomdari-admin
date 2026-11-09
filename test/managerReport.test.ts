// 담당자 월간 리포트 표기 규칙 테스트 — 앱 내정보 > 리포트(`db-operation-rn/lib/report.ts`)와 같은 수치가 나와야 한다(QA 2026-11-07 MGR-04 · 결정 D4)
import { describe, expect, it } from 'vitest'
import {
  attendanceRows,
  barLayout,
  formatDuration,
  formatPercent,
  isManagerReport,
  managerReportError,
  managerReportMonths,
  noticeLine,
  reportNotes,
  reportScopes,
  scopeWorksiteIds,
  type ManagerMonthlyReport,
  type ReportWorksite,
} from '../app/utils/managerReport'

describe('managerReportMonths', () => {
  // 앱 `reportMonths` 와 같다 — 운영 데이터가 있는 첫 달(2026-08) 앞은 고를 수 없다
  it('이번 달부터 거꾸로, 2026년 8월 아래로 내려가지 않는다', () => {
    expect(managerReportMonths('2026-11-09').map((m) => m.value)).toEqual(['2026-11', '2026-10', '2026-09', '2026-08'])
    expect(managerReportMonths('2026-11-09')[0]).toEqual({ label: '2026년 11월', value: '2026-11' })
  })
  it('12개월을 넘지 않는다', () => {
    expect(managerReportMonths('2028-01-01')).toHaveLength(12)
  })
})

describe('isManagerReport', () => {
  it('출석·주·공지 칸이 있어야 리포트로 본다 — 배포본이 다른 길로 덮이면 화면이 깨지지 않게 오류로 바꾼다', () => {
    expect(isManagerReport({ attendance: { total: {}, worksites: [] }, weeks: [], notices: {} })).toBe(true)
    expect(isManagerReport(null)).toBe(false)
    expect(isManagerReport({ attendance: {}, weeks: [], notices: {} })).toBe(false)
    expect(isManagerReport({ attendance: { total: {}, worksites: [] }, notices: {} })).toBe(false)
    expect(isManagerReport({ attendance: { total: {}, worksites: [] }, weeks: [] })).toBe(false)
  })
})

describe('formatPercent', () => {
  it('분모 0 은 —', () => expect(formatPercent(0, 0, 1)).toBe('—'))
  it('소수 자리', () => {
    expect(formatPercent(1, 3, 1)).toBe('33.3%')
    expect(formatPercent(1, 3, 0)).toBe('33%')
    expect(formatPercent(4, 4, 1)).toBe('100.0%')
  })
  // 앱과 같은 규칙 — 빠진 사람이 있는데 100% 로 보이면 완벽해 보인다
  it('전원이 아니면 반올림이 100 이어도 99.9 / 99 로 내린다', () => {
    expect(formatPercent(9999, 10000, 1)).toBe('99.9%')
    expect(formatPercent(999, 1000, 0)).toBe('99%')
  })
})

describe('formatDuration', () => {
  it('앱과 같은 단위로 올린다', () => {
    expect(formatDuration(null)).toBe('—')
    expect(formatDuration(30)).toBe('1분 미만')
    expect(formatDuration(47 * 60)).toBe('47분')
    expect(formatDuration(3570)).toBe('1시간')
    expect(formatDuration(6 * 3600)).toBe('6시간')
    expect(formatDuration(2 * 86400)).toBe('2일')
  })
})

describe('barLayout', () => {
  it('최대값에 맞춰 높이를 정하고 최대인 막대는 모두 강조한다', () => {
    expect(barLayout([0, 2, 4, 4], 88)).toEqual([
      { height: 0, highlight: false },
      { height: 44, highlight: false },
      { height: 88, highlight: true },
      { height: 88, highlight: true },
    ])
  })
  it('1건도 보이게 최소 높이를 준다', () => {
    expect(barLayout([1, 100], 88)[0]!.height).toBe(4)
  })
  it('모두 0 이면 강조하지 않는다', () => {
    expect(barLayout([0, 0], 88)).toEqual([
      { height: 0, highlight: false },
      { height: 0, highlight: false },
    ])
  })
})

describe('attendanceRows', () => {
  const w = (name: string, total: number, recorded: number) => ({ worksiteId: name, name, total, recorded })
  it('활동 0건 근무지는 빼고 출석률 낮은 순, 같으면 이름순으로 세운다', () => {
    const { rows, hidden } = attendanceRows([w('나', 10, 9), w('가', 10, 5), w('다', 0, 0), w('라', 4, 2)], false)
    expect(rows.map((r) => r.name)).toEqual(['가', '라', '나'])
    expect(hidden).toBe(0)
  })
  it('접으면 5곳만 보이고 나머지 수를 알린다', () => {
    const list = ['a', 'b', 'c', 'd', 'e', 'f', 'g'].map((n, i) => w(n, 10, i))
    expect(attendanceRows(list, false)).toMatchObject({ hidden: 2 })
    expect(attendanceRows(list, false).rows).toHaveLength(5)
    expect(attendanceRows(list, true)).toMatchObject({ hidden: 0 })
    expect(attendanceRows(list, true).rows).toHaveLength(7)
  })
})

describe('noticeLine', () => {
  const s = { noticeCount: 3, readable: 10, read: 7, avgReadSeconds: 47 * 60 }
  it('일반·특별은 열람률, 긴급은 확인율', () => {
    expect(noticeLine('normal', s)).toBe('열람률 70% · 평균 47분')
    expect(noticeLine('urgent', s)).toBe('확인율 70% · 평균 47분')
  })
  it('공지가 없으면 「공지 없음」', () => {
    expect(noticeLine('special', { noticeCount: 0, readable: 0, read: 0, avgReadSeconds: null })).toBe('공지 없음')
  })
})

describe('reportNotes', () => {
  const base = {
    scope: { requested: 3, counted: 3, dropped: 0 },
    notices: { untracked: 0 },
  } as unknown as ManagerMonthlyReport
  it('뺀 것이 없으면 알림 줄도 없다', () => expect(reportNotes(base)).toEqual([]))
  it('맡지 않은 근무지·발송 기록 없는 공지를 뺐다고 알린다', () => {
    const r = { ...base, scope: { requested: 3, counted: 2, dropped: 1 }, notices: { untracked: 2 } } as ManagerMonthlyReport
    expect(reportNotes(r)).toEqual(['맡지 않은 근무지 1곳은 뺐습니다.', '발송 기록이 없는 옛 공지 2건은 빼고 셌습니다.'])
  })
})

/*
 * 범위 고르기 — 앱과 같은 「사업 › 근무지」(`lib/worksiteSelection.ts`). 사업은 이름순, 사업이 없거나 이름을 못 읽은 근무지는
 * 맨 끝 「기타」, 근무지는 이름순. 「전체 사업」은 없다(앱 결정) — 처음에는 첫 사업의 전체를 본다
 */
describe('reportScopes · scopeWorksiteIds', () => {
  const site = (id: string, name: string, programId: string | null, programName: string | null): ReportWorksite => ({
    id,
    name,
    programId,
    programName,
  })
  const mine = [
    site('w3', '나동', 'p2', '노노케어'),
    site('w1', '가동', 'p2', '노노케어'),
    site('w4', '혼자', 'p1', '공익활동'),
    site('w5', '미지정', null, null),
    site('w6', '이름없음', 'p9', null),
  ]

  it('사업 이름순, 기타는 맨 끝. 근무지가 둘 이상인 사업은 「전체」를 앞에 둔다', () => {
    expect(reportScopes(mine)).toEqual([
      { value: 'w:w4', label: '공익활동 · 혼자' },
      { value: 'p:p2', label: '노노케어 전체' },
      { value: 'w:w1', label: '노노케어 · 가동' },
      { value: 'w:w3', label: '노노케어 · 나동' },
      { value: 'p:__other__', label: '기타 전체' },
      { value: 'w:w5', label: '기타 · 미지정' },
      { value: 'w:w6', label: '기타 · 이름없음' },
    ])
  })

  it('고른 범위의 근무지 id — 사업 전체면 그 사업 근무지 모두', () => {
    expect(scopeWorksiteIds('p:p2', mine)).toEqual(['w1', 'w3'])
    expect(scopeWorksiteIds('w:w4', mine)).toEqual(['w4'])
    expect(scopeWorksiteIds('p:__other__', mine)).toEqual(['w5', 'w6'])
  })

  it('목록에 없는 범위면 빈 목록 — 남의 근무지 id 를 그대로 보내지 않는다', () => {
    expect(scopeWorksiteIds('w:남의것', mine)).toEqual([])
    expect(scopeWorksiteIds('p:없는사업', mine)).toEqual([])
    expect(scopeWorksiteIds('', mine)).toEqual([])
  })

  it('맡은 근무지가 없으면 고를 것도 없다', () => expect(reportScopes([])).toEqual([]))
})

describe('managerReportError', () => {
  const err = (status: number, error?: string) => ({ status, data: error ? { error } : undefined })
  it('권한·잘못된 달·잘못된 근무지는 다시 눌러도 같아 「다시 시도」를 권하지 않는다', () => {
    expect(managerReportError(err(403, 'forbidden'))).toEqual({ message: '맡은 근무지의 리포트만 볼 수 있습니다.', retryable: false })
    expect(managerReportError(err(400, 'bad_month'))).toEqual({ message: '고를 수 없는 달입니다.', retryable: false })
    expect(managerReportError(err(400, 'too_many_worksites'))).toEqual({ message: '근무지를 다시 골라 주세요.', retryable: false })
  })
  it('그 밖의 실패는 다시 시도할 수 있다', () => {
    expect(managerReportError(err(500, 'internal'))).toEqual({
      message: '리포트를 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.',
      retryable: true,
    })
    expect(managerReportError(new Error('fetch failed')).retryable).toBe(true)
  })
  it('로그인이 끊겼으면 다시 로그인하라고 한다', () => {
    expect(managerReportError(err(401))).toEqual({ message: '로그인이 만료되었습니다. 다시 로그인해 주세요.', retryable: false })
  })
})
