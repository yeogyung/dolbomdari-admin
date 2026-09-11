import { describe, expect, it } from 'vitest'
import {
  addressText,
  birthText,
  RESUME_FORM,
  sectionRows,
  ymRange,
  ymText,
  type Resume,
} from '../shared/resume-form'

describe('ymText', () => {
  it('YYYY-MM 을 YYYY.MM 으로 바꾼다', () => {
    expect(ymText('2025-03')).toBe('2025.03')
  })
  it('빈 값은 빈 문자열이다', () => {
    expect(ymText(null)).toBe('')
    expect(ymText('')).toBe('')
  })
})

describe('ymRange', () => {
  it('시작과 끝을 물결로 잇는다', () => {
    expect(ymRange('2020-01', '2022-06')).toBe('2020.01 ~ 2022.06')
  })
  it('끝이 없으면 재직중이다', () => {
    expect(ymRange('2020-01', null)).toBe('2020.01 ~ 재직중')
  })
  it('시작이 없으면 끝만 적는다', () => {
    expect(ymRange(null, '2022-06')).toBe('2022.06')
  })
  it('둘 다 없으면 빈 문자열이다', () => {
    expect(ymRange(null, null)).toBe('')
  })
})

describe('birthText', () => {
  it('날짜를 한국어 표기로 바꾼다', () => {
    expect(birthText('1960-07-05')).toBe('1960년 7월 5일')
  })
  it('빈 값은 빈 문자열이다', () => {
    expect(birthText(null)).toBe('')
  })
})

describe('addressText', () => {
  it('기본주소와 상세주소를 합친다', () => {
    expect(addressText('서울시 강남구', '101동 202호')).toBe('서울시 강남구 101동 202호')
  })
  it('상세주소가 없으면 기본주소만 남는다', () => {
    expect(addressText('서울시 강남구', '')).toBe('서울시 강남구')
  })
})

describe('RESUME_FORM', () => {
  it('섹션이 양식 순서대로 넷이다', () => {
    expect(RESUME_FORM.map((s) => s.key)).toEqual([
      'careers',
      'qualifications',
      'trainings',
      'educations',
    ])
  })
  it('각 섹션의 기본 행 수가 양식과 같다', () => {
    expect(RESUME_FORM.map((s) => s.minRows)).toEqual([5, 3, 1, 1])
  })
  it('각 섹션의 열이 셋이다', () => {
    for (const s of RESUME_FORM) expect(s.columns).toHaveLength(3)
  })
})

const base: Resume = {
  id: 'r1',
  user_id: 'u1',
  status: 'completed',
  name: '홍길동',
  birth_date: '1960-07-05',
  phone: '01012345678',
  base_address: '서울시 강남구',
  detail_address: '101동 202호',
  careers: [{ company: '가나요양원', start_ym: '2020-01', end_ym: null, duty: '방문요양' }],
  qualifications: [{ name: '요양보호사', acquired_ym: '2019-11', issuer: '보건복지부' }],
  trainings: [{ name: '치매교육', completed_ym: '2021-05', institution: '중앙치매센터' }],
  educations: [
    { school: '가나고', major: '인문', start_ym: '1976-03', end_ym: '1979-02', status: '졸업' },
  ],
  signature: { name: '홍길동', signed_at: '2026-09-01T00:00:00Z' },
  updated_at: '2026-09-01T00:00:00Z',
}

describe('sectionRows', () => {
  it('경력은 기간·근무처·업무내용 순이다', () => {
    expect(sectionRows(base, 'careers')).toEqual([['2020.01 ~ 재직중', '가나요양원', '방문요양']])
  })
  it('훈련 1열은 수료년월만 넣는다', () => {
    expect(sectionRows(base, 'trainings')).toEqual([['2021.05', '치매교육', '중앙치매센터']])
  })
  it('배열이 없어도 터지지 않는다', () => {
    const empty = { ...base, careers: undefined as never }
    expect(sectionRows(empty, 'careers')).toEqual([])
  })
})
