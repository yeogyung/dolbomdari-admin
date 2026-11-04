// 명부 상태·배정 저장의 근무 정리 실패 문구 테스트 — 서버 500 shift_sync_failed(QA 2026-11-02 ADM-04 · 결정 D4)
import { describe, expect, it } from 'vitest'
import { shiftSyncFailedMessage } from '../app/utils/dbo'

const failed = { status: 500, data: { error: 'shift_sync_failed' } }

describe('shiftSyncFailedMessage', () => {
  // 상태는 이미 바뀌었다. 「저장 실패」로 적으면 다시 바꾸려다 엉뚱한 상태로 되돌릴 수 있다
  it('상태는 바뀌었고 다시 저장하면 맞춰진다고 알린다', () => {
    expect(shiftSyncFailedMessage(failed, 'save')).toBe(
      '상태는 바뀌었지만 오늘·내일 근무 정리만 실패했습니다. 「저장」을 한 번 더 누르면 맞춰집니다.',
    )
  })

  // 종료 뒤에는 「계약 종료」 버튼이 사라진다 — 인적사항의 저장으로 다시 맞춘다
  it('계약 종료는 인적사항의 저장으로 안내한다', () => {
    expect(shiftSyncFailedMessage(failed, 'end')).toBe(
      '계약은 종료됐지만 오늘·내일 근무 정리만 실패했습니다. 인적사항의 「저장」을 한 번 더 누르면 맞춰집니다.',
    )
  })

  // 배정 등록 창에서 다시 누르면 같은 배정이 또 생긴다 — 저장된 배정을 「수정」으로 다시 저장하게 한다
  it('배정은 저장됐다고 알리고 그 배정의 수정으로 안내한다', () => {
    expect(shiftSyncFailedMessage(failed, 'assignment')).toBe(
      '배정은 저장됐지만 오늘·내일 근무 정리만 실패했습니다. 목록에서 그 배정의 「수정」을 열어 저장을 한 번 더 누르면 맞춰집니다.',
    )
  })

  // 옛 서버·다른 오류는 공용 문구로 간다
  it('다른 오류는 고르지 않는다', () => {
    expect(shiftSyncFailedMessage({ status: 500, data: { error: 'internal' } }, 'save')).toBeNull()
    expect(shiftSyncFailedMessage({ status: 409, data: { error: 'phone_taken' } }, 'save')).toBeNull()
    expect(shiftSyncFailedMessage(new Error('network'), 'end')).toBeNull()
  })
})
