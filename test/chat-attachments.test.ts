// 대화 보기 첨부 테스트 — 옛 서버 칸 없음, 사진·파일·불러오지 못함, 서명 주소 만료(QA 2026-11-02 CHAT-04)
import { describe, expect, it } from 'vitest'
import {
  attachmentUnavailableText,
  attachmentUrlsExpired,
  attachmentView,
  messageAttachments,
} from '../app/utils/chatAttachments'
import type { ChatAttachment, ChatMessage } from '../app/types/dbo'

const msg = (extra: Partial<ChatMessage> = {}): ChatMessage => ({
  id: 'm1',
  room_id: 'r1',
  body: '사진 1장',
  created_at: '2026-10-15T15:26:00Z',
  ...extra,
})
const att = (extra: Partial<ChatAttachment> = {}): ChatAttachment => ({
  id: 'a1',
  kind: 'image',
  filename: 'IMG_0001.jpg',
  byte_size: 204800,
  created_at: '2026-10-15T15:26:00Z',
  url: 'https://example.supabase.co/storage/v1/object/sign/dbo-chat-files/x.jpg?token=t',
  ...extra,
})

describe('messageAttachments', () => {
  // 옛 서버는 칸이 없다 — 지금처럼 글만 보인다
  it('칸이 없으면 빈 목록', () => {
    expect(messageAttachments(msg())).toEqual([])
  })
  it('서버가 준 순서 그대로', () => {
    const list = [att({ id: 'a1' }), att({ id: 'a2', kind: 'file' })]
    expect(messageAttachments(msg({ attachments: list })).map((a) => a.id)).toEqual(['a1', 'a2'])
  })
})

describe('attachmentView', () => {
  it('사진은 썸네일, 그 밖은 파일 링크', () => {
    expect(attachmentView(att(), false)).toBe('image')
    expect(attachmentView(att({ kind: 'file', filename: '안내.pdf' }), false)).toBe('file')
  })
  // 서버가 서명 주소를 못 만들면 url 이 null 이다
  it('주소가 없으면 불러오지 못함', () => {
    expect(attachmentView(att({ url: null }), false)).toBe('unavailable')
    expect(attachmentView(att({ kind: 'file', url: null }), false)).toBe('unavailable')
  })
  // 주소가 만료돼 브라우저가 사진을 못 읽은 경우
  it('사진을 못 읽었으면 불러오지 못함', () => {
    expect(attachmentView(att(), true)).toBe('unavailable')
  })
  it('불러오지 못함 문구는 사진·파일을 가른다', () => {
    expect(attachmentUnavailableText(att())).toBe('사진을 불러오지 못했습니다.')
    expect(attachmentUnavailableText(att({ kind: 'file' }))).toBe('파일을 불러오지 못했습니다.')
  })
})

describe('attachmentUrlsExpired', () => {
  const at = Date.UTC(2026, 10, 4, 3, 0, 0)
  const min = 60 * 1000
  it('받은 지 55분 전에는 열 수 있다', () => {
    expect(attachmentUrlsExpired(at, at)).toBe(false)
    expect(attachmentUrlsExpired(at, at + 54 * min)).toBe(false)
  })
  // 서버는 응답 전에 1시간짜리 주소를 만든다 — 받은 시각부터 재면 늦으니 5분 앞당긴다
  it('55분이 지나면 만료로 본다', () => {
    expect(attachmentUrlsExpired(at, at + 55 * min)).toBe(true)
    expect(attachmentUrlsExpired(at, at + 3 * 60 * min)).toBe(true)
  })
  it('대화를 받은 적이 없으면 아니다', () => {
    expect(attachmentUrlsExpired(null, at)).toBe(false)
  })
})
