// 어드민 공지 작성 규칙 — 유형 변환·보낼 수 있는지·오류 문구. 발송은 앱 API POST /dbo/notices 를 쓴다

/** 앱 공지 쓰기 화면(`app/notices/compose.tsx`)과 같은 상한 */
export const TITLE_MAX = 100
export const BODY_MAX = 2000

/** 화면의 유형 하나. 긴급은 일반·특별과 함께 고를 수 없어 한 값으로 둔다 */
export type NoticeLevel = 'simple' | 'special' | 'urgent'

export const NOTICE_LEVELS: { value: NoticeLevel; label: string }[] = [
  { value: 'simple', label: '일반' },
  { value: 'special', label: '특별' },
  { value: 'urgent', label: '긴급' },
]

export function buildNoticeBody(d: {
  level: NoticeLevel
  worksiteIds: string[]
  title: string
  body: string
  requestId: string
}) {
  return {
    worksiteIds: d.worksiteIds,
    title: d.title.trim(),
    body: d.body.trim(),
    kind: d.level === 'urgent' ? 'urgent' : 'normal',
    isSpecial: d.level === 'special',
    requestId: d.requestId,
  }
}

export function canSubmitNotice(d: { worksiteIds: string[]; title: string; body: string }): boolean {
  const title = d.title.trim()
  const body = d.body.trim()
  return d.worksiteIds.length > 0 && !!title && !!body && title.length <= TITLE_MAX && body.length <= BODY_MAX
}

/**
 * 발송 오류 문구. 응답을 못 받았거나 서버 오류면 이미 나갔을 수 있다 — 나간 문자는 회수할 수 없어서
 * 바로 다시 보내라고 하지 않는다(앱 `NoticeMaybeSentError` 와 같은 판단).
 */
export function createNoticeErrorMessage(e: any): string {
  const code: string | undefined = e?.data?.error
  const status: number | undefined = e?.status ?? e?.statusCode
  if (code === 'bad_worksite') return '그 근무지에 보낼 권한이 없습니다. 근무지를 다시 골라 주세요.'
  if (code === 'request_conflict') return '이 화면에서 이미 보낸 공지가 있습니다. 공지 목록을 확인해 주세요.'
  if (status === 401) return '로그인이 만료되었습니다. 다시 로그인해 주세요.'
  if (status === 403) return '공지를 보낼 권한이 없습니다.'
  if (status === 400) return '제목과 내용을 확인해 주세요.'
  if (!status || status >= 500) {
    return '응답을 확인하지 못했습니다. 이미 발송됐을 수 있으니 공지 목록을 확인한 뒤 다시 시도해 주세요.'
  }
  return '공지를 보내지 못했습니다. 잠시 뒤 다시 시도해 주세요.'
}
