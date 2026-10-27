// 휴무 관리 화면 규칙 테스트 — 앱(db-operation-rn/__tests__/holidays.test.ts)과 같은 기대값 + 근무지 검색
import { describe, expect, it } from 'vitest'
import {
  alertHeadline,
  cancelNotice,
  createNotice,
  filterWorksites,
  hitHours,
  holidayErrorMessage,
  holidayErrorOf,
  hoursLabel,
  nextDate,
  pendingAlerts,
  shortDate,
  type HolidayOverview,
  type HolidayWorksite,
} from '../app/utils/holidays'

const site = (id: string, over: Partial<HolidayWorksite> = {}): HolidayWorksite => ({
  id,
  name: id,
  program: null,
  grid: '59,127',
  alert: 'heat',
  people: 3,
  holiday: null,
  ...over,
})

const overview = (
  worksites: HolidayWorksite[],
  over: Partial<HolidayOverview> = {},
): HolidayOverview => ({
  date: '2026-10-28',
  today: '2026-10-27',
  editable: true,
  weather: [
    {
      grid: '59,127',
      kind: 'heat',
      days: [
        {
          date: '2026-10-28',
          low: 22,
          high: 32,
          hours: [
            { hour: 11, temp: 29, hit: false },
            { hour: 12, temp: 30, hit: true },
            { hour: 13, temp: 31, hit: true },
            { hour: 16, temp: 30, hit: true },
          ],
        },
      ],
    },
  ],
  worksites,
  upcoming: [],
  ...over,
})

describe('pendingAlerts', () => {
  it('조건이 있고 아직 휴무가 아니며 근무가 있는 근무지만 남긴다', () => {
    const list = [
      site('a'),
      site('b', { holiday: { id: 'h', reason: 'heat', createdAt: '' } }),
      site('c', { people: 0 }),
      site('d', { alert: null }),
    ]
    expect(pendingAlerts(overview(list)).map((s) => s.id)).toEqual(['a'])
  })
})

describe('alertHeadline', () => {
  it('폭염이면 날짜·시각·근무지 수를 말한다', () => {
    expect(alertHeadline(overview([site('a'), site('b')]))).toEqual({
      kind: 'heat',
      title: '내일 폭염 예보',
      detail: '10/28(수) 12~13시, 16시 30도 이상',
      count: 2,
    })
  })

  it('한파면 이틀을 말한다', () => {
    const o = overview([site('a', { alert: 'cold' })], {
      weather: [{ grid: '59,127', kind: 'cold', days: [] }],
    })
    expect(alertHeadline(o)?.detail).toBe('10/27(화)·10/28(수) 영하 10도 이하')
  })

  it('그날 예보 칸이 없으면 기온을 지어내지 않는다', () => {
    const o = overview([site('a')], { weather: [{ grid: '59,127', kind: 'heat', days: [] }] })
    expect(alertHeadline(o)?.detail).toBe('10/28(수) 30도 이상 예보')
  })

  it('남은 조건 근무지가 없으면 없다', () => {
    expect(alertHeadline(overview([site('a', { alert: null })]))).toBeNull()
  })
})

describe('날짜·시각 문구', () => {
  it('hoursLabel 은 이어진 시각을 묶는다(서버와 같은 결과)', () => {
    expect(hoursLabel([12, 13, 14, 16])).toBe('12~14시, 16시')
    expect(hoursLabel([])).toBe('')
  })
  it('hitHours 는 강조할 시각만', () => {
    expect(hitHours(overview([]).weather[0]!.days[0]!)).toEqual([12, 13, 16])
  })
  it('shortDate · nextDate', () => {
    expect(shortDate('2026-11-01')).toBe('11/1(일)')
    expect(nextDate('2026-10-31')).toBe('2026-11-01')
  })
})

describe('filterWorksites', () => {
  const list = [
    site('w1', { name: '북아현 경로당', program: '서대문시니어클럽' }),
    site('w2', { name: '홍제 어린이집', program: '홍은 사업' }),
  ]
  it('빈 검색어면 전부', () => {
    expect(filterWorksites(list, '  ')).toHaveLength(2)
  })
  it('이름·사업으로 찾고 띄어쓰기를 무시한다', () => {
    expect(filterWorksites(list, '북아현경로').map((s) => s.id)).toEqual(['w1'])
    expect(filterWorksites(list, '홍은').map((s) => s.id)).toEqual(['w2'])
  })
})

describe('holidayErrorMessage', () => {
  it('서버 코드를 어드민 말투로 바꾼다', () => {
    expect(holidayErrorMessage('not_editable')).toBe('오늘과 지난 날은 바꿀 수 없습니다.')
    expect(holidayErrorMessage('already_canceled')).toBe('이미 취소된 휴무입니다.')
    expect(holidayErrorMessage('forbidden')).toBe('맡은 근무지만 휴무로 정할 수 있습니다.')
    expect(holidayErrorMessage(undefined)).toContain('새로고침해서 결과를 확인')
  })
  it('$fetch 오류에서 코드와 401 을 꺼낸다', () => {
    expect(holidayErrorOf({ status: 409, data: { error: 'already_canceled' } })).toBe(
      '이미 취소된 휴무입니다.',
    )
    expect(holidayErrorOf({ statusCode: 401 })).toBe('로그인이 만료되었습니다. 다시 로그인해 주세요.')
  })
})

describe('결과 문구', () => {
  const push = { pushed: 2, failed: 0, aborted: false }
  it('지정 — 앱 알림이 몇 건 나갔는지와 나머지는 직접 알리라는 말', () => {
    expect(
      createNotice({
        created: [
          { worksiteId: 'a', holidayId: 'h1', people: 10 },
          { worksiteId: 'b', holidayId: 'h2', people: 5 },
        ],
        skipped: [{ worksiteId: 'c', reason: 'exists' }],
        push,
      }),
    ).toBe(
      '2곳을 휴무로 정했습니다. 1곳은 이미 휴무였습니다. 시니어 15명 중 앱 알림 2건이 나갔습니다. ' +
        '앱 알림을 못 받는 분께는 직접 알려 주세요.',
    )
  })
  it('알림 단계가 멈췄으면 그렇게 말한다', () => {
    expect(
      createNotice({
        created: [{ worksiteId: 'a', holidayId: 'h1', people: 3 }],
        skipped: [],
        push: { pushed: 0, failed: 0, aborted: true },
      }),
    ).toBe('1곳을 휴무로 정했습니다. 시니어 알림을 보내지 못했습니다. 직접 알려 주세요.')
  })
  it('취소 — 같은 규칙', () => {
    expect(cancelNotice('북아현 경로당', 2, { pushed: 2, failed: 0, aborted: false })).toBe(
      '북아현 경로당 휴무를 취소했습니다. 시니어 2명 중 앱 알림 2건이 나갔습니다.',
    )
  })
})
