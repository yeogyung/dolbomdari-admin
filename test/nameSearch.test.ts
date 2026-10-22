// 이름 검색 규칙과 디바운스 테스트 — 대시보드 날씨 카드의 근무지 검색 목록이 쓴다
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { nextTick, ref } from 'vue'
import { searchByName } from '../app/utils/nameSearch'
import { useDebounced } from '../app/composables/useDebounced'

const sites = [
  { id: '1', name: '시니어카페 동방점' },
  { id: '2', name: '시니어카페 무악점' },
  { id: '3', name: '야미야미 조리장' },
  { id: '4', name: 'Test Site' },
]

describe('searchByName', () => {
  it('빈 검색어는 아무것도 찾지 않는다 — 목록을 띄우지 않는다', () => {
    expect(searchByName(sites, '   ')).toEqual({ items: [], more: 0 })
  })
  it('이름 일부로 찾는다', () => {
    expect(searchByName(sites, '동방').items.map((s) => s.id)).toEqual(['1'])
  })
  it('띄어쓰기는 무시한다 — 「시니어카페동방」으로도 찾는다', () => {
    expect(searchByName(sites, '시니어카페동방').items.map((s) => s.id)).toEqual(['1'])
    expect(searchByName(sites, '야미 야미').items.map((s) => s.id)).toEqual(['3'])
  })
  it('영문은 대소문자를 가리지 않는다', () => {
    expect(searchByName(sites, 'test').items.map((s) => s.id)).toEqual(['4'])
  })
  it('이름이 검색어로 시작하는 곳을 앞에 둔다', () => {
    const list = [{ id: 'a', name: '서대문 시니어카페' }, ...sites]
    expect(searchByName(list, '시니어카페').items.map((s) => s.id)).toEqual(['1', '2', 'a'])
  })
  it('보조 이름(사업)으로도 찾되, 이름이 맞는 것을 먼저 둔다', () => {
    const list = [
      { id: 'p1', name: '서대문시니어클럽', sub: '시니어컨설턴트' },
      { id: 'p2', name: '서대문시니어클럽', sub: '시니어카페(원본)' },
      { id: 'c1', name: '시니어카페 동방점', sub: '시니어카페' },
    ]
    expect(searchByName(list, '시니어컨설턴트').items.map((s) => s.id)).toEqual(['p1'])
    // 이름이 맞는 c1 이 사업만 맞는 p2 보다 앞
    expect(searchByName(list, '시니어카페').items.map((s) => s.id)).toEqual(['c1', 'p2'])
  })
  it('상한을 넘으면 나머지 수를 알려 준다', () => {
    const many = Array.from({ length: 12 }, (_, i) => ({ id: String(i), name: `근무지 ${i}` }))
    const r = searchByName(many, '근무지', 8)
    expect(r.items).toHaveLength(8)
    expect(r.more).toBe(4)
  })
})

describe('useDebounced', () => {
  beforeEach(() => vi.useFakeTimers())
  afterEach(() => vi.useRealTimers())

  it('입력이 멈춘 뒤에만 값을 넘긴다', async () => {
    const source = ref('')
    const debounced = useDebounced(source, 250)
    source.value = '시'
    await nextTick()
    vi.advanceTimersByTime(100)
    source.value = '시니'
    await nextTick()
    vi.advanceTimersByTime(200)
    expect(debounced.value).toBe('')
    vi.advanceTimersByTime(50)
    expect(debounced.value).toBe('시니')
  })
  it('비우는 것은 바로 넘긴다 — 목록이 남아 보이지 않게', async () => {
    const source = ref('시니')
    const debounced = useDebounced(source, 250)
    expect(debounced.value).toBe('시니')
    source.value = ''
    await nextTick()
    expect(debounced.value).toBe('')
  })
})
