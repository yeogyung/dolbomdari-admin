// 화면 TTL 캐시 — 보관 기간·강제 갱신·실패 미보관·동시 호출 합치기·비우기
import { describe, expect, it, vi } from 'vitest'
import { cachedAtLabel, createTtlCache } from '../app/utils/ttlCache'

function setup() {
  let t = 1_000
  const cache = createTtlCache(() => t)
  return { cache, advance: (ms: number) => (t += ms), now: () => t }
}

describe('createTtlCache', () => {
  it('보관 기간 안에서는 다시 부르지 않고 처음 받은 시각을 돌려준다', async () => {
    const { cache, advance } = setup()
    const fetcher = vi.fn().mockResolvedValue(1)
    const a = await cache.get('k', fetcher, { ttlMs: 100 })
    advance(99)
    const b = await cache.get('k', fetcher, { ttlMs: 100 })
    expect(fetcher).toHaveBeenCalledTimes(1)
    expect(a).toEqual({ value: 1, at: 1_000 })
    expect(b).toEqual({ value: 1, at: 1_000 })
  })

  it('보관 기간이 지나면 다시 부른다', async () => {
    const { cache, advance } = setup()
    const fetcher = vi.fn().mockResolvedValueOnce(1).mockResolvedValueOnce(2)
    await cache.get('k', fetcher, { ttlMs: 100 })
    advance(100)
    expect(await cache.get('k', fetcher, { ttlMs: 100 })).toEqual({ value: 2, at: 1_100 })
  })

  it('force 면 보관 기간 안이어도 다시 부른다', async () => {
    const { cache } = setup()
    const fetcher = vi.fn().mockResolvedValueOnce(1).mockResolvedValueOnce(2)
    await cache.get('k', fetcher)
    expect((await cache.get('k', fetcher, { force: true })).value).toBe(2)
  })

  it('실패는 보관하지 않는다 — 다음 호출이 다시 부른다', async () => {
    const { cache } = setup()
    const fetcher = vi.fn().mockRejectedValueOnce(new Error('x')).mockResolvedValueOnce(2)
    await expect(cache.get('k', fetcher)).rejects.toThrow('x')
    expect((await cache.get('k', fetcher)).value).toBe(2)
  })

  it('같은 키를 동시에 부르면 한 번만 요청한다', async () => {
    const { cache } = setup()
    const fetcher = vi.fn().mockResolvedValue(1)
    await Promise.all([cache.get('k', fetcher), cache.get('k', fetcher)])
    expect(fetcher).toHaveBeenCalledTimes(1)
  })

  it('키가 다르면 따로 보관한다', async () => {
    const { cache } = setup()
    await cache.get('a', async () => 1)
    expect((await cache.get('b', async () => 2)).value).toBe(2)
  })

  it('clear 뒤에는 다시 부른다', async () => {
    const { cache } = setup()
    const fetcher = vi.fn().mockResolvedValue(1)
    await cache.get('k', fetcher)
    cache.clear()
    await cache.get('k', fetcher)
    expect(fetcher).toHaveBeenCalledTimes(2)
  })

  it('기본 보관 기간은 5분', async () => {
    const { cache, advance } = setup()
    const fetcher = vi.fn().mockResolvedValue(1)
    await cache.get('k', fetcher)
    advance(5 * 60_000 - 1)
    await cache.get('k', fetcher)
    expect(fetcher).toHaveBeenCalledTimes(1)
    advance(1)
    await cache.get('k', fetcher)
    expect(fetcher).toHaveBeenCalledTimes(2)
  })
})

describe('cachedAtLabel', () => {
  it('서울 시각 HH:MM 기준', () => {
    expect(cachedAtLabel(Date.parse('2026-10-14T00:05:00Z'))).toBe('09:05 기준')
  })
})
