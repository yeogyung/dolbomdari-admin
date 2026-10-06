// 서버 페이지 상한(100)을 넘는 목록을 끝까지, 빠짐없이 이어 받는지
import { describe, expect, it } from 'vitest'
import { fetchAllPages } from '../app/utils/paging'

type Row = { id: number }
const source: Row[] = Array.from({ length: 292 }, (_, i) => ({ id: i }))
const pageOf = async (page: number, size: number) => ({
  items: source.slice((page - 1) * size, page * size),
  total: source.length,
})
const byId = (r: Row) => r.id

describe('fetchAllPages', () => {
  it('total 에 닿을 때까지 페이지를 이어 받는다', async () => {
    const all = await fetchAllPages(pageOf, byId)
    expect(all).toHaveLength(292)
    expect(all.at(-1)).toEqual({ id: 291 })
  })

  it('빈 목록이면 한 번만 부른다', async () => {
    let calls = 0
    const all = await fetchAllPages(async () => {
      calls++
      return { items: [] as Row[], total: 0 }
    }, byId)
    expect(all).toEqual([])
    expect(calls).toBe(1)
  })

  it('total 보다 적게 받고 끝나면 실패로 본다 — 빠진 채로 쓰이지 않게', async () => {
    await expect(
      fetchAllPages(async (page) => ({ items: page === 1 ? [{ id: 1 }] : [], total: 5 }), byId),
    ).rejects.toThrow('incomplete_list')
  })

  it('페이지 경계에서 같은 행이 두 번 오면(정렬 불안정) 빠진 행이 있으니 실패로 본다', async () => {
    // 2쪽 첫 행이 1쪽 끝 행과 겹치고, 원래 있어야 할 행(id 2)은 오지 않는다
    const pages: Row[][] = [[{ id: 0 }, { id: 1 }], [{ id: 1 }, { id: 3 }], []]
    await expect(
      fetchAllPages(async (page) => ({ items: pages[page - 1]!, total: 4 }), byId, 2),
    ).rejects.toThrow('incomplete_list')
  })
})
