// 담당자 FAQ·AI 문서 — 앱 「FAQ · 답변 자료」(db-operation-rn lib/faqs.ts·lib/documents.ts)와 같은 판정. 비슷한 질문·적용 범위·문서 상태·저장 모름

/** 서버 앱 API(`apps/dbo/api/knowledge.ts`)의 상한과 같다 */
export const MAX_PARAPHRASES = 10
export const MAX_PARAPHRASE_CHARS = 200
/** 앱 API 의 문서 파일명 상한(`MAX_FILENAME`). 넘으면 서버가 이유 없이 bad_request 만 준다 */
export const MAX_DOC_FILENAME_CHARS = 200

/** 비슷한 질문 칩을 더한다. 빈 값·중복·상한을 넘는 것은 더하지 않고 원래 배열을 돌려준다 */
export function addParaphrase(list: string[], raw: string): string[] {
  const t = raw.trim()
  if (!t || t.length > MAX_PARAPHRASE_CHARS || list.length >= MAX_PARAPHRASES || list.includes(t)) return list
  return [...list, t]
}

/**
 * 적용 범위 줄. 비어 있으면 기관 전체다. 담당자는 맡은 근무지 이름만 읽을 수 있어(RLS) 모르는 근무지가 섞일 수 있다 —
 * 그때 「기관 전체」라고 하면 거짓이라 아는 것만 적고 「외」를 남긴다
 */
export function knowledgeScopeLabel(ids: string[], nameById: Record<string, string>): string {
  if (ids.length === 0) return '기관 전체'
  const known = ids.map((id) => nameById[id]).filter((n): n is string => !!n)
  if (known.length === 0) return '일부 근무지'
  if (known.length < ids.length) return `${known.join(' · ')} 외`
  return known.join(' · ')
}

type DocDates = { excluded_at: string | null; effective_date: string | null; expiry_date: string | null }

/**
 * 문서 상태 문구와 색. 서버 `documentState()` 와 같은 순서다. 제외를 날짜보다 먼저 본다 — 만료된 문서를 뺐을 때 「만료」라고
 * 하면 되살리는 길이 날짜 수정처럼 보인다. `today` 는 서울 날짜(서버 판정과 같은 날)
 */
export function managerDocState(
  doc: DocDates,
  preparing: boolean,
  today: string,
): { label: string; tone: 'green' | 'gray' } {
  if (doc.excluded_at) return { label: '제외함', tone: 'gray' }
  if (preparing) return { label: '준비 중', tone: 'gray' }
  if (!doc.effective_date) return { label: '미정', tone: 'gray' }
  if (doc.effective_date > today) return { label: '발효예정', tone: 'gray' }
  if (doc.expiry_date && doc.expiry_date < today) return { label: '만료', tone: 'gray' }
  return { label: '사용 중', tone: 'green' }
}

/** 제외한 문서를 아래로 — 손댈 것이 먼저 보여야 한다. 같은 묶음 안의 순서는 그대로(안정 정렬) */
export function byExcludedLast(a: { excluded_at: string | null }, b: { excluded_at: string | null }): number {
  return Number(!!a.excluded_at) - Number(!!b.excluded_at)
}

/** 앱 API 의 문서 본문 상한(`MAX_BODY`). 넘으면 이유 없이 bad_request 라 보내기 전에 막는다 */
export const MAX_DOC_BODY_CHARS = 2_000_000

/** 요청을 보내지 않은 것이 확실한 실패(세션 없음·오프라인). `useDboApp` 이 던진다 */
export class NotSentError extends Error {}

/**
 * 저장됐는지 모르는 실패. 앱(`lib/faqs.ts`)과 같이 **안 보낸 것이 확실한 것(NotSentError)과 서버가 거절한 4xx 만** 보통 실패다.
 * 응답이 없거나 5xx, 헤더를 받은 뒤 본문을 읽다 끊긴 것(ofetch 가 감싸지 않은 맨 TypeError)은 서버가 이미 저장했을 수 있다 —
 * 다시 누르게 하면 같은 FAQ 가 두 벌 쌓이고(멱등 키가 없다) 문서는 같은 이름이라 409 다
 */
export function isMaybeSaved(e: any): boolean {
  if (e instanceof NotSentError) return false
  const status: number | undefined = e?.status ?? e?.statusCode
  return status === undefined || status >= 500
}

const FALLBACK = '저장하지 못했습니다. 잠시 뒤 다시 시도해 주세요.'

/**
 * 담당자 FAQ·문서 저장 실패 문구 — 앱 `faqErrorText`·`createDocumentErrorText` 와 같은 뜻. 어드민 공용 `dboErrorMessage` 는 403 에
 * 「운영관리자로 로그인」을 권해 담당자에게 맞지 않는다. 모르는 코드(`bad_request` 등)에는 사용자를 탓하는 말을 쓰지 않는다
 */
export function knowledgeErrorText(e: any, what: 'faq' | 'document'): string {
  // 보내지 못한 이유(세션 없음·오프라인)와 로그인 만료는 다시 시도해도 소용없다 — 그대로 말한다
  if (e instanceof NotSentError) return e.message
  if ((e?.status ?? e?.statusCode) === 401) return '로그인이 만료되었습니다. 다시 로그인해 주세요.'
  const code: string | undefined = e?.data?.error
  if (code === 'forbidden') return '권한이 없습니다. 담당자 계정이 활동 중인지 확인해 주세요.'
  if (code === 'bad_worksite') return '맡지 않은 근무지는 고를 수 없습니다. 적용 범위를 다시 골라 주세요.'
  if (what === 'faq') {
    if (code === 'bad_category') return '분류를 다시 골라 주세요.'
    if (code === 'bad_request') return '질문과 답변을 확인해 주세요.'
    return FALLBACK
  }
  if (code === 'duplicate_filename' || e?.status === 409) {
    return '같은 이름의 문서가 이미 있습니다. 문서 목록에서 먼저 확인해 주세요. 다른 문서라면 파일명을 바꿔 올려 주세요.'
  }
  if (code === 'too_large') return '파일이 너무 큽니다. 20MB 아래로 줄여 주세요.'
  return FALLBACK
}
