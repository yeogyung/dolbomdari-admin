// 담당자 명부(읽기 전용) — 근무지 칸은 지금 유효한 배정만, 이름순, 검색·근무지·상태 거르기를 고정한다
import { describe, expect, it } from 'vitest'
import type { Assignment, Worksite } from '../app/types/dbo'
import { filterManagerWorkers, isCurrentAssignment, managerWorkerRows, type ManagerPerson } from '../app/utils/managerWorkers'

const TODAY = '2026-11-11'

function assignment(directoryId: string, worksiteId: string, period: Partial<Assignment> = {}): Assignment {
  return {
    id: `${directoryId}-${worksiteId}-${period.period_start ?? ''}-${period.period_end ?? ''}`,
    directory_id: directoryId,
    worksite_id: worksiteId,
    program_id: null,
    weekdays: [1, 2, 3, 4, 5],
    start_time: '09:00',
    end_time: '12:00',
    period_start: null,
    period_end: null,
    manager_profile_id: null,
    created_at: '2026-10-01T00:00:00Z',
    ...period,
  }
}

const site = (id: string, name: string) => ({ id, name }) as Worksite

const people: ManagerPerson[] = [
  { id: 'p-kim', name: '김영희', phone: '01011112222', status: 'active' },
  { id: 'p-lee', name: '이철수', phone: '01033334444', status: 'ended' },
  { id: 'p-ga', name: '가나다', phone: null, status: 'active' },
]
const worksites = [site('w-b', '햇살경로당'), site('w-a', '꽃길경로당')]

describe('isCurrentAssignment', () => {
  it('서버와 같이 시작 전·끝난 배정은 지금 유효하지 않다, 기간이 없으면 늘 유효하다', () => {
    expect(isCurrentAssignment({ period_start: null, period_end: null }, TODAY)).toBe(true)
    expect(isCurrentAssignment({ period_start: TODAY, period_end: TODAY }, TODAY)).toBe(true)
    expect(isCurrentAssignment({ period_start: '2026-11-12', period_end: null }, TODAY)).toBe(false)
    expect(isCurrentAssignment({ period_start: null, period_end: '2026-11-10' }, TODAY)).toBe(false)
  })
})

describe('managerWorkerRows', () => {
  it('이름순이고, 근무지 칸은 지금 유효한 배정의 근무지를 한 번씩 이름순으로', () => {
    const rows = managerWorkerRows(
      people,
      [
        assignment('p-kim', 'w-b'),
        assignment('p-kim', 'w-a'),
        // 같은 근무지의 배정이 둘이어도(요일별 시간) 근무지는 한 번
        assignment('p-kim', 'w-b', { start_time: '13:00', end_time: '15:00' }),
        // 끝난 배정은 칸에 넣지 않는다
        assignment('p-lee', 'w-a', { period_end: '2026-10-31' }),
      ],
      worksites,
      TODAY,
    )
    expect(rows.map((r) => r.name)).toEqual(['가나다', '김영희', '이철수'])
    expect(rows.find((r) => r.id === 'p-kim')!.worksites.map((w) => w.name)).toEqual(['꽃길경로당', '햇살경로당'])
    expect(rows.find((r) => r.id === 'p-lee')!.worksites).toEqual([])
    expect(rows.find((r) => r.id === 'p-ga')!.worksites).toEqual([])
  })

  it('목록에 없는 근무지(맡지 않은 곳)의 배정은 칸에 넣지 않는다', () => {
    const rows = managerWorkerRows(people, [assignment('p-kim', 'w-other')], worksites, TODAY)
    expect(rows.find((r) => r.id === 'p-kim')!.worksites).toEqual([])
  })
})

describe('filterManagerWorkers', () => {
  const rows = managerWorkerRows(
    people,
    [assignment('p-kim', 'w-a'), assignment('p-ga', 'w-b')],
    worksites,
    TODAY,
  )
  const ids = (list: { id: string }[]) => list.map((r) => r.id)

  it('조건이 없으면 모두', () => {
    expect(ids(filterManagerWorkers(rows, { q: '', worksiteId: '', status: '' }))).toEqual(ids(rows))
  })

  it('이름은 띄어쓰기를 무시하고, 전화번호는 숫자만 비교한다', () => {
    expect(ids(filterManagerWorkers(rows, { q: '김 영', worksiteId: '', status: '' }))).toEqual(['p-kim'])
    expect(ids(filterManagerWorkers(rows, { q: '010-3333', worksiteId: '', status: '' }))).toEqual(['p-lee'])
  })

  it('근무지·상태로 거른다', () => {
    expect(ids(filterManagerWorkers(rows, { q: '', worksiteId: 'w-b', status: '' }))).toEqual(['p-ga'])
    expect(ids(filterManagerWorkers(rows, { q: '', worksiteId: '', status: 'ended' }))).toEqual(['p-lee'])
  })
})
