// 휴무 관리 화면 규칙 테스트 — 앱(db-operation-rn/__tests__/holidays.test.ts)과 같은 기대값 + 근무지 검색
import { describe, expect, it } from 'vitest'
import {
  alertHeadline,
  cancelNotice,
  channelLabel,
  contactCount,
  createNotice,
  filterWorksites,
  forecastOf,
  forecastSiteId,
  forecastSites,
  hitHours,
  holidayErrorMessage,
  holidayErrorOf,
  hoursLabel,
  nextDate,
  pendingAlerts,
  rainLabel,
  shortDate,
  sinceLabel,
  type HolidayOverview,
  type HolidayWarning,
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
            { hour: 11, temp: 29, rain: 0, hit: false },
            { hour: 12, temp: 30, rain: 0, hit: true },
            { hour: 13, temp: 31, rain: 0, hit: true },
            { hour: 16, temp: 30, rain: 0, hit: true },
          ],
        },
      ],
      warnings: [],
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
      weather: [{ grid: '59,127', kind: 'cold', days: [], warnings: [] }],
    })
    expect(alertHeadline(o)?.detail).toBe('10/27(화)·10/28(수) 영하 10도 이하')
  })

  it('그날 예보 칸이 없으면 기온을 지어내지 않는다', () => {
    const o = overview([site('a')], {
      weather: [{ grid: '59,127', kind: 'heat', days: [], warnings: [] }],
    })
    expect(alertHeadline(o)?.detail).toBe('10/28(수) 30도 이상 예보')
  })

  const warning = (kind: HolidayWarning['kind'], name: string): HolidayWarning => ({
    kind,
    name,
    zone: '서울서북권',
    areaCode: 'L1100400',
    since: '2026-10-27T02:00:00.000Z',
  })
  const mildDay = {
    date: '2026-10-28',
    low: 1,
    high: 8,
    hours: [{ hour: 9, temp: 3, rain: 0, hit: false }],
  }

  it('비면 시간당 10mm 넘는 시각을 말한다', () => {
    const o = overview([site('a', { alert: 'rain' })], {
      weather: [
        {
          grid: '59,127',
          kind: 'rain',
          days: [
            {
              date: '2026-10-28',
              low: 15,
              high: 19,
              hours: [
                { hour: 9, temp: 17, rain: 12, hit: true },
                { hour: 10, temp: 17, rain: 15, hit: true },
              ],
            },
          ],
          warnings: [],
        },
      ],
    })
    expect(alertHeadline(o)).toEqual({
      kind: 'rain',
      title: '내일 많은 비 예보',
      detail: '10/28(수) 9~10시 시간당 10mm 이상',
      count: 1,
    })
  })

  it('특보만으로 조건이면 특보를 말한다(앱과 같다)', () => {
    const cold = overview([site('a', { alert: 'cold' })], {
      weather: [
        { grid: '59,127', kind: 'cold', days: [mildDay], warnings: [warning('cold', '한파주의보')] },
      ],
    })
    expect(alertHeadline(cold)?.detail).toBe('서울서북권 한파주의보 발효 중')
    const heat = overview([site('a')], {
      weather: [
        { grid: '59,127', kind: 'heat', days: [mildDay], warnings: [warning('heat', '폭염경보')] },
      ],
    })
    expect(alertHeadline(heat)?.detail).toBe('서울서북권 폭염경보 발효 중')
  })

  it('모르는 종류(서버가 새로 더한)는 다른 날씨로 지어내지 않는다', () => {
    const o = overview([site('a', { alert: 'dust' as never })], {
      weather: [{ grid: '59,127', kind: 'dust' as never, days: [], warnings: [] }],
    })
    expect(alertHeadline(o)?.title).toBe('내일 날씨 예보')
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

describe('직접 알릴 분 · 특보 · 강수량 칸(앱과 같다)', () => {
  it('받는 방법을 사람 말로', () => {
    expect(channelLabel({ channel: 'none' })).toBe('앱 미설치')
    expect(channelLabel({ channel: 'noPush' })).toBe('앱 알림 꺼짐')
    // 명단에 push 가 섞이는 것은 이번 알림이 실패했을 때다
    expect(channelLabel({ channel: 'push' })).toBe('앱 알림 실패')
  })
  // QA 2026-11-02 PUSH-05 — 로그아웃과 알림 꺼짐을 가른다(서버 2026-11-04 channelDetail)
  it('더 가른 값이 있으면 그것으로 적는다', () => {
    expect(channelLabel({ channel: 'noPush', channelDetail: 'loggedOut' })).toBe('로그아웃(기기 없음)')
    expect(channelLabel({ channel: 'noPush', channelDetail: 'noPush' })).toBe('앱 알림 꺼짐')
    expect(channelLabel({ channel: 'none', channelDetail: 'none' })).toBe('앱 미설치')
    expect(channelLabel({ channel: 'push', channelDetail: 'push' })).toBe('앱 알림 실패')
  })
  it('근무지를 가로질러 사람 수를 센다', () => {
    const p = (id: string) => ({ directoryId: id, name: id, phone: null, channel: 'none' as const })
    expect(
      contactCount([
        { worksiteId: 'a', worksite: 'A', people: [p('1'), p('2')] },
        { worksiteId: 'b', worksite: 'B', people: [p('3')] },
      ]),
    ).toBe(3)
    expect(contactCount(null)).toBe(0)
  })
  it('특보 발효 시각은 서울 시각, 분이 있을 때만 분', () => {
    expect(sinceLabel('2026-10-27T02:00:00.000Z')).toBe('10/27 11시')
    expect(sinceLabel('2026-10-27T15:30:00.000Z')).toBe('10/28 0시 30분')
    expect(sinceLabel('')).toBe('')
  })
  it('강수량 칸 — 없으면 줄표, 1mm 미만은 <1', () => {
    expect(rainLabel(0)).toBe('–')
    expect(rainLabel(0.5)).toBe('<1')
    expect(rainLabel(12)).toBe('12')
  })
})

// QA 2026-11-02 ADM-06 · 결정 D5 — 예보에 근무지 고르기와 기준 근무지 표시(어드민만)
describe('예보 근무지 고르기', () => {
  const weather = (grid: string, kind: HolidayOverview['weather'][number]['kind']) => ({
    grid,
    kind,
    days: [],
    warnings: [],
  })
  const o = overview(
    [
      site('a', { name: '늘봄어린이집', grid: '60,127', alert: null }),
      site('b', { name: '테스트2', grid: '59,127', alert: 'heat' }),
      site('c', { name: '위치 없음', grid: null, alert: null }),
    ],
    { weather: [weather('60,127', null), weather('59,127', 'heat')] },
  )

  it('격자가 없는 근무지는 고를 수 없다 — 예보가 없다', () => {
    expect(forecastSites(o).map((s) => s.id)).toEqual(['a', 'b'])
  })
  it('같은 이름이 둘 이상이면 사업 이름을 붙인다', () => {
    const dup = overview([
      site('a', { name: '경로당', program: '공익형' }),
      site('b', { name: '경로당', program: '사회서비스형' }),
      site('c', { name: '복지관', program: '공익형' }),
    ])
    expect(forecastSites(dup).map((s) => s.label)).toEqual(['경로당 (공익형)', '경로당 (사회서비스형)', '복지관'])
  })
  it('처음에는 조건이 남은 근무지를 고른다', () => {
    expect(forecastSiteId(o, null)).toBe('b')
  })
  it('휴무로 정한 곳은 조건이 남은 곳이 아니다 — 첫 근무지', () => {
    const done = overview(
      [site('a', { alert: null }), site('b', { alert: 'heat', holiday: { id: 'h', reason: 'heat', createdAt: '' } })],
    )
    expect(forecastSiteId(done, null)).toBe('a')
  })
  it('고르던 곳이 새 목록에도 있으면 그대로, 없으면 다시 고른다', () => {
    expect(forecastSiteId(o, 'a')).toBe('a')
    expect(forecastSiteId(o, 'c')).toBe('b')
    expect(forecastSiteId(o, 'gone')).toBe('b')
  })
  it('근무가 없는 날은 예보가 와도 고를 근무지가 없다 — 어느 근무지 예보인지 말할 수 없다', () => {
    const empty = overview([])
    expect(empty.weather.length).toBeGreaterThan(0)
    expect(forecastSiteId(empty, null)).toBeNull()
    expect(forecastOf(empty, forecastSiteId(empty, null))).toBeNull()
  })
  it('고른 근무지 격자의 예보를 준다', () => {
    expect(forecastOf(o, 'a')?.grid).toBe('60,127')
    expect(forecastOf(o, 'b')?.kind).toBe('heat')
    expect(forecastOf(o, 'c')).toBeNull()
    expect(forecastOf(o, null)).toBeNull()
  })
})

// 기간 휴무(결정 D20, 2026-11-09)
import { rangeCancelNotice, rangeCreateNotice, rangeMaxEnd } from '../app/utils/holidays'

describe('기간 휴무', () => {
  it('끝날은 시작일 포함 31일까지', () => {
    expect(rangeMaxEnd('2026-11-10')).toBe('2026-12-10')
  })
  it('지정 결과 — 쉬는 날 수와 이미 휴무였던 날', () => {
    const text = rangeCreateNotice({
      created: [{ worksiteId: 'w1', rangeId: 'r1', from: '2026-11-10', to: '2026-11-12', dates: ['2026-11-10', '2026-11-12'], people: 3 }],
      skipped: [{ worksiteId: 'w1', date: '2026-11-11', reason: 'exists' }],
      push: { pushed: 3, failed: 0, aborted: false },
    })
    expect(text.startsWith('1곳 · 쉬는 날 2일을 휴무로 정했습니다. 이미 휴무였던 1일은 그대로 두었습니다.')).toBe(true)
  })
  it('취소 결과 — 오늘·지난 날은 그대로', () => {
    expect(
      rangeCancelNotice('늘봄어린이집', {
        canceled: true,
        dates: ['2026-11-11', '2026-11-12'],
        skipped: [{ date: '2026-11-10', reason: 'not_editable' }],
        push: { pushed: 0, failed: 0, aborted: false },
      }),
    ).toBe('늘봄어린이집 기간 휴무 2일을 취소했습니다. 오늘·지난 1일은 그대로입니다.')
  })
})
