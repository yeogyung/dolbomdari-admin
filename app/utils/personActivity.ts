// 명부 상세의 「받은 공지」·「참여 중인 채팅방」 표기·정리 규칙(QA 2026-11-07 ADMIN-03)
import type { PersonNotice, PersonRoom } from '~/types/dbo'

/**
 * 받은 공지 한 줄의 읽음 표시. 긴급 공지는 「확인」을 눌러야 읽음이다(서버 뷰 규칙) — 그래서 「확인함」이라 쓴다.
 * 앱으로 읽을 수 없던 분(문자만 받음)은 읽은 시각이 늘 비어 「미열람」과 가른다
 */
export function personNoticeRead(
  n: Pick<PersonNotice, 'kind' | 'read_at' | 'can_read'>,
): { label: string; tone: 'green' | 'amber' | 'gray' } {
  if (n.read_at) return { label: n.kind === 'urgent' ? '확인함' : '읽음', tone: 'green' }
  if (!n.can_read) return { label: '문자로만 받음', tone: 'gray' }
  return { label: '미열람', tone: 'amber' }
}

/** 받은 공지 건수 — 미열람은 앱으로 읽을 수 있었는데 안 읽은 것만 센다 */
export function personNoticeCounts(items: Pick<PersonNotice, 'read_at' | 'can_read'>[]): { total: number; unread: number } {
  return { total: items.length, unread: items.filter((n) => n.can_read && !n.read_at).length }
}

/** 옛 서버(경로 없음)인가. 새 서버의 「명부에 없음」 404 는 `not_found` 코드가 있어 가른다 */
export function personNoticesUnsupported(e: any): boolean {
  const status = e?.status ?? e?.statusCode
  return status === 405 || (status === 404 && e?.data?.error !== 'not_found')
}

/**
 * 멤버 줄(앱 계정마다) → 방 목록. 계정이 여럿이어도 같은 방은 한 번, 방을 못 읽은 줄(null)은 뺀다.
 * 활성 방을 먼저, 그 안에서는 이름 가나다순
 */
export function personRooms(rows: { room: PersonRoom | null }[]): PersonRoom[] {
  const byId = new Map<string, PersonRoom>()
  for (const r of rows) if (r.room && !byId.has(r.room.id)) byId.set(r.room.id, r.room)
  return [...byId.values()].sort(
    (a, b) =>
      Number(b.status === 'active') - Number(a.status === 'active') || a.title.localeCompare(b.title, 'ko'),
  )
}
