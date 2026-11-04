// 사람 고르기 규칙 테스트 — 이름·연락처 찾기와 공지 개인 받는 사람 후보(QA 2026-11-02 ANOTICE-03)
import { describe, expect, it } from 'vitest'
import { filterPeople, noticePeople } from '../app/utils/personPick'

const people = [
  { id: 'a', name: '김 구구', phone: '010-1111-2222' },
  { id: 'b', name: '최순자', phone: '01033334444' },
  { id: 'c', name: '김미영', phone: null },
]

describe('filterPeople', () => {
  it('빈 검색어는 모두', () => {
    expect(filterPeople(people, '  ')).toHaveLength(3)
  })
  it('이름은 띄어쓰기를 무시한다', () => {
    expect(filterPeople(people, '김구').map((p) => p.id)).toEqual(['a'])
    expect(filterPeople(people, '김').map((p) => p.id)).toEqual(['a', 'c'])
  })
  // 같은 이름이 흔해 끝 네 자리로 가린다. 하이픈이 있든 없든 숫자만 비교한다
  it('숫자는 연락처에서도 찾는다', () => {
    expect(filterPeople(people, '2222').map((p) => p.id)).toEqual(['a'])
    expect(filterPeople(people, '3333-4444').map((p) => p.id)).toEqual(['b'])
  })
})

describe('noticePeople', () => {
  it('명부 id 로 고르고, 앱 미연결은 비고에만 적는다(고를 수 있다)', () => {
    const out = noticePeople([
      { id: 'd1', name: '김구구', phone: '010', app_connected: true },
      { id: 'd2', name: '오금례', phone: null, app_connected: false },
      { id: 'd3', name: '최순자', phone: null },
    ])
    expect(out).toEqual([
      { id: 'd1', name: '김구구', phone: '010', note: null },
      { id: 'd2', name: '오금례', phone: null, note: '앱 미연결' },
      { id: 'd3', name: '최순자', phone: null, note: null },
    ])
    expect(out.every((p) => !('disabled' in p))).toBe(true)
  })
})
