// 여러 건 차례 처리 도우미 테스트 — 실패해도 이어 가고, 순서대로 한 건씩 부른다
import { describe, expect, it } from 'vitest'
import { failureLines, runSequential } from '../app/utils/bulkRun'

describe('runSequential', () => {
  it('실패한 건이 있어도 끝까지 하고 성공·실패를 나눈다', async () => {
    const result = await runSequential(['a', 'b', 'c'], async (x) => {
      if (x === 'b') throw new Error('boom')
    })
    expect(result.done).toEqual(['a', 'c'])
    expect(result.failed.map((f) => f.item)).toEqual(['b'])
    expect((result.failed[0]!.error as Error).message).toBe('boom')
  })

  it('한 건이 끝난 뒤에 다음 건을 부른다(동시에 보내지 않는다)', async () => {
    let running = 0
    let most = 0
    const order: number[] = []
    await runSequential([1, 2, 3], async (n) => {
      running++
      most = Math.max(most, running)
      await new Promise((r) => setTimeout(r, 1))
      order.push(n)
      running--
    })
    expect(most).toBe(1)
    expect(order).toEqual([1, 2, 3])
  })

  it('한 건 끝날 때마다 진행을 알린다', async () => {
    const seen: [number, number][] = []
    await runSequential(['a', 'b'], async () => {}, (f, t) => seen.push([f, t]))
    expect(seen).toEqual([
      [1, 2],
      [2, 2],
    ])
  })

  it('빈 목록은 부르지 않는다', async () => {
    expect(await runSequential([], async () => {})).toEqual({ done: [], failed: [] })
  })
})

describe('failureLines', () => {
  it('누구 · 왜 한 줄씩', () => {
    expect(
      failureLines(
        [{ item: { name: '홍길동' }, error: { data: { error: 'x' } } }],
        (p) => p.name,
        (e: any) => `사유 ${e.data.error}`,
      ),
    ).toEqual([{ name: '홍길동', reason: '사유 x' }])
  })
})
