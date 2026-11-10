// 담당자 채팅(QA 2026-11-07 MGR-02) — 방 이름·마지막 메시지 미리보기. 앱 채팅 목록과 같은 규칙이다

export type ManagerRoom = {
  id: string
  title: string | null
  kind: string
  status: string
  members: { profileId: string; name: string }[]
  unread: number
  lastAt: string | null
  lastPreview: string
}

export type ManagerMessage = {
  id: string
  sender_type: string
  sender_id: string | null
  body: string | null
  created_at: string
  sender: { name: string | null; role: string | null } | null
  attachments: { id: string; kind: string; filename: string | null }[] | null
}

/**
 * 방 이름 — 두 사람 방은 상대 이름이다(앱과 같다. 앱이 두 사람 방을 단체로 저장해 제목이 「나·상대」일 때가 있다).
 * 세 명 이상은 저장된 제목, 없으면 멤버 이름을 잇는다
 */
export function managerRoomTitle(room: Pick<ManagerRoom, 'title' | 'members'>, meId: string | null): string {
  const others = room.members.filter((m) => m.profileId !== meId).map((m) => m.name).filter(Boolean)
  if (room.members.length === 2 && others.length === 1) return others[0]!
  if (room.title?.trim()) return room.title.trim()
  return others.join(', ') || '채팅방'
}

/** 마지막 메시지 한 줄. 사진만 보낸 메시지는 본문이 비어 있다 */
export function messagePreview(m: { body: string | null; sender_type: string }): string {
  const body = (m.body ?? '').replace(/\s+/g, ' ').trim()
  const text = body || '사진'
  return m.sender_type === 'ai' ? `AI: ${text}` : text
}
