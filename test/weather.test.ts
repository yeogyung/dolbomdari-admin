// 대시보드 날씨 카드 규칙 테스트 — 앱(db-operation-rn/__tests__/weather.test.ts)과 같은 기대값
import { describe, expect, it } from 'vitest'
import {
  buildHourly,
  currentSlot,
  dayExtremes,
  dayName,
  daySummaries,
  hourRow,
  isWet,
  forecastIssueText,
  issueLabel,
  latestBaseAt,
  savedLabel,
  seoulDates,
  weatherKind,
  weatherLabel,
  wetHoursLabel,
  type ForecastRow,
} from '../app/utils/weather'

/** 서울 시각 'YYYY-MM-DD HH' → DB 가 주는 UTC ISO */
const kst = (s: string) => new Date(`${s.replace(' ', 'T')}:00:00+09:00`).toISOString()

function hour(at: string, v: { TMP?: string; SKY?: string; PTY?: string; POP?: string }): ForecastRow[] {
  return Object.entries(v).map(([category, value]) => ({ fcst_at: kst(at), category, value: value! }))
}

describe('weatherKind', () => {
  it('강수 형태가 하늘 상태보다 앞선다', () => {
    expect(weatherKind('1', '1', 12)).toBe('rain')
    expect(weatherKind('4', '2', 12)).toBe('sleet')
    expect(weatherKind('4', '3', 12)).toBe('snow')
    expect(weatherKind('3', '4', 12)).toBe('shower')
  })
  it('강수가 없으면 하늘 상태를 따른다', () => {
    expect(weatherKind('1', '0', 12)).toBe('clear')
    expect(weatherKind('3', '0', 12)).toBe('partly')
    expect(weatherKind('4', '0', 12)).toBe('cloudy')
  })
  it('밤(19~6시) 맑음은 달이다 — 다른 날씨는 밤에도 같다', () => {
    expect(weatherKind('1', '0', 19)).toBe('clear-night')
    expect(weatherKind('1', '0', 5)).toBe('clear-night')
    expect(weatherKind('1', '0', 6)).toBe('clear-night')
    expect(weatherKind('1', '0', 7)).toBe('clear')
    expect(weatherKind('1', '0', 18)).toBe('clear')
    expect(weatherKind('4', '0', 23)).toBe('cloudy')
  })
  it('모르는 코드는 흐림으로 본다 — 빈 아이콘보다 낫다', () => {
    expect(weatherKind(null, null, 12)).toBe('cloudy')
    expect(weatherKind('9', '0', 12)).toBe('cloudy')
  })
  it('종류마다 우리말 이름이 있다', () => {
    expect(weatherLabel('clear-night')).toBe('맑음')
    expect(weatherLabel('sleet')).toBe('비/눈')
  })
})

describe('buildHourly', () => {
  it('카테고리 행을 시각별 한 칸으로 묶고 시간순으로 정렬한다', () => {
    const rows = [
      ...hour('2026-10-22 14', { TMP: '15', SKY: '1', PTY: '0', POP: '0' }),
      ...hour('2026-10-22 13', { TMP: '14', SKY: '3', PTY: '0', POP: '20' }),
    ]
    const slots = buildHourly(rows)
    expect(slots.map((s) => [s.date, s.hour, s.temp, s.pop, s.kind])).toEqual([
      ['2026-10-22', 13, 14, 20, 'partly'],
      ['2026-10-22', 14, 15, 0, 'clear'],
    ])
  })
  it('기온이 없는 시각은 버린다 — 빈 칸을 그리지 않는다', () => {
    const rows = [...hour('2026-10-22 13', { SKY: '1', PTY: '0' }), ...hour('2026-10-22 14', { TMP: '9' })]
    const slots = buildHourly(rows)
    expect(slots).toHaveLength(1)
    expect(slots[0].hour).toBe(14)
    // 하늘 상태가 없으면 흐림, 강수 확률이 없으면 null
    expect(slots[0].kind).toBe('cloudy')
    expect(slots[0].pop).toBeNull()
  })
  it('자정을 넘기면 서울 날짜가 바뀐다', () => {
    const slots = buildHourly(hour('2026-10-23 00', { TMP: '8', SKY: '1', PTY: '0' }))
    expect([slots[0].date, slots[0].hour, slots[0].kind]).toEqual(['2026-10-23', 0, 'clear-night'])
  })
})

describe('currentSlot', () => {
  const slots = buildHourly([
    ...hour('2026-10-22 11', { TMP: '11', SKY: '1', PTY: '0' }),
    ...hour('2026-10-22 12', { TMP: '13', SKY: '1', PTY: '0' }),
  ])
  it('지금이 속한 시각의 칸', () => {
    expect(currentSlot(slots, Date.parse(kst('2026-10-22 11')) + 30 * 60_000)?.temp).toBe(11)
  })
  it('지금 칸이 없으면 가장 가까운 다음 칸', () => {
    expect(currentSlot(slots, Date.parse(kst('2026-10-22 10')) + 5 * 60_000)?.temp).toBe(11)
  })
  it('모두 지났으면 없다 — 낡은 예보를 지금 날씨로 보이지 않는다', () => {
    expect(currentSlot(slots, Date.parse(kst('2026-10-22 14')))).toBeNull()
    expect(currentSlot([], Date.now())).toBeNull()
  })
})

describe('dayName', () => {
  it('오늘·내일·모레, 그 뒤는 날짜', () => {
    expect(dayName('2026-10-22', '2026-10-22')).toBe('오늘')
    expect(dayName('2026-10-23', '2026-10-22')).toBe('내일')
    expect(dayName('2026-10-24', '2026-10-22')).toBe('모레')
    expect(dayName('2026-10-25', '2026-10-22')).toBe('10월 25일')
  })
  it('달이 바뀌어도 하루 차이로 센다', () => {
    expect(dayName('2026-11-01', '2026-10-31')).toBe('내일')
  })
})

describe('isWet', () => {
  it('비·눈이 오거나 강수 확률 30% 이상이면 강조한다', () => {
    const [dry, likely, raining] = buildHourly([
      ...hour('2026-10-22 13', { TMP: '1', SKY: '1', PTY: '0', POP: '20' }),
      ...hour('2026-10-22 14', { TMP: '1', SKY: '4', PTY: '0', POP: '30' }),
      ...hour('2026-10-22 15', { TMP: '1', SKY: '4', PTY: '1', POP: '10' }),
    ])
    expect([isWet(dry), isWet(likely), isWet(raining)]).toEqual([false, true, true])
  })
})

describe('daySummaries', () => {
  it('날짜별 최저·최고와 비·눈 시간을 낸다', () => {
    const slots = buildHourly([
      ...hour('2026-10-22 14', { TMP: '15', SKY: '1', PTY: '0', POP: '0' }),
      ...hour('2026-10-22 15', { TMP: '16', SKY: '1', PTY: '0', POP: '0' }),
      ...hour('2026-10-23 09', { TMP: '8', SKY: '4', PTY: '1', POP: '70' }),
      ...hour('2026-10-23 10', { TMP: '9', SKY: '4', PTY: '1', POP: '80' }),
      ...hour('2026-10-23 13', { TMP: '12', SKY: '4', PTY: '0', POP: '20' }),
    ])
    expect(daySummaries(slots, '2026-10-22')).toEqual([
      { date: '2026-10-22', name: '오늘', min: 15, max: 16, wetHours: [] },
      { date: '2026-10-23', name: '내일', min: 8, max: 12, wetHours: [9, 10] },
    ])
  })

  // QA 2026-11-07 NOTI-04 — 대시보드 4° · 휴무 관리 3°. 서버 휴무 판정처럼 min(TMP, TMN) · max(TMP, TMX)
  it('TMN·TMX 가 시간별 기온 밖이면 그 값을 최저·최고로 쓴다', () => {
    const rows = [
      ...hour('2026-11-03 06', { TMP: '4', SKY: '1', PTY: '0' }),
      { fcst_at: kst('2026-11-03 06'), category: 'TMN', value: '3.0' },
      ...hour('2026-11-03 15', { TMP: '12', SKY: '1', PTY: '0' }),
      { fcst_at: kst('2026-11-03 15'), category: 'TMX', value: '13.0' },
    ]
    expect(daySummaries(buildHourly(rows), '2026-11-02', dayExtremes(rows))[0]).toMatchObject({ min: 3, max: 13 })
  })
  it('TMN·TMX 가 시간별 기온 안이면 시간별 기온을 그대로 쓴다', () => {
    const rows = [
      ...hour('2026-11-03 06', { TMP: '2' }),
      { fcst_at: kst('2026-11-03 06'), category: 'TMN', value: '3' },
      ...hour('2026-11-03 15', { TMP: '14' }),
      { fcst_at: kst('2026-11-03 15'), category: 'TMX', value: '13' },
    ]
    expect(daySummaries(buildHourly(rows), '2026-11-02', dayExtremes(rows))[0]).toMatchObject({ min: 2, max: 14 })
  })
  it('다른 날의 TMN 은 섞지 않는다', () => {
    const rows = [
      ...hour('2026-11-03 06', { TMP: '4' }),
      { fcst_at: kst('2026-11-04 06'), category: 'TMN', value: '-1' },
    ]
    expect(daySummaries(buildHourly(rows), '2026-11-02', dayExtremes(rows))[0]).toMatchObject({ min: 4, max: 4 })
  })
})

describe('dayExtremes', () => {
  it('TMN·TMX 를 서울 날짜로 묶고 숫자가 아닌 값·다른 카테고리는 버린다', () => {
    const ext = dayExtremes([
      { fcst_at: kst('2026-11-03 06'), category: 'TMN', value: '-2.5' },
      { fcst_at: kst('2026-11-03 15'), category: 'TMX', value: '9' },
      { fcst_at: kst('2026-11-03 15'), category: 'TMP', value: '8' },
      { fcst_at: kst('2026-11-04 06'), category: 'TMN', value: '없음' },
    ])
    expect([...ext.entries()]).toEqual([['2026-11-03', { tmn: [-2.5], tmx: [9] }]])
  })
})

describe('기상청 발표 시각', () => {
  it('가장 늦은 base_at 을 고른다. 없으면 null', () => {
    expect(
      latestBaseAt([
        { base_at: '2026-11-07T08:00:00+09:00' },
        { base_at: '2026-11-07T11:00:00+09:00' },
        { base_at: null },
      ]),
    ).toBe('2026-11-07T11:00:00+09:00')
    expect(latestBaseAt([{}, { base_at: null }])).toBeNull()
  })
  it('오늘 발표는 시만, 어제·그 전은 날을 붙인다', () => {
    expect(issueLabel('2026-11-07T11:00:00+09:00', '2026-11-07')).toBe('기상청 11시 발표')
    // DB 는 UTC 로 준다 — 서울 23시 = UTC 14시
    expect(issueLabel('2026-11-06T14:00:00Z', '2026-11-07')).toBe('기상청 어제 23시 발표')
    expect(issueLabel('2026-11-05T02:00:00+09:00', '2026-11-07')).toBe('기상청 11월 5일 2시 발표')
  })
})

describe('wetHoursLabel', () => {
  it('이어진 시간은 묶는다', () => {
    expect(wetHoursLabel([])).toBe('비·눈 소식 없음')
    expect(wetHoursLabel([9, 10, 11, 15])).toBe('비·눈 가능 9~12시, 15~16시')
    expect(wetHoursLabel([23])).toBe('비·눈 가능 23~24시')
  })
})

describe('hourRow', () => {
  it('날짜 하나의 0~23시 칸, 예보가 없는 시는 null', () => {
    const slots = buildHourly([
      ...hour('2026-10-22 13', { TMP: '14', SKY: '1', PTY: '0' }),
      ...hour('2026-10-23 13', { TMP: '9', SKY: '1', PTY: '0' }),
    ])
    const row = hourRow(slots, '2026-10-22')
    expect(row).toHaveLength(24)
    expect(row[13]?.temp).toBe(14)
    expect(row.filter(Boolean)).toHaveLength(1)
  })
})

describe('seoulDates', () => {
  it('서울 기준 오늘부터 n 일 — UTC 로는 전날 밤이어도', () => {
    // 서울 2026-10-22 08:00 = UTC 2026-10-21 23:00
    expect(seoulDates(3, Date.parse('2026-10-21T23:00:00Z'))).toEqual(['2026-10-22', '2026-10-23', '2026-10-24'])
  })
})

describe('savedLabel', () => {
  it('서울 시각 시:분으로, 오늘이 아니면 어제·M월 D일', () => {
    expect(savedLabel('2026-11-07T02:20:00Z', '2026-11-07')).toBe('11:20 갱신')
    expect(savedLabel('2026-11-06T14:05:00Z', '2026-11-07')).toBe('어제 23:05 갱신')
    expect(savedLabel('2026-11-05T00:00:00+09:00', '2026-11-07')).toBe('11월 5일 00:00 갱신')
  })
})

describe('forecastIssueText', () => {
  it('발표·갱신을 함께 적는다', () => {
    expect(forecastIssueText({ base_at: '2026-11-07T02:00:00Z', updated_at: '2026-11-07T02:20:00Z' }, '2026-11-07')).toBe(
      '기상청 11시 발표 · 11:20 갱신',
    )
  })
  it('하나만 있으면 그것만, 없거나 못 읽으면 null(옛 서버는 칸이 없다)', () => {
    expect(forecastIssueText({ base_at: null, updated_at: '2026-11-07T02:20:00Z' }, '2026-11-07')).toBe('11:20 갱신')
    expect(forecastIssueText({ base_at: '2026-11-07T02:00:00Z' }, '2026-11-07')).toBe('기상청 11시 발표')
    expect(forecastIssueText({ base_at: null, updated_at: null }, '2026-11-07')).toBeNull()
    expect(forecastIssueText({}, '2026-11-07')).toBeNull()
    expect(forecastIssueText({ base_at: 'x', updated_at: '' }, '2026-11-07')).toBeNull()
  })
})
