// 이력서 JSON 칸 문구 — 경력·자격·훈련·학력·비상연락처·동의·서명을 항목별 줄로 펴는지
import { describe, expect, it } from 'vitest'
import { RESUME_FIELD_TEXT as T } from '../app/utils/resumeFields'

describe('RESUME_FIELD_TEXT', () => {
  it('경력은 항목마다 한 줄 — 기간 · 근무처 · 업무, 끝이 없으면 재직중', () => {
    expect(
      T.careers!([
        { company: '가나요양원', start_ym: '2020-01', end_ym: null, duty: '방문요양' },
        { company: '다라센터', start_ym: '2018-03', end_ym: '2019-12', duty: '' },
      ]),
    ).toBe('2020.01 ~ 재직중 · 가나요양원 · 방문요양\n2018.03 ~ 2019.12 · 다라센터')
  })

  it('자격·훈련·학력도 양식 열 순서대로 편다', () => {
    expect(T.qualifications!([{ name: '요양보호사', acquired_ym: '2019-11', issuer: '보건복지부' }])).toBe(
      '2019.11 · 요양보호사 · 보건복지부',
    )
    expect(T.trainings!([{ name: '치매교육', completed_ym: null, institution: '중앙치매센터' }])).toBe(
      '치매교육 · 중앙치매센터',
    )
    expect(
      T.educations!([{ school: '가나고', major: '인문', start_ym: '1976-03', end_ym: '1979-02', status: '졸업' }]),
    ).toBe('1976.03 ~ 1979.02 · 가나고 · 인문 · 졸업')
  })

  it('비어 있거나 모양이 다르면 빈 문자열 — 상세 화면이 「—」로 보인다', () => {
    expect(T.careers!([])).toBe('')
    expect(T.careers!(null)).toBe('')
    expect(T.careers!([null, 'x'])).toBe('')
    expect(T.emergency_contact!(null)).toBe('')
    expect(T.consents!(null)).toBe('')
    expect(T.signature!(null)).toBe('')
  })

  it('비상연락처는 관계 · 번호', () => {
    expect(T.emergency_contact!({ relation: '배우자', phone: '01011112222' })).toBe('배우자 · 01011112222')
  })

  it('동의는 앱 작성 화면의 다섯 항목을 순서대로 동의 여부와 함께', () => {
    expect(
      T.consents!({
        personal_info: true,
        sensitive_info: true,
        third_party: true,
        org_change: false,
        marketing: true,
      }),
    ).toBe(
      [
        '[필수] 개인정보 수집·이용 — 동의',
        '[필수] 민감정보(건강 등) 처리 — 동의',
        '[필수] 제3자 제공(지원 기관) — 동의',
        '[선택] 근무 기관 변경 정보 수신 — 동의 안 함',
        '[선택] 마케팅 정보 수신 — 동의',
      ].join('\n'),
    )
  })

  it('서명은 성명 · 서울 시각', () => {
    expect(T.signature!({ name: '홍길동', signed_at: '2026-09-01T00:00:00Z' })).toBe('홍길동 · 2026.09.01 09:00')
  })
})
