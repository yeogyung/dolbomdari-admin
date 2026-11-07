// 명부 상세 받은 공지 읽음 표시·건수·옛 서버 판정과 참여 중인 채팅방 정리 테스트(QA 2026-11-07 ADMIN-03)
import { describe, expect, it } from 'vitest'
import { personNoticeCounts, personNoticeRead, personNoticesUnsupported, personRooms } from '../app/utils/personActivity'

describe('personNoticeRead', () => {
  it('읽었으면 읽음, 긴급은 확인함', () => {
    expect(personNoticeRead({ kind: 'normal', read_at: '2026-11-07T01:00:00Z', can_read: true })).toEqual({ label: '읽음', tone: 'green' })
    expect(personNoticeRead({ kind: 'urgent', read_at: '2026-11-07T01:00:00Z', can_read: true })).toEqual({ label: '확인함', tone: 'green' })
  })
  it('앱으로 읽을 수 없던 분은 미열람이 아니라 문자로만 받음', () => {
    expect(personNoticeRead({ kind: 'normal', read_at: null, can_read: false })).toEqual({ label: '문자로만 받음', tone: 'gray' })
  })
  it('앱으로 받고 안 읽었으면 미열람', () => {
    expect(personNoticeRead({ kind: 'urgent', read_at: null, can_read: true })).toEqual({ label: '미열람', tone: 'amber' })
  })
})

describe('personNoticeCounts', () => {
  it('미열람은 앱으로 받고 안 읽은 것만', () => {
    expect(
      personNoticeCounts([
        { read_at: null, can_read: true },
        { read_at: null, can_read: false },
        { read_at: '2026-11-07T01:00:00Z', can_read: true },
      ]),
    ).toEqual({ total: 3, unread: 1 })
  })
})

describe('personNoticesUnsupported', () => {
  it('경로가 없는 옛 서버(코드 없는 404·405)만 true', () => {
    expect(personNoticesUnsupported({ status: 404, data: 'Not Found' })).toBe(true)
    expect(personNoticesUnsupported({ statusCode: 405 })).toBe(true)
  })
  it('새 서버의 명부 없음(404 not_found)과 다른 오류는 false', () => {
    expect(personNoticesUnsupported({ status: 404, data: { error: 'not_found' } })).toBe(false)
    expect(personNoticesUnsupported({ status: 403, data: { error: 'forbidden' } })).toBe(false)
    expect(personNoticesUnsupported({ status: 500 })).toBe(false)
  })
})

describe('personRooms', () => {
  const room = (id: string, title: string, status = 'active') => ({ id, title, kind: 'group', status, ai_enabled: false })
  it('계정이 여럿이어도 같은 방은 한 번, 못 읽은 줄은 뺀다', () => {
    expect(personRooms([{ room: room('r1', '가') }, { room: null }, { room: room('r1', '가') }]).map((r) => r.id)).toEqual(['r1'])
  })
  it('활성 방 먼저, 그 안에서 이름 가나다순', () => {
    expect(
      personRooms([{ room: room('r1', '다') }, { room: room('r2', '가', 'closed') }, { room: room('r3', '나') }]).map((r) => r.id),
    ).toEqual(['r3', 'r1', 'r2'])
  })
})
