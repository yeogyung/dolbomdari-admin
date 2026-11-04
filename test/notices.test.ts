import { describe, it, expect } from 'vitest'
import { noticeReadLabel, deliveryLabel, noticeTypeLabel, pushDeliveryLine, pushErrorLabel, pushSummaryHidden } from '../app/utils/notices'
import type { NoticeRecipient, PushSummary } from '../app/types/dbo'

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

// QA 2026-10-14 16번 — 목록 「구분」 칸과 종류 필터가 같은 세 가지 어휘를 쓴다
describe('공지 종류', () => {
  it('긴급·특별·일반을 가른다', () => {
    expect(noticeTypeLabel({ kind: 'urgent', is_special: false })).toBe('긴급')
    expect(noticeTypeLabel({ kind: 'normal', is_special: true })).toBe('특별')
    expect(noticeTypeLabel({ kind: 'normal', is_special: false })).toBe('일반')
  })
})

// QA 2026-11-02 PUSH-01 — 「발송 접수」와 실제 전달·실패를 가른다
describe('앱 알림 실제 전달', () => {
  const base: PushSummary = {
    kind: 'notice', linkId: 'n', since: '2026-11-04T00:00:00.000Z',
    tickets: 0, accepted: 0, rejected: 0, delivered: 0, failed: 0, pending: 0, unknown: 0, errors: {},
  }

  it('전달·실패(접수 뒤 실패 + 접수부터 거절)와 이유', () => {
    const s = { ...base, tickets: 5, accepted: 4, rejected: 1, delivered: 2, failed: 2,
      errors: { InvalidCredentials: 2, DeviceNotRegistered: 1 } }
    expect(pushDeliveryLine(s)).toBe(
      '앱 알림 실제 전달 2 · 실패 3(푸시 인증 설정 오류(InvalidCredentials) 2 · 받을 수 없는 기기(DeviceNotRegistered) 1)',
    )
  })

  it('실패가 없으면 이유를 붙이지 않고, 기다리는 줄·모르는 줄을 덧붙인다', () => {
    expect(pushDeliveryLine({ ...base, tickets: 4, accepted: 4, delivered: 1, pending: 2, unknown: 1 })).toBe(
      '앱 알림 실제 전달 1 · 실패 0 · 결과 기다리는 중 2 · 결과 모름 1',
    )
  })

  it('기록이 없으면 까닭을 적는다(0명 전달로 읽히지 않게)', () => {
    expect(pushDeliveryLine(base)).toContain('전달 기록이 없습니다')
  })

  it('모르는 이유 코드는 그대로, unknown_error 는 「이유 모름」', () => {
    expect(pushErrorLabel('SomethingNew')).toBe('SomethingNew')
    expect(pushErrorLabel('unknown_error')).toBe('이유 모름')
  })

  it('옛 서버(404)·권한 없음(403)은 숨기고, 그 밖의 실패는 알린다', () => {
    expect(pushSummaryHidden({ status: 404, data: { error: 'not_found' } })).toBe(true)
    expect(pushSummaryHidden({ statusCode: 403 })).toBe(true)
    expect(pushSummaryHidden({ status: 500 })).toBe(false)
    expect(pushSummaryHidden(new Error('network'))).toBe(false)
  })
})
