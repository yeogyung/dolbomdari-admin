// 버튼 중복 클릭 방지 — 처리 중에는 다시 부르지 않고, 끝나면(실패해도) 풀린다
import { describe, expect, it } from 'vitest'
import { createClickGuard } from '../app/utils/clickGuard'

const deferred = () => {
  let resolve!: () => void
  let reject!: (e: unknown) => void
  const promise = new Promise<void>((res, rej) => ((resolve = res), (reject = rej)))
  return { promise, resolve, reject }
}

describe('createClickGuard', () => {
  it('처리 중에 다시 눌러도 한 번만 부른다', async () => {
    const d = deferred()
    let calls = 0
    const guard = createClickGuard()
    guard.run(() => (calls++, d.promise))
    guard.run(() => (calls++, d.promise))
    expect(calls).toBe(1)
    expect(guard.pending.value).toBe(true)
    d.resolve()
    await d.promise
    await Promise.resolve()
    expect(guard.pending.value).toBe(false)
    guard.run(() => (calls++, undefined))
    expect(calls).toBe(2)
  })

  it('실패해도 풀린다', async () => {
    const d = deferred()
    const guard = createClickGuard()
    const done = guard.run(() => d.promise)
    d.reject(new Error('boom'))
    await expect(done).rejects.toThrow('boom')
    expect(guard.pending.value).toBe(false)
  })

  it('Promise 를 돌려주지 않는 처리(모달 닫기 등)는 잠그지 않는다', () => {
    const guard = createClickGuard()
    guard.run(() => false)
    expect(guard.pending.value).toBe(false)
  })
})
