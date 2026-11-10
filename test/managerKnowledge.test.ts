// 담당자 FAQ·AI 문서(앱 「FAQ · 답변 자료」와 같은 기능) — 비슷한 질문·적용 범위·문서 상태·저장 모름 판정을 고정한다
import { describe, expect, it } from 'vitest'
import {
  addParaphrase,
  byExcludedLast,
  isMaybeSaved,
  knowledgeErrorText,
  knowledgeScopeLabel,
  managerDocState,
  MAX_PARAPHRASES,
  NotSentError,
} from '../app/utils/managerKnowledge'

describe('비슷한 질문', () => {
  it('앞뒤 공백을 지우고 빈 값·중복은 더하지 않는다', () => {
    expect(addParaphrase([], '  큐알 안 찍혀요 ')).toEqual(['큐알 안 찍혀요'])
    const list = ['큐알 안 찍혀요']
    expect(addParaphrase(list, '큐알 안 찍혀요')).toBe(list)
    expect(addParaphrase(list, '   ')).toBe(list)
  })

  it('서버 상한(10개·200자)을 넘으면 더하지 않는다', () => {
    const full = Array.from({ length: MAX_PARAPHRASES }, (_, i) => `질문${i}`)
    expect(addParaphrase(full, '하나 더')).toBe(full)
    expect(addParaphrase([], 'ㄱ'.repeat(201))).toEqual([])
    expect(addParaphrase([], 'ㄱ'.repeat(200))).toHaveLength(1)
  })
})

describe('적용 범위 표기', () => {
  const names = { a: '햇살경로당', b: '꽃길경로당' }
  it('비어 있으면 기관 전체', () => {
    expect(knowledgeScopeLabel([], names)).toBe('기관 전체')
  })
  it('아는 이름만 적고 모르는 근무지가 섞이면 「외」를 남긴다 — 기관 전체라고 하지 않는다', () => {
    expect(knowledgeScopeLabel(['a', 'b'], names)).toBe('햇살경로당 · 꽃길경로당')
    expect(knowledgeScopeLabel(['a', 'x'], names)).toBe('햇살경로당 외')
    expect(knowledgeScopeLabel(['x'], names)).toBe('일부 근무지')
  })
})

describe('문서 상태 — 앱 documentPresentation 과 같은 순서', () => {
  const TODAY = '2026-11-11'
  const base = { excluded_at: null, effective_date: '2026-11-01', expiry_date: null }
  it('제외 → 준비 중 → 미정 → 발효예정 → 만료 → 사용 중', () => {
    expect(managerDocState({ ...base, excluded_at: '2026-11-10T00:00:00Z' }, true, TODAY).label).toBe('제외함')
    expect(managerDocState(base, true, TODAY).label).toBe('준비 중')
    expect(managerDocState({ ...base, effective_date: null }, false, TODAY).label).toBe('미정')
    expect(managerDocState({ ...base, effective_date: '2026-11-12' }, false, TODAY).label).toBe('발효예정')
    expect(managerDocState({ ...base, expiry_date: '2026-11-10' }, false, TODAY).label).toBe('만료')
    expect(managerDocState({ ...base, expiry_date: TODAY }, false, TODAY)).toEqual({ label: '사용 중', tone: 'green' })
  })
})

describe('제외한 문서는 아래로', () => {
  it('제외하지 않은 것을 먼저, 같은 묶음 안의 순서는 그대로', () => {
    const rows = [
      { id: '1', excluded_at: '2026-11-01' },
      { id: '2', excluded_at: null },
      { id: '3', excluded_at: null },
    ]
    expect([...rows].sort(byExcludedLast).map((r) => r.id)).toEqual(['2', '3', '1'])
  })
})

describe('저장됐는지 모르는 실패 — 앱과 같이 「안 보낸 것이 확실한 것」만 보통 실패', () => {
  it('보내기 전에 난 오류(세션 없음·오프라인)는 저장되지 않은 것', () => {
    expect(isMaybeSaved(new NotSentError('세션이 없습니다. 다시 로그인해 주세요.'))).toBe(false)
  })

  it('4xx 는 서버가 거절한 것', () => {
    expect(isMaybeSaved({ name: 'FetchError', status: 409 })).toBe(false)
    expect(isMaybeSaved({ name: 'FetchError', statusCode: 400 })).toBe(false)
  })

  it('응답이 없거나 5xx, 또는 응답 본문을 읽다 끊긴 것(맨 TypeError)은 모른다', () => {
    expect(isMaybeSaved({ name: 'FetchError' })).toBe(true)
    expect(isMaybeSaved({ name: 'FetchError', status: 502 })).toBe(true)
    expect(isMaybeSaved(new TypeError('network error'))).toBe(true)
  })
})

describe('담당자 오류 문구 — 앱 faqErrorText·createDocumentErrorText 와 같은 뜻', () => {
  const err = (status: number, error: string) => ({ name: 'FetchError', status, data: { error } })
  it('권한·근무지·분류는 담당자에게 맞는 말로(운영관리자 로그인을 권하지 않는다)', () => {
    expect(knowledgeErrorText(err(403, 'forbidden'), 'faq')).toContain('담당자 계정')
    expect(knowledgeErrorText(err(400, 'bad_worksite'), 'faq')).toContain('맡지 않은 근무지')
    expect(knowledgeErrorText(err(400, 'bad_category'), 'faq')).toContain('분류')
    expect(knowledgeErrorText(err(400, 'bad_request'), 'faq')).toContain('질문과 답변')
  })

  it('문서는 같은 이름이면 목록부터 보게 하고, 크기는 20MB 를 말한다', () => {
    expect(knowledgeErrorText(err(409, 'duplicate_filename'), 'document')).toContain('목록에서 먼저 확인')
    expect(knowledgeErrorText(err(400, 'too_large'), 'document')).toContain('20MB')
  })

  it('보내지 못한 이유(세션 없음·오프라인)와 로그인 만료는 그대로 말한다 — 「잠시 뒤 다시」는 소용없다', () => {
    expect(knowledgeErrorText(new NotSentError('인터넷에 연결되어 있지 않습니다. 연결을 확인해 주세요.'), 'faq')).toContain('인터넷')
    expect(knowledgeErrorText({ name: 'FetchError', status: 401 }, 'document')).toContain('로그인이 만료')
  })

  it('모르는 코드는 사용자를 탓하지 않는다', () => {
    expect(knowledgeErrorText(err(400, 'bad_request'), 'document')).toBe('저장하지 못했습니다. 잠시 뒤 다시 시도해 주세요.')
    expect(knowledgeErrorText(new Error('x'), 'faq')).toBe('저장하지 못했습니다. 잠시 뒤 다시 시도해 주세요.')
  })
})
