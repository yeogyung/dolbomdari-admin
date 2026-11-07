// 어드민 채팅방 만들기·참여자 추가·내보내기의 판정과 오류 문구(QA 2026-11-02 CHAT-01 · CHAT-03, 서버 2026-11-04 계약 3a묶음 4·5번)

/** 방 이름 상한. 서버 `ROOM_TITLE_MAX` 와 같다 */
export const ROOM_TITLE_MAX = 100
/** 한 번에 넣는 참여자 상한. 서버 `ROOM_MEMBERS_MAX` 와 같다 */
export const ROOM_MEMBERS_MAX = 500

/** 방 만들기를 누를 수 있는가 — 이름 1~100자(앞뒤 공백 뺌), 참여자 1~500명 */
export function canCreateRoom(d: { title: string; profileIds: string[] }): boolean {
  const t = d.title.trim()
  return t.length > 0 && t.length <= ROOM_TITLE_MAX && d.profileIds.length > 0 && d.profileIds.length <= ROOM_MEMBERS_MAX
}

const ROOM_CLOSED = '종료된 방입니다. 다시 열고 바꿔 주세요.'
const DIRECT_ROOM = '1:1 대화방은 참여자를 바꿀 수 없습니다.'

/**
 * 이 방의 참여자를 바꿀 수 없는 까닭. 서버 판정(`decideRoomEdit`)과 같은 순서로 **상태를 종류보다 먼저** 본다.
 * 바꿀 수 있으면 null. 화면이 버튼을 막는 데 쓰고, 서버가 409 로 거절해도 같은 문구다(`roomMemberErrorMessage`)
 */
export function roomEditBlock(room: { kind: string; status: string }): string | null {
  if (room.status !== 'active') return ROOM_CLOSED
  if (room.kind === 'direct') return DIRECT_ROOM
  return null
}

const status = (e: any): number | undefined => e?.status ?? e?.statusCode
const code = (e: any): string | undefined => (typeof e?.data?.error === 'string' ? e.data.error : undefined)

/**
 * 처리됐는지 모르는 실패 — 응답이 없거나, 서버 처리기가 아니라 앞단(게이트웨이)이 낸 5xx. 처리기가 내는 500 은 늘
 * `{ error: 'internal' }` 이고 그때는 되돌렸거나 처음부터 하지 않았다(서버 `rooms.ts`·`roomMembers.ts`)
 */
const outcomeUnknown = (e: any): boolean => {
  const s = status(e)
  return !s || (s >= 500 && code(e) !== 'internal')
}

/**
 * 방 만들기(`POST /dbo-admin/rooms`) 오류 문구. 옛 서버는 그 경로가 없어 404 다 — 새 서버의 개설은 404 를 내지 않는다.
 * 응답을 못 받았으면 방이 만들어졌을 수 있다(되돌린 실패는 500 으로 온다).
 */
export function roomCreateErrorMessage(e: any): string {
  const s = status(e)
  const c = code(e)
  if (s === 404 || s === 405) return '방 만들기는 서버 업데이트 뒤에 쓸 수 있습니다.'
  if (c === 'bad_member') {
    return '앱 미연결·계약 종료인 분이 있어 방을 만들지 않았습니다. 표시된 분을 빼고 다시 만들어 주세요.'
  }
  if (s === 400) return '방 이름(100자까지)과 참여자를 확인해 주세요.'
  if (s === 401) return '로그인이 만료되었습니다. 다시 로그인해 주세요.'
  if (s === 403) return '방을 만들 권한이 없습니다. 운영관리자(master) 계정으로 로그인해 주세요.'
  if (outcomeUnknown(e)) return '응답을 확인하지 못했습니다. 방이 만들어졌을 수 있으니 목록을 새로고침해 확인해 주세요.'
  return '방을 만들지 못했습니다. 잠시 뒤 다시 시도해 주세요.'
}

/**
 * 방 만들기가 끝난 뒤 알림(서버 2026-11-07, QA FIELD-04). 고른 사람이 두 명이고 그 둘만 있는 열린 방이 이미 있으면 서버가
 * 새로 만들지 않고 그 방을 준다(200 `existing: true`) — 입력한 방 이름·AI 답변 설정은 쓰이지 않는다고 알린다
 */
export function roomCreatedToast(res: { members: number; existing?: boolean }): {
  title: string
  description?: string
  color: 'success' | 'info'
} {
  if (res.existing) {
    return {
      title: '이미 있는 두 사람 방으로 이동합니다.',
      description: '새 방은 만들지 않았습니다. 입력한 방 이름과 AI 답변 설정은 쓰이지 않고 그 방의 설정 그대로입니다.',
      color: 'info',
    }
  }
  return { title: `방을 만들었습니다. 참여자 ${res.members}명`, color: 'success' }
}

/** 참여자 관리 경로가 없는 옛 서버에서 적는 안내 */
export const MEMBERS_UNSUPPORTED = '참여자 추가·내보내기는 서버 업데이트 뒤에 쓸 수 있습니다.'

/**
 * 참여자 추가(`POST /rooms/{id}/members`)·내보내기(`DELETE /rooms/{id}/members/{profileId}`) 오류 문구.
 *
 * 옛 서버는 이 경로가 없어 404 `not_found` 다. 새 서버의 `not_found` 는 방이 없을 때인데 어드민은 방을 지우지 않고(종료만)
 * 목록에서 방금 연 방이라 옛 서버로 읽는다. 「멤버 아님」은 따로 `not_member` 로 온다.
 */
export function roomMemberErrorMessage(e: any, action: 'add' | 'remove'): string {
  const s = status(e)
  const c = code(e)
  if (c === 'last_member') return '마지막 참여자는 내보낼 수 없습니다. 방을 종료해 주세요.'
  if (c === 'room_closed') return ROOM_CLOSED
  if (c === 'direct_room') return DIRECT_ROOM
  if (c === 'not_member') return '이미 방에 없는 분입니다.'
  if (s === 404 || s === 405) return MEMBERS_UNSUPPORTED
  if (c === 'bad_member') {
    return '앱 미연결·계약 종료인 분이 있어 아무도 넣지 않았습니다. 표시된 분을 빼고 다시 넣어 주세요.'
  }
  if (s === 400) return '참여자를 확인해 주세요.'
  if (s === 401) return '로그인이 만료되었습니다. 다시 로그인해 주세요.'
  if (s === 403) return '참여자를 바꿀 권한이 없습니다. 운영관리자(master) 계정으로 로그인해 주세요.'
  if (outcomeUnknown(e)) return '응답을 확인하지 못했습니다. 다시 불러온 명단에서 바뀌었는지 확인해 주세요.'
  return action === 'add'
    ? '참여자를 넣지 못했습니다. 잠시 뒤 다시 시도해 주세요.'
    : '참여자를 내보내지 못했습니다. 잠시 뒤 다시 시도해 주세요.'
}
