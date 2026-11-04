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

/**
 * 받는 근무지 칸의 인원 문구(QA 2026-11-02 ANOTICE-02). 근무지마다 센 수를 더한다.
 *
 * **여러 곳이면 「최대」다.** 서버는 두 곳에 모두 배정된 분에게 한 번만 보내는데, 수는 근무지 하나씩만
 * 받을 수 있어 그 겹침을 뺄 수 없다. 합계를 정확한 수처럼 적으면 「12명」이라 해 놓고 10명에게 간다.
 * 한 번에 세는 길이 없는 옛 서버거나 100곳을 넘을 때만 쓴다(`recipientCountPlan`).
 *
 * @param counts 고른 근무지마다 센 수. 아직 오는 중이면 undefined, 못 셌으면 null
 */
export function recipientSummary(counts: (number | null | undefined)[]): string | null {
  if (counts.length === 0) return null
  if (counts.some((n) => n === undefined)) return '받는 사람 세는 중…'
  if (counts.some((n) => n === null)) return '받는 사람 수를 세지 못했습니다'
  const sum = (counts as number[]).reduce((a, b) => a + b, 0)
  return counts.length === 1 ? `받는 사람 ${sum}명` : `받는 사람 최대 ${sum}명 · 여러 곳에 배정된 분은 한 번만 받습니다`
}

/** 한 번에 세는 길(`GET /dbo/worksites/recipients`, 서버 2026-11-04)이 받는 근무지 수 상한. 넘으면 400 이다 */
export const RECIPIENT_TOTAL_MAX = 100

/**
 * 받는 사람 수를 어떻게 셀지(QA 2026-11-02 ANOTICE-02).
 *
 * - 'total' — 고른 근무지를 한 번에 센다. 두 곳 이상에 배정된 분은 한 번만 센다(발송과 같다). 정확한 수다.
 * - 'each' — 근무지마다 세어 더한다(「최대」, `recipientSummary`). 그 길이 없는 옛 서버거나 100곳을 넘을 때.
 */
export function recipientCountPlan(selected: number, totalRouteMissing: boolean): 'none' | 'total' | 'each' {
  if (selected === 0) return 'none'
  return !totalRouteMissing && selected <= RECIPIENT_TOTAL_MAX ? 'total' : 'each'
}

/** 한 번에 세는 길이 없는 서버인가 — 옛 서버는 그 주소를 몰라 404 다 */
export function isMissingRoute(e: any): boolean {
  const status: number | undefined = e?.status ?? e?.statusCode
  return status === 404 || status === 405
}

/** 한 번에 센 받는 사람 문구. 오는 중이면 undefined, 못 셌으면 null */
export function recipientTotalSummary(total: number | null | undefined): string {
  if (total === undefined) return '받는 사람 세는 중…'
  if (total === null) return '받는 사람 수를 세지 못했습니다'
  return `받는 사람 ${total}명`
}

/*
 * 받는 사람을 개인으로 고르기(QA 2026-11-02 ANOTICE-03, 결정 S1 · 서버 2026-11-04 계약 3a묶음 3번).
 * 한 공지는 근무지 공지이거나 개인 공지다 — 서버가 `worksiteIds` 와 `directoryIds` 중 하나만 받는다.
 */
export type RecipientMode = 'worksite' | 'person'

/** 개인으로 한 번에 고를 수 있는 사람 수. 서버 `NOTICE_PEOPLE_MAX` 와 같다(발송·받는 사람 수 모두) */
export const NOTICE_PEOPLE_MAX = 100

/** 개인 공지를 받지 않는 서버에서 화면에 적는 안내. 받는 사람 칸과 발송 오류가 같이 쓴다 */
export const PEOPLE_UNSUPPORTED = '개인 공지는 서버 업데이트 뒤에 보낼 수 있습니다.'

export type PeopleCountFailure = 'unsupported' | 'bad_recipient' | 'failed'

/**
 * 개인 받는 사람 수(`GET /dbo/worksites/recipients?directoryIds=`)를 못 센 까닭.
 *
 * - 'unsupported' — 개인 선택을 모르는 서버. 지금 운영은 그 경로가 없어 404, 1묶음만 나간 서버는 `worksiteIds` 가
 *   없다고 400 `bad_request` 다. 고른 id 는 화면이 1~100개 uuid 로만 보내므로 새 서버에서 이 400 은 나지 않는다.
 * - 'bad_recipient' — 맡지 않은 사람이 섞였다(담당자만 받는다. master 는 누구나 고를 수 있다).
 */
export function peopleCountFailure(e: any): PeopleCountFailure {
  if (isMissingRoute(e)) return 'unsupported'
  const code: string | undefined = e?.data?.error
  const status: number | undefined = e?.status ?? e?.statusCode
  if (status === 400 && code === 'bad_request') return 'unsupported'
  if (code === 'bad_recipient') return 'bad_recipient'
  return 'failed'
}

/**
 * 개인으로 고른 받는 사람 문구. 고른 사람이 없으면 null.
 * @param total 서버가 센 수. 오는 중이면 undefined, 못 셌으면 null(까닭은 `failure`)
 */
export function peopleRecipientText(
  selected: number,
  total: number | null | undefined,
  failure: PeopleCountFailure | null,
): string | null {
  if (selected === 0) return null
  if (selected > NOTICE_PEOPLE_MAX) return `한 번에 ${NOTICE_PEOPLE_MAX}명까지 고를 수 있습니다. 지금 ${selected}명입니다.`
  if (failure === 'unsupported') return PEOPLE_UNSUPPORTED
  if (failure === 'bad_recipient') return '담당하지 않는 분이 섞여 있습니다. 받는 사람을 다시 골라 주세요.'
  return recipientTotalSummary(failure ? null : total)
}

/** 개인 공지 201 의 `excluded`(고른 사람 중 받지 않은 명부 id — 계약 종료·비활성 등). 없거나 0명이면 null */
export function excludedNote(excluded: string[] | undefined): string | null {
  const n = excluded?.length ?? 0
  return n > 0 ? `${n}명은 계약 종료 등으로 받지 않았습니다.` : null
}

/**
 * 공지 사진(QA 2026-11-02 ANOTICE-01, 결정 S6). 버킷은 서버 마이그레이션 `20261005020000` 의 `dbo-notice-images` 이고,
 * 앱 공지 쓰기(`db-operation-rn/lib/noticeImages.ts`)와 같은 길로 올린다 — 내 폴더에 먼저 올리고 발송 때 경로를 싣는다.
 */
export const NOTICE_IMAGE_BUCKET = 'dbo-notice-images'
/** 버킷 한도(10MB) */
export const NOTICE_IMAGE_BYTES = 10 * 1024 * 1024
/** 버킷이 받는 종류. 서버 `noticeImagePaths` 도 이 확장자만 받는다 */
const IMAGE_EXT: Record<string, string> = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' }
export const NOTICE_IMAGE_ACCEPT = Object.keys(IMAGE_EXT).join(',')

/**
 * 고른 파일에서 넣을 사진. **어드민은 한 장이다**(QA 예상 — 두 장을 한 번에 넣으면 한 장만). 앱·서버는 다섯 장까지 받는다.
 * 여러 장이면 첫 장만 넣고 그렇다고 알린다. 버킷이 거절할 것(종류·크기)은 올리기 전에 거른다.
 */
export function pickNoticeImage<F extends { type: string; size: number }>(
  files: F[],
): { file: F | null; notice: string | null } {
  const first = files[0]
  if (!first) return { file: null, notice: null }
  if (!IMAGE_EXT[first.type]) return { file: null, notice: '사진은 JPG·PNG·WEBP 만 넣을 수 있습니다.' }
  if (first.size > NOTICE_IMAGE_BYTES) return { file: null, notice: '사진은 10MB 까지 넣을 수 있습니다.' }
  return { file: first, notice: files.length > 1 ? '사진은 한 장만 넣을 수 있어 첫 장만 넣었습니다.' : null }
}

/**
 * 올릴 경로 `{내 프로필 id}/notice-{키}.{확장자}`. 버킷 정책은 첫 폴더가 내 id 일 때만 올리게 하고, 서버는 이 모양만
 * 받는다(남의 폴더 사진을 붙이지 못하게). 앱 `noticeImagePath` 와 같은 모양이다. 종류를 모르거나 키가 16진수가 아니면 null
 */
export function noticeImagePath(ownerId: string, mimeType: string, key: string): string | null {
  const ext = IMAGE_EXT[mimeType]
  if (!ext || !/^[0-9a-f-]+$/.test(key)) return null
  return `${ownerId}/notice-${key}.${ext}`
}

export function buildNoticeBody(d: {
  level: NoticeLevel
  worksiteIds: string[]
  /**
   * 개인으로 고른 사람(명부 id, QA ANOTICE-03). 주면 이것만 싣고 `worksiteIds` 는 **싣지 않는다** — 한 공지는 둘 중
   * 하나다. 개인 선택을 모르는 옛 서버는 이 칸을 버리고 근무지가 없다고 400 을 낸다(아무에게도 가지 않는다)
   */
  directoryIds?: string[]
  title: string
  body: string
  requestId: string
  /** 미리 올린 사진 경로. 없으면 칸을 싣지 않는다 */
  imagePaths?: string[]
}) {
  return {
    ...(d.directoryIds ? { directoryIds: d.directoryIds } : { worksiteIds: d.worksiteIds }),
    title: d.title.trim(),
    body: d.body.trim(),
    kind: d.level === 'urgent' ? 'urgent' : 'normal',
    isSpecial: d.level === 'special',
    requestId: d.requestId,
    ...(d.imagePaths?.length ? { imagePaths: d.imagePaths } : {}),
  }
}

export function canSubmitNotice(d: {
  worksiteIds: string[]
  /** 개인으로 고른 사람. 주면 근무지 대신 이것을 본다(1~100명) */
  directoryIds?: string[]
  title: string
  body: string
}): boolean {
  const title = d.title.trim()
  const body = d.body.trim()
  const to = d.directoryIds
    ? d.directoryIds.length > 0 && d.directoryIds.length <= NOTICE_PEOPLE_MAX
    : d.worksiteIds.length > 0
  return to && !!title && !!body && title.length <= TITLE_MAX && body.length <= BODY_MAX
}

/**
 * 발송 오류 문구. 응답을 못 받았거나 서버 오류면 이미 나갔을 수 있다 — 나간 문자는 회수할 수 없어서
 * 바로 다시 보내라고 하지 않는다(앱 `NoticeMaybeSentError` 와 같은 판단).
 */
export function createNoticeErrorMessage(e: any, mode: RecipientMode = 'worksite'): string {
  const code: string | undefined = e?.data?.error
  const status: number | undefined = e?.status ?? e?.statusCode
  if (code === 'bad_worksite') return '그 근무지에 보낼 권한이 없습니다. 근무지를 다시 골라 주세요.'
  if (code === 'bad_recipient') return '담당하지 않는 분이 섞여 있어 보내지 않았습니다. 받는 사람을 다시 골라 주세요.'
  if (code === 'no_recipients') {
    return '고른 분이 모두 계약 종료 등으로 받을 수 없어 보내지 않았습니다. 받는 사람을 다시 골라 주세요.'
  }
  // 개인 선택을 모르는 옛 서버는 `directoryIds` 를 버리고 근무지가 없다고 400 bad_request 를 낸다. 화면이 제목·내용·
  // 받는 사람(1~100명)을 미리 걸러 보내므로 새 서버에서는 이 400 이 나지 않는다 — 「제목과 내용을 확인」으로 읽히지 않게
  if (mode === 'person' && status === 400 && code === 'bad_request') return `${PEOPLE_UNSUPPORTED} 이 공지는 보내지 않았습니다.`
  if (code === 'request_conflict') return '이 화면에서 이미 보낸 공지가 있습니다. 공지 목록을 확인해 주세요.'
  if (status === 401) return '로그인이 만료되었습니다. 다시 로그인해 주세요.'
  if (status === 403) return '공지를 보낼 권한이 없습니다.'
  if (status === 400) return '제목과 내용을 확인해 주세요.'
  if (!status || status >= 500) {
    return '응답을 확인하지 못했습니다. 이미 발송됐을 수 있으니 공지 목록을 확인한 뒤 다시 시도해 주세요.'
  }
  return '공지를 보내지 못했습니다. 잠시 뒤 다시 시도해 주세요.'
}
