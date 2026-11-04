// 채팅방 대화 보기의 첨부(사진·파일) 그리기와 서명 주소 만료를 가르는 순수 유틸 (QA 2026-11-02 CHAT-04)
import type { ChatAttachment, ChatMessage } from '../types/dbo'

/** 메시지의 첨부, 올린 순서. 옛 서버(2026-11-04 전)는 칸이 없다 — 그때는 지금처럼 글만 보인다 */
export function messageAttachments(m: ChatMessage): ChatAttachment[] {
  return Array.isArray(m.attachments) ? m.attachments : []
}

/**
 * 첨부를 무엇으로 그릴지. 서버가 서명 주소를 못 만들었거나(url null) 브라우저가 사진을 못 읽었으면(만료 등)
 * 「불러오지 못함」이다. 사진이 아닌 것은 파일 이름 링크다.
 */
export function attachmentView(a: ChatAttachment, broken: boolean): 'image' | 'file' | 'unavailable' {
  if (!a.url || broken) return 'unavailable'
  return a.kind === 'image' ? 'image' : 'file'
}

export function attachmentUnavailableText(a: ChatAttachment): string {
  return a.kind === 'image' ? '사진을 불러오지 못했습니다.' : '파일을 불러오지 못했습니다.'
}

/**
 * 서명 주소를 아직 열 수 있다고 보는 시간. 서버는 1시간짜리 주소를 응답 전에 만들므로, 대화를 받은 시각부터
 * 재면 실제 만료보다 조금 늦다 — 5분 앞당겨 본다.
 */
const SIGNED_URL_SAFE_MS = 55 * 60 * 1000

/** 대화를 받은 지 오래돼 첨부 주소가 만료됐다고 볼지. 받은 적이 없으면 아니다 */
export function attachmentUrlsExpired(loadedAt: number | null, now: number): boolean {
  return loadedAt !== null && now - loadedAt >= SIGNED_URL_SAFE_MS
}
