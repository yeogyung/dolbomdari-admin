// 채팅방 목록 참여 인원 세기 테스트(QA 2026-11-02 CHAT-02)
import { describe, expect, it } from 'vitest'
import { countMembers } from '../app/composables/useRoomStats'

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
