import { describe, it, expect } from 'vitest'
import {
  noticeReadLabel,
  deliveryLabel,
  noticeTypeLabel,
  pushDeliveryLine,
  pushErrorLabel,
  pushSummaryHidden,
  smsCellFailed,
  smsCellLabel,
  smsListRangeError,
  smsListUnsupported,
  smsResultLabel,
} from '../app/utils/notices'
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

// QA 2026-11-02 ANOTICE-05 — 「발송 접수」와 실제 도착·실패를 가른다
describe('문자 실제 결과', () => {
  it('결과가 있으면 결과로, 실패면 사유를 함께 적는다', () => {
    expect(smsCellLabel({ ...recipient, sms_result: 'delivered', sms_reason: null })).toBe('수신 완료')
    expect(smsCellLabel({ ...recipient, sms_result: 'failed', sms_reason: '없는 번호(가입자 없음)' })).toBe('수신 실패(없는 번호(가입자 없음))')
    expect(smsCellLabel({ ...recipient, sms_result: 'rejected', sms_reason: '전화번호 없음' })).toBe('보내지 못함(전화번호 없음)')
    expect(smsCellLabel({ ...recipient, sms_result: 'pending', sms_reason: null })).toBe('결과 확인 중')
    expect(smsCellLabel({ ...recipient, sms_result: 'unknown', sms_reason: null })).toBe('결과 모름')
  })
  it('사유가 없는 실패는 한 단어만', () => {
    expect(smsResultLabel('failed', null)).toBe('수신 실패')
  })
  // 문자 없는 공지·서버 업데이트 전 발송은 null, 옛 서버는 칸이 없다 — 지금처럼 접수 상태
  it('결과가 없으면 접수 상태 그대로', () => {
    expect(smsCellLabel({ ...recipient, sms_result: null })).toBe('발송 접수')
    expect(smsCellLabel(recipient)).toBe('발송 접수')
    expect(smsCellLabel({ ...recipient, sms_status: 'skipped' })).toBe('대상 아님')
  })
  it('실패로 칠하는 칸', () => {
    expect(smsCellFailed({ sms_status: 'accepted', sms_result: 'failed' })).toBe(true)
    expect(smsCellFailed({ sms_status: 'failed', sms_result: 'rejected' })).toBe(true)
    // 접수는 됐지만 실제로 도착했으면 실패가 아니다
    expect(smsCellFailed({ sms_status: 'accepted', sms_result: 'delivered' })).toBe(false)
    expect(smsCellFailed({ sms_status: 'failed' })).toBe(true)
    expect(smsCellFailed({ sms_status: 'accepted' })).toBe(false)
  })
})

describe('문자 실패 모아 보기', () => {
  it('옛 서버(404)는 안내로 가른다', () => {
    expect(smsListUnsupported({ status: 404, data: { error: 'not_found' } })).toBe(true)
    expect(smsListUnsupported({ status: 500 })).toBe(false)
  })
  it('시작일이 종료일보다 늦으면 막는다(서버 400)', () => {
    expect(smsListRangeError('2026-11-05', '2026-11-01')).toBe('시작일은 종료일보다 늦을 수 없습니다.')
    expect(smsListRangeError('2026-11-01', '2026-11-01')).toBeNull()
    expect(smsListRangeError('', '2026-11-01')).toBeNull()
  })
})
