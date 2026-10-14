// 명부 「앱 연결」 배지 테스트 — 서버가 실제 로그인 기록으로 판정한 값을 그대로 보인다(QA 2026-10-14 8번)
import { describe, expect, it } from 'vitest'
import { appConnectionBadge } from '../app/utils/dbo'

describe('appConnectionBadge', () => {
  it('연결됨·미연결', () => {
    expect(appConnectionBadge({ app_connected: true })).toEqual({ label: '연결됨', tone: 'green' })
    expect(appConnectionBadge({ app_connected: false })).toEqual({ label: '미연결', tone: 'gray' })
  })

  it('수요처(해당 없음)나 조회 실패로 값이 없으면 배지를 안 그린다', () => {
    expect(appConnectionBadge({ app_connected: null })).toBeNull()
    expect(appConnectionBadge({})).toBeNull()
  })
})
