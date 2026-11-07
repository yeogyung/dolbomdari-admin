// 채팅방 목록 상태·종류·AI 필터 조회 조건 테스트(QA 2026-11-07 ADMIN-01)
import { describe, expect, it } from 'vitest'
import { ROOM_AI_OPTIONS, ROOM_KIND_OPTIONS, ROOM_STATUS_OPTIONS, roomFilterQuery } from '../app/utils/roomFilters'

describe('roomFilterQuery', () => {
  it('전체(빈 값)는 보내지 않는다', () => {
    expect(roomFilterQuery({ status: '', kind: '', ai: '' })).toEqual({})
  })
  it('서버 값을 그대로 보낸다', () => {
    expect(roomFilterQuery({ status: 'closed', kind: 'direct', ai: 'true' })).toEqual({
      status: 'closed',
      kind: 'direct',
      ai: 'true',
    })
    expect(roomFilterQuery({ status: 'active', kind: 'group', ai: 'false' })).toEqual({
      status: 'active',
      kind: 'group',
      ai: 'false',
    })
  })
  it('정해진 값이 아니면(손으로 고친 주소) 그 칸만 뺀다 — 서버 400 으로 목록이 비지 않게', () => {
    expect(roomFilterQuery({ status: 'ended', kind: 'GROUP', ai: '1' })).toEqual({})
    expect(roomFilterQuery({ status: 'active', kind: 'x', ai: '' })).toEqual({ status: 'active' })
  })
  it('선택지의 값은 모두 조회 조건으로 통과한다', () => {
    for (const o of ROOM_STATUS_OPTIONS) expect(roomFilterQuery({ status: o.value, kind: '', ai: '' }).status ?? '').toBe(o.value)
    for (const o of ROOM_KIND_OPTIONS) expect(roomFilterQuery({ status: '', kind: o.value, ai: '' }).kind ?? '').toBe(o.value)
    for (const o of ROOM_AI_OPTIONS) expect(roomFilterQuery({ status: '', kind: '', ai: o.value }).ai ?? '').toBe(o.value)
  })
})
