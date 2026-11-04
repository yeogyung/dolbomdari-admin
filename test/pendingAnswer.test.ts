// 저장하지 않고 닫기 확인을 한 번에 하나만 묻는 규칙 테스트(QA 2026-11-02 ADM-01 · 결정 F8)
import { describe, expect, it } from 'vitest'
import { createPendingAnswer } from '../app/utils/pendingAnswer'

describe('createPendingAnswer', () => {
  it('묻는 사이 또 물으면 같은 답을 기다린다 — 닫기와 메뉴 이동이 같은 확인 창을 본다', async () => {
    const q = createPendingAnswer()
    const close = q.ask()
    const leave = q.ask()
    expect(leave).toBe(close)
    q.answer(true)
    await expect(close).resolves.toBe(true)
    await expect(leave).resolves.toBe(true)
  })

  it('답한 뒤 다시 물으면 새로 묻는다', async () => {
    const q = createPendingAnswer()
    const first = q.ask()
    q.answer(false)
    await expect(first).resolves.toBe(false)
    const second = q.ask()
    expect(second).not.toBe(first)
    q.answer(true)
    await expect(second).resolves.toBe(true)
  })

  it('묻는 중이 아닐 때 답해도 아무 일도 없다 — 다음 물음의 답이 되지 않는다', async () => {
    const q = createPendingAnswer()
    q.answer(true)
    const next = q.ask()
    q.answer(false)
    await expect(next).resolves.toBe(false)
  })
})
