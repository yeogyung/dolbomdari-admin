// 어드민 공지 작성 규칙 테스트 — 유형 변환·보낼 수 있는지·오류 문구(QA 2026-10-14 15번)
import { describe, expect, it } from 'vitest'
import {
  BODY_MAX,
  buildNoticeBody,
  canSubmitNotice,
  createNoticeErrorMessage,
  NOTICE_IMAGE_BYTES,
  noticeImagePath,
  pickNoticeImage,
  recipientSummary,
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
