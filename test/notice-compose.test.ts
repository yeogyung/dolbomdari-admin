// 어드민 공지 작성 규칙 테스트 — 유형 변환·보낼 수 있는지·오류 문구(QA 2026-10-14 15번)
import { describe, expect, it } from 'vitest'
import {
  BODY_MAX,
  buildNoticeBody,
  canSubmitNotice,
  createNoticeErrorMessage,
  excludedNote,
  NOTICE_IMAGE_BYTES,
  NOTICE_PEOPLE_MAX,
  noticeImagePath,
  peopleCountFailure,
  peopleRecipientText,
  PEOPLE_UNSUPPORTED,
  pickNoticeImage,
  isMissingRoute,
  RECIPIENT_TOTAL_MAX,
  recipientCountPlan,
  recipientSummary,
  recipientTotalSummary,
  TITLE_MAX,
} from '../app/utils/noticeCompose'

describe('buildNoticeBody', () => {
  const base = { worksiteIds: ['w1'], title: ' 안내 ', body: ' 본문 ', requestId: 'r1' }

  it('유형을 서버 칸(kind·isSpecial)으로 풀고 앞뒤 공백을 지운다', () => {
    expect(buildNoticeBody({ ...base, level: 'simple' })).toEqual({
      worksiteIds: ['w1'], title: '안내', body: '본문', kind: 'normal', isSpecial: false, requestId: 'r1',
    })
    expect(buildNoticeBody({ ...base, level: 'special' })).toMatchObject({ kind: 'normal', isSpecial: true })
    expect(buildNoticeBody({ ...base, level: 'urgent' })).toMatchObject({ kind: 'urgent', isSpecial: false })
  })

  it('사진 경로가 있을 때만 imagePaths 를 싣는다', () => {
    expect(buildNoticeBody({ ...base, level: 'simple', imagePaths: ['u/notice-a.jpg'] })).toMatchObject({
      imagePaths: ['u/notice-a.jpg'],
    })
    expect(buildNoticeBody({ ...base, level: 'simple', imagePaths: [] })).not.toHaveProperty('imagePaths')
  })

  // QA 2026-11-02 ANOTICE-03 — 한 공지는 근무지 공지이거나 개인 공지다
  it('개인으로 고르면 directoryIds 만 싣고 근무지는 싣지 않는다', () => {
    const b = buildNoticeBody({ ...base, level: 'simple', directoryIds: ['d1', 'd2'] })
    expect(b).toMatchObject({ directoryIds: ['d1', 'd2'] })
    // 옛 서버가 근무지로 보내지 않게 — 근무지 칸이 없으면 옛 서버는 400 으로 거절한다
    expect(b).not.toHaveProperty('worksiteIds')
  })

  it('근무지 공지는 예전 모양 그대로다', () => {
    expect(buildNoticeBody({ ...base, level: 'simple' })).not.toHaveProperty('directoryIds')
  })
})

// QA 2026-11-02 ANOTICE-01 · 결정 S6 — 한 장 넣으면 미리보기, 두 장을 한 번에 넣으면 한 장만
describe('pickNoticeImage', () => {
  const f = (type: string, size = 1000) => ({ type, size })

  it('한 장이면 그대로 넣는다', () => {
    const one = f('image/jpeg')
    expect(pickNoticeImage([one])).toEqual({ file: one, notice: null })
  })
  it('두 장을 한 번에 넣으면 첫 장만 넣고 알린다', () => {
    const first = f('image/png')
    const r = pickNoticeImage([first, f('image/jpeg')])
    expect(r.file).toBe(first)
    expect(r.notice).toBe('사진은 한 장만 넣을 수 있어 첫 장만 넣었습니다.')
  })
  it('버킷이 거절할 종류·크기는 넣지 않는다', () => {
    expect(pickNoticeImage([f('image/gif')])).toEqual({ file: null, notice: '사진은 JPG·PNG·WEBP 만 넣을 수 있습니다.' })
    expect(pickNoticeImage([f('image/webp', NOTICE_IMAGE_BYTES + 1)]).file).toBeNull()
    expect(pickNoticeImage([f('image/webp', NOTICE_IMAGE_BYTES)]).file).not.toBeNull()
  })
  it('고른 것이 없으면 아무것도 넣지 않는다', () => {
    expect(pickNoticeImage([])).toEqual({ file: null, notice: null })
  })
})

describe('noticeImagePath', () => {
  it('내 폴더 아래 서버가 받는 모양으로 만든다', () => {
    const key = crypto.randomUUID()
    const path = noticeImagePath('owner-1', 'image/jpeg', key)
    expect(path).toBe(`owner-1/notice-${key}.jpg`)
    // 서버 `noticeImagePaths` 의 판정과 같다 — 어긋나면 발송이 400 이다
    expect(/^[0-9a-f-]+\.(jpg|png|webp)$/.test(path!.slice('owner-1/notice-'.length))).toBe(true)
  })
  it('모르는 종류나 16진수가 아닌 키는 null', () => {
    expect(noticeImagePath('o', 'image/gif', 'abc')).toBeNull()
    expect(noticeImagePath('o', 'image/png', '../x')).toBeNull()
  })
})

describe('canSubmitNotice', () => {
  const ok = { worksiteIds: ['w1'], title: '안내', body: '본문' }

  it('근무지·제목·내용이 있으면 보낼 수 있다', () => {
    expect(canSubmitNotice(ok)).toBe(true)
  })

  it('근무지가 없거나 제목·내용이 공백뿐이면 못 보낸다', () => {
    expect(canSubmitNotice({ ...ok, worksiteIds: [] })).toBe(false)
    expect(canSubmitNotice({ ...ok, title: '  ' })).toBe(false)
    expect(canSubmitNotice({ ...ok, body: '  ' })).toBe(false)
  })

  it('개인이면 근무지 대신 고른 사람(1~100명)을 본다', () => {
    const person = { ...ok, worksiteIds: [] }
    expect(canSubmitNotice({ ...person, directoryIds: ['d1'] })).toBe(true)
    expect(canSubmitNotice({ ...person, directoryIds: [] })).toBe(false)
    const many = Array.from({ length: NOTICE_PEOPLE_MAX + 1 }, (_, i) => `d${i}`)
    expect(canSubmitNotice({ ...person, directoryIds: many.slice(0, NOTICE_PEOPLE_MAX) })).toBe(true)
    expect(canSubmitNotice({ ...person, directoryIds: many })).toBe(false)
    // 근무지를 골라 둔 채 개인으로 바꿔도 근무지로는 보낼 수 없다
    expect(canSubmitNotice({ ...ok, directoryIds: [] })).toBe(false)
  })

  it('앱과 같은 길이 상한을 지킨다', () => {
    expect(canSubmitNotice({ ...ok, title: 'ㄱ'.repeat(TITLE_MAX) })).toBe(true)
    expect(canSubmitNotice({ ...ok, title: 'ㄱ'.repeat(TITLE_MAX + 1) })).toBe(false)
    expect(canSubmitNotice({ ...ok, body: 'ㄱ'.repeat(BODY_MAX) })).toBe(true)
    expect(canSubmitNotice({ ...ok, body: 'ㄱ'.repeat(BODY_MAX + 1) })).toBe(false)
  })
})

describe('createNoticeErrorMessage', () => {
  it('서버 오류 코드를 먼저 본다', () => {
    expect(createNoticeErrorMessage({ status: 400, data: { error: 'bad_worksite' } })).toContain('근무지')
    expect(createNoticeErrorMessage({ status: 409, data: { error: 'request_conflict' } })).toContain('이미 보낸')
  })

  it('응답을 못 받았거나 서버 오류면 이미 나갔을 수 있다고 알린다', () => {
    expect(createNoticeErrorMessage({})).toContain('이미 발송됐을 수 있')
    expect(createNoticeErrorMessage({ status: 502 })).toContain('이미 발송됐을 수 있')
  })

  it('권한·세션', () => {
    expect(createNoticeErrorMessage({ status: 401 })).toContain('로그인')
    expect(createNoticeErrorMessage({ status: 403 })).toContain('권한')
  })

  // QA 2026-11-02 ANOTICE-03 — 개인 공지의 거절
  it('맡지 않은 사람·받을 사람 없음', () => {
    expect(createNoticeErrorMessage({ status: 400, data: { error: 'bad_recipient' } }, 'person')).toContain('담당하지 않는 분')
    expect(createNoticeErrorMessage({ status: 400, data: { error: 'no_recipients', excluded: ['d1'] } }, 'person')).toContain(
      '계약 종료',
    )
  })

  // 옛 서버는 directoryIds 를 버리고 근무지가 없다고 400 bad_request — 「제목과 내용을 확인」이 아니다
  it('개인 발송의 400 bad_request 는 서버 업데이트 안내다', () => {
    const msg = createNoticeErrorMessage({ status: 400, data: { error: 'bad_request' } }, 'person')
    expect(msg).toContain(PEOPLE_UNSUPPORTED)
    expect(msg).toContain('보내지 않았습니다')
    expect(createNoticeErrorMessage({ status: 400, data: { error: 'bad_request' } })).toContain('제목과 내용')
  })
})

describe('peopleCountFailure', () => {
  it('개인 선택을 모르는 서버 — 지금 운영(경로 없음 404)·1묶음 서버(근무지 칸 없음 400)', () => {
    expect(peopleCountFailure({ status: 404, data: { error: 'not_found' } })).toBe('unsupported')
    expect(peopleCountFailure({ status: 400, data: { error: 'bad_request' } })).toBe('unsupported')
  })
  it('맡지 않은 사람·그 밖의 실패', () => {
    expect(peopleCountFailure({ status: 403, data: { error: 'bad_recipient' } })).toBe('bad_recipient')
    expect(peopleCountFailure({ status: 403, data: { error: 'forbidden' } })).toBe('failed')
    expect(peopleCountFailure({ status: 500 })).toBe('failed')
    expect(peopleCountFailure(new Error('network'))).toBe('failed')
  })
})

describe('peopleRecipientText', () => {
  it('고른 사람이 없으면 적지 않는다', () => {
    expect(peopleRecipientText(0, undefined, null)).toBeNull()
  })
  it('센 수·세는 중·못 셈', () => {
    expect(peopleRecipientText(3, 2, null)).toBe('받는 사람 2명')
    expect(peopleRecipientText(3, undefined, null)).toBe('받는 사람 세는 중…')
    expect(peopleRecipientText(3, null, 'failed')).toBe('받는 사람 수를 세지 못했습니다')
  })
  it('옛 서버·맡지 않은 사람·상한 초과는 까닭을 적는다', () => {
    expect(peopleRecipientText(3, null, 'unsupported')).toBe(PEOPLE_UNSUPPORTED)
    expect(peopleRecipientText(3, null, 'bad_recipient')).toContain('담당하지 않는 분')
    expect(peopleRecipientText(NOTICE_PEOPLE_MAX + 1, undefined, null)).toContain(`${NOTICE_PEOPLE_MAX}명까지`)
  })
})

describe('excludedNote', () => {
  it('받지 않은 분이 있으면 수를 적는다', () => {
    expect(excludedNote(['d1', 'd2'])).toBe('2명은 계약 종료 등으로 받지 않았습니다.')
  })
  it('근무지 공지(칸 없음)·0명은 적지 않는다', () => {
    expect(excludedNote(undefined)).toBeNull()
    expect(excludedNote([])).toBeNull()
  })
})

// QA 2026-11-02 ANOTICE-02 — 근무지를 골라도 대상 인원이 안 보였다
describe('recipientSummary', () => {
  it('한 곳이면 정확한 수다', () => {
    expect(recipientSummary([12])).toBe('받는 사람 12명')
  })
  // 서버는 겹친 분에게 한 번만 보내는데 수는 근무지마다 따로 와서 겹침을 뺄 수 없다
  it('여러 곳이면 합계를 최대로 적는다', () => {
    expect(recipientSummary([12, 5])).toBe('받는 사람 최대 17명 · 여러 곳에 배정된 분은 한 번만 받습니다')
  })
  it('세는 중·실패·안 고름을 가른다', () => {
    expect(recipientSummary([12, undefined])).toBe('받는 사람 세는 중…')
    expect(recipientSummary([12, null])).toBe('받는 사람 수를 세지 못했습니다')
    expect(recipientSummary([])).toBeNull()
  })
})

// 서버 2026-11-04 — 여러 근무지를 한 번에 세는 길(GET /dbo/worksites/recipients)
describe('recipientCountPlan', () => {
  it('고른 곳이 없으면 세지 않는다', () => {
    expect(recipientCountPlan(0, false)).toBe('none')
    expect(recipientCountPlan(0, true)).toBe('none')
  })

  it('100곳까지는 한 번에 센다', () => {
    expect(recipientCountPlan(1, false)).toBe('total')
    expect(recipientCountPlan(RECIPIENT_TOTAL_MAX, false)).toBe('total')
  })

  // 서버가 100곳을 넘으면 400 이다. 「전체 선택」(300곳 가까이)은 예전처럼 「최대」로 적는다
  it('100곳을 넘으면 근무지마다 센다', () => {
    expect(recipientCountPlan(RECIPIENT_TOTAL_MAX + 1, false)).toBe('each')
  })

  it('그 길이 없는 옛 서버면 근무지마다 센다', () => {
    expect(recipientCountPlan(2, true)).toBe('each')
  })
})

describe('isMissingRoute', () => {
  it('404·405 는 길이 없는 서버다', () => {
    expect(isMissingRoute({ status: 404, data: { error: 'not_found' } })).toBe(true)
    expect(isMissingRoute({ statusCode: 405 })).toBe(true)
  })

  // 권한·형식 오류는 새 서버의 답이다 — 근무지마다 세어도 같은 이유로 막힌다
  it('다른 오류는 길이 있는 서버의 실패다', () => {
    expect(isMissingRoute({ status: 403, data: { error: 'bad_worksite' } })).toBe(false)
    expect(isMissingRoute({ status: 400, data: { error: 'bad_request' } })).toBe(false)
    expect(isMissingRoute({ status: 500 })).toBe(false)
    expect(isMissingRoute(new Error('network'))).toBe(false)
  })
})

describe('recipientTotalSummary', () => {
  // 겹친 분을 서버가 한 번만 센 수라 「최대」를 붙이지 않는다
  it('한 번에 센 수는 정확한 수로 적는다', () => {
    expect(recipientTotalSummary(15)).toBe('받는 사람 15명')
    expect(recipientTotalSummary(0)).toBe('받는 사람 0명')
  })

  it('세는 중·실패를 가른다', () => {
    expect(recipientTotalSummary(undefined)).toBe('받는 사람 세는 중…')
    expect(recipientTotalSummary(null)).toBe('받는 사람 수를 세지 못했습니다')
  })
})
