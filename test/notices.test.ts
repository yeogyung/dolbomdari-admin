import { describe, it, expect } from 'vitest'
import { noticeReadLabel, deliveryLabel } from '../app/utils/notices'
import type { NoticeRecipient } from '../app/types/dbo'

const recipient: NoticeRecipient = { notice_id: 'n', directory_id: 'd', name: '참여자', phone: null, can_read: false, sms_status: 'accepted', push_status: 'skipped', read_at: null, read_method: null }
describe('공지 열람 상태', () => {
  it('문자 접수를 열람 완료나 미열람으로 취급하지 않는다', () => {
    expect(noticeReadLabel(recipient)).toBe('앱 미가입 · 확인 대상 아님')
    expect(deliveryLabel('accepted')).toBe('발송 접수')
  })
  it('앱 가입자는 문자도 받았더라도 읽지 않았으면 미열람이다', () => {
    expect(noticeReadLabel({ ...recipient, can_read: true })).toBe('미열람')
  })
  it('실제 확인 기록이 있으면 가입 시점의 상태보다 우선한다', () => {
    expect(noticeReadLabel({ ...recipient, read_at: '2026-09-17', read_method: 'confirm' })).toBe('확인 완료')
  })
})
