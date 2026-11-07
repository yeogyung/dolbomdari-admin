// 어드민 채팅방 만들기·참여자 관리 판정·문구 테스트(QA 2026-11-02 CHAT-01 · CHAT-03)
import { describe, expect, it } from 'vitest'
import {
  MEMBERS_UNSUPPORTED,
  ROOM_MEMBERS_MAX,
  ROOM_TITLE_MAX,
  canCreateRoom,
  roomCreateErrorMessage,
  roomCreatedToast,
  roomEditBlock,
  roomMemberErrorMessage,
} from '../app/utils/roomManage'

describe('canCreateRoom', () => {
  it('이름 1~100자(앞뒤 공백 뺌)·참여자 1~500명', () => {
    expect(canCreateRoom({ title: ' 1조 ', profileIds: ['p1'] })).toBe(true)
    expect(canCreateRoom({ title: '   ', profileIds: ['p1'] })).toBe(false)
    expect(canCreateRoom({ title: 'ㄱ'.repeat(ROOM_TITLE_MAX), profileIds: ['p1'] })).toBe(true)
    expect(canCreateRoom({ title: 'ㄱ'.repeat(ROOM_TITLE_MAX + 1), profileIds: ['p1'] })).toBe(false)
    expect(canCreateRoom({ title: '1조', profileIds: [] })).toBe(false)
    const many = Array.from({ length: ROOM_MEMBERS_MAX + 1 }, (_, i) => `p${i}`)
    expect(canCreateRoom({ title: '1조', profileIds: many.slice(0, ROOM_MEMBERS_MAX) })).toBe(true)
    expect(canCreateRoom({ title: '1조', profileIds: many })).toBe(false)
  })
})

describe('roomCreateErrorMessage', () => {
  // 새 서버의 개설은 404 를 내지 않는다 — 404 는 그 경로가 없는 옛 서버다
  it('옛 서버(경로 없음)는 서버 업데이트 안내', () => {
    expect(roomCreateErrorMessage({ status: 404, data: { error: 'not_found' } })).toBe('방 만들기는 서버 업데이트 뒤에 쓸 수 있습니다.')
  })
  it('bad_member 는 아무것도 만들지 않았다고 알린다', () => {
    const msg = roomCreateErrorMessage({ status: 400, data: { error: 'bad_member', invalid: [] } })
    expect(msg).toContain('방을 만들지 않았습니다')
  })
  it('형식·권한·세션', () => {
    expect(roomCreateErrorMessage({ status: 400, data: { error: 'bad_request' } })).toContain('방 이름')
    expect(roomCreateErrorMessage({ status: 403, data: { error: 'forbidden' } })).toContain('권한')
    expect(roomCreateErrorMessage({ status: 401 })).toContain('로그인')
  })
  // 되돌린 실패는 500 으로 온다. 응답이 없으면 만들어졌을 수 있다
  it('서버 실패와 응답 없음을 가른다', () => {
    expect(roomCreateErrorMessage({ status: 500, data: { error: 'internal' } })).toContain('만들지 못했습니다')
    expect(roomCreateErrorMessage({ status: 502 })).toContain('만들어졌을 수 있으니')
    expect(roomCreateErrorMessage({ status: 503, data: { error: 'internal' } })).toContain('만들지 못했습니다')
    expect(roomCreateErrorMessage(new Error('network'))).toContain('만들어졌을 수 있으니')
  })
})

// QA 2026-11-02 CHAT-03 — 서버 decideRoomEdit 와 같은 순서(상태 먼저)
describe('roomEditBlock', () => {
  it('활성 단체방만 바꿀 수 있다', () => {
    expect(roomEditBlock({ kind: 'group', status: 'active' })).toBeNull()
  })
  it('종료된 방은 1:1 이어도 종료 문구가 먼저다', () => {
    expect(roomEditBlock({ kind: 'direct', status: 'closed' })).toBe('종료된 방입니다. 다시 열고 바꿔 주세요.')
    expect(roomEditBlock({ kind: 'group', status: 'closed' })).toBe('종료된 방입니다. 다시 열고 바꿔 주세요.')
  })
  it('1:1 방은 바꿀 수 없다', () => {
    expect(roomEditBlock({ kind: 'direct', status: 'active' })).toBe('1:1 대화방은 참여자를 바꿀 수 없습니다.')
  })
})

describe('roomMemberErrorMessage', () => {
  it('409 세 가지는 계약 문구(합니다체)', () => {
    expect(roomMemberErrorMessage({ status: 409, data: { error: 'last_member' } }, 'remove')).toBe(
      '마지막 참여자는 내보낼 수 없습니다. 방을 종료해 주세요.',
    )
    expect(roomMemberErrorMessage({ status: 409, data: { error: 'room_closed' } }, 'add')).toBe(
      '종료된 방입니다. 다시 열고 바꿔 주세요.',
    )
    expect(roomMemberErrorMessage({ status: 409, data: { error: 'direct_room' } }, 'add')).toBe(
      '1:1 대화방은 참여자를 바꿀 수 없습니다.',
    )
  })
  // 옛 서버는 그 경로가 없어 404 not_found. 「멤버 아님」은 not_member 로 따로 온다
  it('404 not_member 와 경로 없음(옛 서버)을 가른다', () => {
    expect(roomMemberErrorMessage({ status: 404, data: { error: 'not_member' } }, 'remove')).toBe('이미 방에 없는 분입니다.')
    expect(roomMemberErrorMessage({ status: 404, data: { error: 'not_found' } }, 'remove')).toBe(MEMBERS_UNSUPPORTED)
    expect(roomMemberErrorMessage({ status: 404, data: { error: 'not_found' } }, 'add')).toBe(MEMBERS_UNSUPPORTED)
  })
  it('bad_member 는 아무도 넣지 않았다고 알린다', () => {
    expect(roomMemberErrorMessage({ status: 400, data: { error: 'bad_member', invalid: [] } }, 'add')).toContain('아무도 넣지 않았습니다')
  })
  it('권한·세션·응답 없음·서버 실패', () => {
    expect(roomMemberErrorMessage({ status: 403, data: { error: 'forbidden' } }, 'add')).toContain('권한')
    expect(roomMemberErrorMessage({ status: 401 }, 'remove')).toContain('로그인')
    expect(roomMemberErrorMessage(new Error('network'), 'remove')).toContain('응답을 확인하지 못했습니다')
    expect(roomMemberErrorMessage({ status: 500, data: { error: 'internal' } }, 'add')).toContain('넣지 못했습니다')
    expect(roomMemberErrorMessage({ status: 500, data: { error: 'internal' } }, 'remove')).toContain('내보내지 못했습니다')
  })
  // 앞단(게이트웨이)의 5xx 는 처리됐는지 모른다 — 처리기의 500 은 늘 internal 이다
  it('게이트웨이 5xx 는 응답 없음과 같다', () => {
    expect(roomMemberErrorMessage({ status: 502 }, 'add')).toContain('응답을 확인하지 못했습니다')
    expect(roomMemberErrorMessage({ status: 504, data: 'Gateway Timeout' }, 'remove')).toContain('응답을 확인하지 못했습니다')
  })
})

describe('roomCreatedToast', () => {
  it('새로 만들면 참여 인원과 함께 만들었다고', () => {
    expect(roomCreatedToast({ members: 3 })).toEqual({ title: '방을 만들었습니다. 참여자 3명', color: 'success' })
  })
  it('같은 두 사람 방이 이미 있으면(existing) 만들었다고 하지 않고 이름·AI 설정이 쓰이지 않는다고', () => {
    const t = roomCreatedToast({ members: 2, existing: true })
    expect(t.title).toBe('이미 있는 두 사람 방으로 이동합니다.')
    expect(t.description).toContain('방 이름과 AI 답변 설정은 쓰이지 않고')
    expect(t.color).toBe('info')
  })
})
