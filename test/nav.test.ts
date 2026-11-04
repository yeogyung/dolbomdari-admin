// 롤별 사이드바 메뉴 — 담당자는 출퇴근 기록·휴무 관리만 본다
import { describe, expect, it } from 'vitest'
import { getApps, managerAllows, phoneAllows, phoneHome, worksiteAllows } from '../shared/nav'

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

// QA 2026-11-02 MOBILE-02 · 결정 F7 — 휴대폰 폭에서는 출퇴근 기록만, 나머지는 「PC에서만 이용」
describe('phoneAllows', () => {
  it('휴대폰 폭에서는 출퇴근 기록만 연다', () => {
    expect(phoneAllows('/senior/attendance')).toBe(true)
    expect(phoneAllows('/senior/attendance/')).toBe(true)
    for (const p of ['/', '/senior', '/senior/workers', '/senior/holidays', '/senior/worksites', '/users', '/senior/attendance-x']) {
      expect(phoneAllows(p)).toBe(false)
    }
  })

  it('롤 규칙을 넓히지 않는다 — 휴대폰에서 여는 화면은 그 롤에게도 열린 화면이다', () => {
    expect(managerAllows('/senior/attendance')).toBe(true)
    expect(worksiteAllows('/senior/attendance')).toBe(true)
  })
})

describe('phoneHome', () => {
  it('안내 화면의 바로가기는 그 롤 메뉴의 출퇴근 기록', () => {
    for (const role of ['master', 'manager', 'worksite'] as const) expect(phoneHome(role)).toBe('/senior/attendance')
  })

  it('출퇴근 기록 메뉴가 없는 기관 관리자는 바로가기가 없다', () => {
    expect(phoneHome('org')).toBeNull()
  })
})
