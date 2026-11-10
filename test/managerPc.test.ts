// 담당자 PC 공지·채팅(QA 2026-11-07 MGR-01·02) — 열람 문구·다시 알리기 가능 여부·방 이름·미리보기를 고정한다
import { describe, expect, it } from 'vitest'
import { canResend, readSummary, resendSummary } from '../app/utils/managerNotices'
import { managerRoomTitle, messagePreview } from '../app/utils/managerChat'

describe('공지 열람', () => {
  it('앱으로 받는 분이 분모이고 문자로만 받는 분은 따로 센다, 옛 공지는 셀 수 없다고 한다', () => {
    expect(readSummary({ tracked: true, total: 12, readable: 10, read: 4 })).toBe('앱으로 받는 10명 중 4명 읽음 · 문자로만 받는 분 2명')
    expect(readSummary({ tracked: true, total: 3, readable: 3, read: 3 })).toBe('앱으로 받는 3명 중 3명 읽음')
    expect(readSummary({ tracked: false, total: 0, readable: 0, read: 0 })).toContain('셀 수 없습니다')
  })

  it('30분 안에 다시 보낸 분은 그때까지 다시 알릴 수 없다', () => {
    const now = Date.parse('2026-11-10T10:00:00Z')
    const p = { directoryId: 'd', name: 'n', phone: null, avatarPath: null, channel: 'push' as const, lastResentAt: null }
    expect(canResend({ ...p, cooldownUntil: null }, now)).toBe(true)
    expect(canResend({ ...p, cooldownUntil: '2026-11-10T10:10:00Z' }, now)).toBe(false)
    expect(canResend({ ...p, cooldownUntil: '2026-11-10T09:59:00Z' }, now)).toBe(true)
  })

  it('다시 알리기 결과는 보낸 수·건너뛴 수·실패를 한 줄로', () => {
    const base = { sent: 3, skipped: 0, sms: { accepted: 1, failed: 0 }, push: { accepted: 2, failed: 0 }, notSent: 0, historyFailed: 0 }
    expect(resendSummary(base)).toBe('3명에게 다시 알렸습니다.')
    expect(resendSummary({ ...base, skipped: 2, push: { accepted: 1, failed: 1 } })).toContain('2명은 이미 읽었거나')
    expect(resendSummary({ ...base, push: { accepted: 1, failed: 1 } })).toContain('앱 알림 1')
  })
})

describe('담당자 채팅', () => {
  const me = 'p-me'
  it('두 사람 방은 상대 이름, 세 명 이상은 제목, 제목이 없으면 멤버 이름', () => {
    const two = [{ profileId: me, name: '김담당' }, { profileId: 'p-1', name: '이순자' }]
    expect(managerRoomTitle({ title: '김담당, 이순자', members: two }, me)).toBe('이순자')
    const three = [...two, { profileId: 'p-2', name: '박영희' }]
    expect(managerRoomTitle({ title: '늘봄 단체방', members: three }, me)).toBe('늘봄 단체방')
    expect(managerRoomTitle({ title: null, members: three }, me)).toBe('이순자, 박영희')
  })

  it('미리보기 — 공백을 한 칸으로, 사진만 보낸 것은 「사진」, AI 답은 앞에 표시', () => {
    expect(messagePreview({ body: '안녕\n하세요', sender_type: 'user' })).toBe('안녕 하세요')
    expect(messagePreview({ body: '', sender_type: 'user' })).toBe('사진')
    expect(messagePreview({ body: '출근은 QR 로', sender_type: 'ai' })).toBe('AI: 출근은 QR 로')
  })
})
