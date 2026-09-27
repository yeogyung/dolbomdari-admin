// FAQ 승인 관리 순수 유틸 테스트 — 상태 라벨·톤, 필터, 적용 범위, PostgREST 오류 메시지
import { describe, it, expect } from 'vitest'
import {
  faqStatusLabel,
  faqStatusTone,
  filterFaqs,
  faqScopeNames,
  faqScopeLabel,
  faqReadErrorMessage,
} from '../app/utils/faqs'
import type { Faq } from '../app/types/dbo'

const base: Faq = {
  id: 'f1',
  question: '출근 QR 이 안 찍혀요',
  answer: '근무지 담당자에게 새 QR 을 요청하세요.',
  enabled: false,
  sort: 0,
  status: 'pending',
  category: '출퇴근',
  created_by: null,
  created_at: '2026-09-26T00:00:00Z',
  dbo_faq_worksites: [],
}

describe('FAQ 승인 상태 표기', () => {
  it('세 상태를 한국어 라벨과 톤으로 바꾼다', () => {
    expect(faqStatusLabel('pending')).toBe('승인 대기')
    expect(faqStatusLabel('approved')).toBe('승인')
    expect(faqStatusLabel('rejected')).toBe('반려')
    expect(faqStatusTone('pending')).toBe('amber')
    expect(faqStatusTone('approved')).toBe('green')
    expect(faqStatusTone('rejected')).toBe('red')
  })
})

describe('FAQ 목록 필터', () => {
  const items: Faq[] = [
    base,
    { ...base, id: 'f2', question: '급여일이 언제인가요', answer: '매월 10일입니다.', status: 'approved' },
    { ...base, id: 'f3', question: '휴가 신청', answer: '담당자에게 QR 말고 전화로', status: 'rejected' },
  ]

  it('조건이 없으면 순서를 바꾸지 않고 전부 낸다', () => {
    expect(filterFaqs(items, {}).map((f) => f.id)).toEqual(['f1', 'f2', 'f3'])
  })
  it('상태로 거른다', () => {
    expect(filterFaqs(items, { status: 'approved' }).map((f) => f.id)).toEqual(['f2'])
  })
  it('검색어는 질문과 답변 양쪽에서 찾고 대소문자·앞뒤 공백을 무시한다', () => {
    expect(filterFaqs(items, { q: ' qr ' }).map((f) => f.id)).toEqual(['f1', 'f3'])
  })
  it('상태와 검색어를 함께 건다', () => {
    expect(filterFaqs(items, { q: 'QR', status: 'rejected' }).map((f) => f.id)).toEqual(['f3'])
  })
})

describe('FAQ 적용 범위', () => {
  it('범위 행이 없으면 기관 전체다', () => {
    expect(faqScopeNames(base)).toEqual([])
    expect(faqScopeLabel(base)).toBe('기관 전체')
  })
  it('근무지 이름을 내고, 이름을 못 읽은 행은 id 로 대신한다', () => {
    const faq: Faq = {
      ...base,
      dbo_faq_worksites: [
        { worksite_id: 'w1', dbo_worksites: { id: 'w1', name: '햇살요양원' } },
        { worksite_id: 'w2', dbo_worksites: null },
      ],
    }
    expect(faqScopeNames(faq)).toEqual(['햇살요양원', 'w2'])
    expect(faqScopeLabel(faq)).toBe('햇살요양원 외 1곳')
  })
  it('근무지가 하나면 이름만 쓴다', () => {
    const faq: Faq = {
      ...base,
      dbo_faq_worksites: [{ worksite_id: 'w1', dbo_worksites: { id: 'w1', name: '햇살요양원' } }],
    }
    expect(faqScopeLabel(faq)).toBe('햇살요양원')
  })
})

describe('FAQ 조회 오류 메시지', () => {
  it('PostgREST 권한 오류를 권한 안내로 바꾼다', () => {
    expect(faqReadErrorMessage({ code: '42501', message: 'permission denied' })).toContain('권한이 없습니다')
  })
  it('컬럼이 없으면 서버 마이그레이션 미적용을 알린다', () => {
    expect(faqReadErrorMessage({ code: '42703', message: 'column dbo_faqs.status does not exist' })).toContain('마이그레이션')
  })
  it('그 밖의 오류는 코드와 함께 낸다', () => {
    expect(faqReadErrorMessage({ code: 'PGRST000', message: 'x' })).toBe('FAQ를 불러오지 못했습니다. (PGRST000)')
  })
})
