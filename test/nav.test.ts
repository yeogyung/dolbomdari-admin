// 롤별 사이드바 메뉴 — 담당자는 출퇴근 기록·휴무 관리만 본다
import { describe, expect, it } from 'vitest'
import { getApps, managerAllows, worksiteAllows } from '../shared/nav'

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

  // QA 2026-11-02 PARTNER-04 — 첫 화면이 근무지 목록이었다. 담당 근무지의 오늘 출결로 연다.
  it('수요처 계정은 근무지·출퇴근 기록을 보고 첫 화면은 출퇴근 기록이다', () => {
    expect(getApps('worksite')[0]!.home).toBe('/senior/attendance')
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

// QA 2026-11-02 PARTNER-03 — 메뉴만 숨겨 명부·계정 화면이 주소로 열렸다.
describe('worksiteAllows', () => {
  it('수요처는 근무지·출퇴근 기록만 들어간다', () => {
    expect(worksiteAllows('/senior/attendance')).toBe(true)
    expect(worksiteAllows('/senior/worksites')).toBe(true)
    expect(worksiteAllows('/senior/worksites/abc')).toBe(true)
    for (const p of ['/senior/workers', '/senior/accounts', '/senior', '/', '/users', '/senior/notices', '/senior/worksites-x']) {
      expect(worksiteAllows(p)).toBe(false)
    }
  })

  it('메뉴에 있는 화면은 모두 들어갈 수 있다 — 메뉴와 가드가 어긋나지 않는다', () => {
    for (const p of paths('worksite')) expect(worksiteAllows(p)).toBe(true)
  })
})
