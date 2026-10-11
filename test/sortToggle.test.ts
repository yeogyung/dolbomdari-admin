// 표 머리글을 누를 때의 정렬 전환 — 같은 칸은 방향을 뒤집고, 다른 칸은 오름차순부터
import { describe, expect, it } from 'vitest'
import { nextSort } from '../app/utils/sortToggle'

describe('nextSort', () => {
  it('다른 칸을 누르면 그 칸의 오름차순(가나다순)', () => {
    expect(nextSort({ key: 'created_at', dir: 'asc' }, 'name')).toEqual({ key: 'name', dir: 'asc' })
    expect(nextSort({ key: 'created_at', dir: 'desc' }, 'name')).toEqual({ key: 'name', dir: 'asc' })
  })

  it('같은 칸을 다시 누르면 방향을 뒤집는다', () => {
    expect(nextSort({ key: 'name', dir: 'asc' }, 'name')).toEqual({ key: 'name', dir: 'desc' })
    expect(nextSort({ key: 'name', dir: 'desc' }, 'name')).toEqual({ key: 'name', dir: 'asc' })
  })
})
