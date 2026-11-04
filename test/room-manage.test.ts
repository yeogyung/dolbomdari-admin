// 어드민 채팅방 만들기·참여자 관리 판정·문구 테스트(QA 2026-11-02 CHAT-01 · CHAT-03)
import { describe, expect, it } from 'vitest'
import { ROOM_MEMBERS_MAX, ROOM_TITLE_MAX, canCreateRoom, roomCreateErrorMessage } from '../app/utils/roomManage'

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
    expect(roomCreateErrorMessage(new Error('network'))).toContain('만들어졌을 수 있으니')
  })
})
