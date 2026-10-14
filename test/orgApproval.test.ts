// 기관 가입 검토 상태 라벨·톤과 결과 문자 문구 테스트
import { describe, expect, it } from 'vitest'
import { orgApprovalLabel, orgApprovalTone, orgReviewSmsText } from '../shared/orgApproval'

describe('orgApprovalLabel / orgApprovalTone', () => {
  it('세 상태를 한글 라벨과 톤으로 바꾼다', () => {
    expect(orgApprovalLabel('pending')).toBe('승인대기')
    expect(orgApprovalLabel('approved')).toBe('승인됨')
    expect(orgApprovalLabel('rejected')).toBe('반려')
    expect(orgApprovalTone('pending')).toBe('amber')
    expect(orgApprovalTone('approved')).toBe('green')
    expect(orgApprovalTone('rejected')).toBe('red')
  })
  it('모르는 값은 그대로 보이고 회색이다', () => {
    expect(orgApprovalLabel('weird')).toBe('weird')
    expect(orgApprovalTone('weird')).toBe('gray')
  })
})

describe('orgReviewSmsText', () => {
  it('승인 문자에는 기관명이 들어간다', () => {
    expect(orgReviewSmsText('행복요양원', 'approved')).toContain('행복요양원 기관 승인이 완료')
  })
  it('반려 문자에는 사유와 재제출 안내가 들어간다', () => {
    const text = orgReviewSmsText('행복요양원', 'rejected', '서류가 흐립니다')
    expect(text).toContain('사유: 서류가 흐립니다')
    expect(text).toContain('서류를 다시 제출')
  })
})
