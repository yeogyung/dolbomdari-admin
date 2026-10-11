// 근무지 상세의 근무자 표 — 배정마다 한 줄, 이름은 명부에서, 이름순(QA 2026-10-11)
import { describe, expect, it } from 'vitest'
import { worksiteRoster } from '../app/utils/worksiteRoster'
import type { Assignment, DirectoryEntry } from '../app/types/dbo'

const a = (id: string, directory_id: string, start_time = '09:00:00'): Assignment => ({
  id,
  directory_id,
  worksite_id: 'w1',
  program_id: null,
  weekdays: [1, 3],
  start_time,
  end_time: '12:00:00',
  period_start: null,
  period_end: null,
  manager_profile_id: null,
  created_at: '2026-10-01T00:00:00Z',
})
const p = (id: string, name: string, status: 'active' | 'ended' = 'active'): DirectoryEntry => ({
  id,
  name,
  phone: null,
  email: null,
  role: 'senior',
  worksite_id: null,
  status,
  memo: null,
  created_at: '2026-10-01T00:00:00Z',
})

describe('worksiteRoster', () => {
  it('이름순으로, 같은 사람은 시작 시각순', () => {
    const rows = worksiteRoster(
      [a('1', 'd2'), a('2', 'd1', '13:00:00'), a('3', 'd1', '09:00:00')],
      [p('d1', '김순자'), p('d2', '가나다')],
    )
    expect(rows.map((r) => r.assignment.id)).toEqual(['1', '3', '2'])
    expect(rows[0]!.name).toBe('가나다')
  })

  it('명부에 없으면 이름 대신 알 수 없음 — 줄은 남긴다', () => {
    const rows = worksiteRoster([a('1', 'gone')], [])
    expect(rows[0]).toMatchObject({ name: '(명부에 없음)', status: null })
  })

  it('명부 상태를 함께 싣는다 — 종료된 사람을 가린다', () => {
    expect(worksiteRoster([a('1', 'd1')], [p('d1', '김순자', 'ended')])[0]!.status).toBe('ended')
  })
})
