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
  { label: '단체', value: 'group' },
  { label: '1:1', value: 'direct' },
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
