// 롤별 사이드바 메뉴 — 담당자는 출퇴근 기록·휴무 관리만 본다
import { describe, expect, it } from 'vitest'
import { getApps, managerAllows } from '../shared/nav'

const paths = (role: Parameters<typeof getApps>[0]) =>
  getApps(role).flatMap((a) => a.sections.flatMap((s) => s.items.map((i) => i.to)))

describe('getApps', () => {
  it('담당자는 시니어 앱의 출퇴근 기록과 휴무 관리만 본다', () => {
    const apps = getApps('manager')
    expect(apps.map((a) => a.key)).toEqual(['senior'])
    expect(apps[0]!.home).toBe('/senior/attendance')
    expect(paths('manager')).toEqual(['/senior/attendance', '/senior/holidays'])
  })

  it('휴무 관리는 master 운영 메뉴에도 있다', () => {
    expect(paths('master')).toContain('/senior/holidays')
    expect(paths('worksite')).not.toContain('/senior/holidays')
  })

  it('수요처 계정은 근무지·출퇴근 기록을 그대로 본다', () => {
    expect(getApps('worksite')[0]!.home).toBe('/senior/worksites')
    expect(paths('worksite')).toEqual(['/senior/worksites', '/senior/attendance'])
  })

  it('리포트는 master 메뉴에만 있다', () => {
    expect(paths('master')).toContain('/senior/reports')
    for (const role of ['manager', 'worksite', 'org'] as const) {
      expect(paths(role)).not.toContain('/senior/reports')
    }
  })
})

describe('managerAllows', () => {
  it('담당자가 들어갈 수 있는 화면만 연다', () => {
    expect(managerAllows('/senior/attendance')).toBe(true)
    expect(managerAllows('/senior/holidays')).toBe(true)
    expect(managerAllows('/senior/holidays/')).toBe(true)
    expect(managerAllows('/senior/workers')).toBe(false)
    // 접두만 같은 다른 경로는 막는다
    expect(managerAllows('/senior/holidays-admin')).toBe(false)
    expect(managerAllows('/')).toBe(false)
  })
})
