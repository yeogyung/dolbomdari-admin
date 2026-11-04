// 사람 고르기 규칙 테스트 — 이름·연락처 찾기와 공지 개인 받는 사람 후보(QA 2026-11-02 ANOTICE-03)
import { describe, expect, it } from 'vitest'
import { badMemberProblems, filterPeople, memberProblemLabel, noticePeople, roomCandidates } from '../app/utils/personPick'

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

// QA 2026-11-02 CHAT-01 · CHAT-03 — 방 멤버는 앱 계정(프로필 id)에만 붙는다
describe('roomCandidates', () => {
  const rows = [
    { id: 'd1', name: '김구구', phone: '010', role: 'senior' },
    { id: 'd2', name: '오금례', phone: null, role: 'senior' },
    { id: 'd3', name: '김미영', phone: null, role: 'manager' },
  ]
  const profiles = [
    { id: 'p1', directory_id: 'd1' },
    { id: 'p3', directory_id: 'd3' },
  ]

  it('명부 행과 앱 계정을 이어 프로필 id 로 고른다. 계정이 없으면 「앱 미연결」 회색', () => {
    expect(roomCandidates(rows, profiles)).toEqual([
      { id: 'p1', name: '김구구', phone: '010', role: 'senior', note: null },
      { id: 'd2', name: '오금례', phone: null, role: 'senior', note: '앱 미연결', disabled: true },
      { id: 'p3', name: '김미영', phone: null, role: 'manager', note: null },
    ])
  })

  it('이미 방에 있는 분은 「참여 중」 회색', () => {
    const out = roomCandidates(rows, profiles, { members: new Set(['p3']) })
    expect(out[2]).toMatchObject({ id: 'p3', note: '참여 중', disabled: true })
  })

  it('서버가 거절한 분은 비고에 빨갛게, 고를 수는 있다(골라 둔 채 보이게)', () => {
    const out = roomCandidates(rows, profiles, { problems: new Map([['p1', '계약 종료']]) })
    expect(out[0]).toEqual({ id: 'p1', name: '김구구', phone: '010', role: 'senior', note: '계약 종료', alert: true })
  })

  it('한 명부에 계정이 둘이면 먼저 온 것 하나만 잇는다', () => {
    const out = roomCandidates([rows[0]!], [...profiles, { id: 'p9', directory_id: 'd1' }])
    expect(out.map((p) => p.id)).toEqual(['p1'])
  })
})

describe('memberProblemLabel', () => {
  it('missing 은 앱 미연결, inactive 는 계약 종료', () => {
    expect(memberProblemLabel('missing')).toBe('앱 미연결')
    expect(memberProblemLabel('inactive')).toBe('계약 종료')
    expect(memberProblemLabel('other')).toBe('other')
  })
})

describe('badMemberProblems', () => {
  it('bad_member 의 invalid 를 프로필 id(소문자) → 문구로', () => {
    const e = {
      status: 400,
      data: { error: 'bad_member', invalid: [{ profileId: 'AB-1', reason: 'missing' }, { profileId: 'cd-2', reason: 'inactive' }] },
    }
    expect([...badMemberProblems(e)!]).toEqual([
      ['ab-1', '앱 미연결'],
      ['cd-2', '계약 종료'],
    ])
  })
  it('다른 오류는 null', () => {
    expect(badMemberProblems({ status: 400, data: { error: 'bad_request' } })).toBeNull()
    expect(badMemberProblems({ status: 404, data: { error: 'not_found' } })).toBeNull()
    expect(badMemberProblems(new Error('x'))).toBeNull()
  })
})
