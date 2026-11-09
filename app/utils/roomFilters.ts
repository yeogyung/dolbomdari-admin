// 채팅방 목록의 상태·종류·AI 사용 필터 — 서버(GET /rooms)가 받는 값만 보낸다(QA 2026-11-07 ADMIN-01)

export type RoomFilterQuery = {
  status?: 'active' | 'closed'
  kind?: 'group' | 'direct'
  ai?: 'true' | 'false'
}

export const ROOM_STATUS_OPTIONS = [
  { label: '상태 전체', value: '' },
  { label: '활성', value: 'active' },
  { label: '종료', value: 'closed' },
]

/** 「1:1」은 앱의 「담당 선생님과 채팅하기」 방이다. 앱·어드민에서 두 사람을 골라 만든 방은 「단체」로 저장된다 */
export const ROOM_KIND_OPTIONS = [
  { label: '종류 전체', value: '' },
  // 결정 D30(2026-11-09) — 방 종류 칸이 아니라 멤버 수로 나눈다(서버가 그 기준으로 거른다)
  { label: '단체(3명 이상)', value: 'group' },
  { label: '1:1(2명)', value: 'direct' },
]

export const ROOM_AI_OPTIONS = [
  { label: 'AI 전체', value: '' },
  { label: 'AI 사용', value: 'true' },
  { label: 'AI 안 씀', value: 'false' },
]

const pick = <T extends string>(value: string, allowed: readonly T[]): T | undefined =>
  (allowed as readonly string[]).includes(value) ? (value as T) : undefined

/**
 * 화면 필터 값 → 조회 조건. 빈 값('' 전체)과 정해진 값이 아닌 것(손으로 고친 주소 등)은 보내지 않는다 —
 * 서버는 그 밖의 값을 400 으로 거절해 목록 전체가 안 나온다
 */
export function roomFilterQuery(f: { status: string; kind: string; ai: string }): RoomFilterQuery {
  const out: RoomFilterQuery = {}
  const status = pick(f.status, ['active', 'closed'] as const)
  const kind = pick(f.kind, ['group', 'direct'] as const)
  const ai = pick(f.ai, ['true', 'false'] as const)
  if (status) out.status = status
  if (kind) out.kind = kind
  if (ai) out.ai = ai
  return out
}

/**
 * 방 종류 표시 — 멤버 두 명이면 1:1, 셋 이상이면 단체(결정 D30). 멤버 수를 모르면(옛 서버) 방 종류 칸으로 본다.
 * 0·1명 방은 어느 쪽 필터에도 안 걸리므로 「참여자 없음」으로 적는다
 */
export function roomKindLabel(room: { kind: string; member_count?: number }): '1:1' | '단체' | '참여자 없음' {
  if (room.member_count === undefined) return room.kind === 'direct' ? '1:1' : '단체'
  if (room.member_count === 2) return '1:1'
  return room.member_count >= 3 ? '단체' : '참여자 없음'
}
