// 채팅방 목록 참여 인원 세기 테스트(QA 2026-11-02 CHAT-02)
import { describe, expect, it } from 'vitest'
import { countMembers, lastMessagesFromList } from '../app/composables/useRoomStats'

describe('countMembers', () => {
  it('방별로 멤버 수를 센다', () => {
    const m = countMembers(['a', 'b'], [{ room_id: 'a' }, { room_id: 'a' }, { room_id: 'b' }])
    expect(m.get('a')).toBe(2)
    expect(m.get('b')).toBe(1)
  })

  // 멤버가 없는 방도 칸이 비지 않고 0 으로 보인다
  it('멤버가 없는 방은 0 이다', () => {
    expect(countMembers(['a', 'c'], [{ room_id: 'a' }]).get('c')).toBe(0)
  })
})

// 서버 2026-11-04 — 목록에 last_message_at 이 실려 오면 방마다 메시지를 읽지 않는다
describe('lastMessagesFromList', () => {
  it('목록의 마지막 메시지 시각을 쓴다. 메시지가 없는 방은 null 이다', () => {
    const m = lastMessagesFromList([
      { id: 'a', last_message_at: '2026-10-22T05:00:00+00:00' },
      { id: 'b', last_message_at: null },
    ])
    expect(m?.get('a')).toBe('2026-10-22T05:00:00+00:00')
    expect(m?.get('b')).toBeNull()
  })

  // 옛 서버는 칸이 없다 — 방마다 읽는 예전 길로 간다
  it('칸이 없는 방이 하나라도 있으면 null 이다', () => {
    expect(lastMessagesFromList([{ id: 'a' }])).toBeNull()
    expect(lastMessagesFromList([{ id: 'a', last_message_at: null }, { id: 'b' }])).toBeNull()
  })
})
