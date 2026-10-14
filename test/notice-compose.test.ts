// 어드민 공지 작성 규칙 테스트 — 유형 변환·보낼 수 있는지·오류 문구(QA 2026-10-14 15번)
import { describe, expect, it } from 'vitest'
import {
  BODY_MAX,
  buildNoticeBody,
  canSubmitNotice,
  createNoticeErrorMessage,
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
