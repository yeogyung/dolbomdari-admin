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

const status = (e: any): number | undefined => e?.status ?? e?.statusCode
const code = (e: any): string | undefined => (typeof e?.data?.error === 'string' ? e.data.error : undefined)

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
  if (!s) return '응답을 확인하지 못했습니다. 방이 만들어졌을 수 있으니 목록을 새로고침해 확인해 주세요.'
  return '방을 만들지 못했습니다. 잠시 뒤 다시 시도해 주세요.'
}
