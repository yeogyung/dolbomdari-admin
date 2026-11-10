// 롤별 사이드바 메뉴와 라우트 가드 판정 — 담당자는 대시보드·근무표·출퇴근·조정 요청·휴무·리포트·공지·채팅·FAQ·AI 문서만 본다
import { describe, expect, it } from 'vitest'
import { getApps, managerAllows, phoneAllows, phoneHome, roleAllows, worksiteAllows } from '../shared/nav'

const paths = (role: Parameters<typeof getApps>[0]) =>
  getApps(role).flatMap((a) => a.sections.flatMap((s) => s.items.map((i) => i.to)))

describe('getApps', () => {
  // QA 2026-11-07 MGR-03 · MGR-04, 결정 D4 — 대시보드·리포트를 맡은 근무지로 좁혀 연다
  // QA 2026-11-07 MGR-01·02·05 · SHIFT-08 — 근무표·공지·채팅·FAQ·AI 문서를 담당자에게도 연다(앱과 같은 API·권한)
  it('담당자는 시니어 앱의 대시보드·근무표·출퇴근·조정 요청·휴무·리포트·공지·채팅·FAQ·AI 문서만 본다', () => {
    const apps = getApps('manager')
    expect(apps.map((a) => a.key)).toEqual(['senior'])
    expect(apps[0]!.home).toBe('/senior/attendance')
    expect(paths('manager')).toEqual([
      '/senior',
      '/senior/roster',
      '/senior/attendance',
      '/senior/attendance-requests',
      '/senior/holidays',
      '/senior/reports',
      '/senior/notices',
      '/senior/chat',
      '/senior/faqs',
      '/senior/documents',
    ])
  })

  // QA 2026-11-02 PARTNER-02 — 조정 요청은 확정하는 담당자·master 메뉴에만. 수요처는 출퇴근 기록의 「내 요청」 탭으로 본다
  it('조정 요청 메뉴는 master·담당자에게만 있다', () => {
    expect(paths('master')).toContain('/senior/attendance-requests')
    expect(paths('worksite')).not.toContain('/senior/attendance-requests')
    expect(paths('org')).not.toContain('/senior/attendance-requests')
  })

  it('휴무 관리는 master 운영 메뉴에도 있다', () => {
    expect(paths('master')).toContain('/senior/holidays')
    expect(paths('worksite')).not.toContain('/senior/holidays')
  })

  // QA 2026-11-02 PARTNER-04 — 첫 화면이 근무지 목록이었다. 담당 근무지의 오늘 출결로 연다.
  it('수요처 계정은 근무지·근무표(읽기)·출퇴근 기록을 보고 첫 화면은 출퇴근 기록이다', () => {
    expect(getApps('worksite')[0]!.home).toBe('/senior/attendance')
    expect(paths('worksite')).toEqual(['/senior/worksites', '/senior/roster', '/senior/attendance'])
  })

  it('대시보드·리포트는 master·담당자 메뉴에만 있다', () => {
    for (const role of ['master', 'manager'] as const) {
      expect(paths(role)).toContain('/senior')
      expect(paths(role)).toContain('/senior/reports')
    }
    for (const role of ['worksite', 'org'] as const) {
      expect(paths(role)).not.toContain('/senior')
      expect(paths(role)).not.toContain('/senior/reports')
    }
  })
})

describe('managerAllows', () => {
  it('담당자가 들어갈 수 있는 화면만 연다', () => {
    expect(managerAllows('/senior/attendance')).toBe(true)
    expect(managerAllows('/senior/holidays')).toBe(true)
    expect(managerAllows('/senior/holidays/')).toBe(true)
    expect(managerAllows('/senior/attendance-requests')).toBe(true)
    expect(managerAllows('/senior/workers')).toBe(false)
    // 접두만 같은 다른 경로는 막는다
    expect(managerAllows('/senior/holidays-admin')).toBe(false)
    expect(managerAllows('/')).toBe(false)
  })

  // 결정 D4 — `/senior` 는 시니어 앱 모든 주소의 앞부분이다. 앞부분 일치로 열면 명부·계정·공지까지 열린다
  it('대시보드·리포트는 그 주소만 열고 아래 주소는 열지 않는다', () => {
    for (const p of ['/senior', '/senior/', '/senior/reports', '/senior/reports/']) {
      expect(managerAllows(p)).toBe(true)
    }
    for (const p of [
      '/senior/workers',
      '/senior/workers/abc',
      '/senior/worksites',
      '/senior/accounts',
      '/senior/programs',
      '/senior/reports/x',
      '/senior/reports-x',
      '/senior-x',
      '/users',
    ]) {
      expect(managerAllows(p)).toBe(false)
    }
  })
})

describe('managerAllows — 담당자 PC(MGR-01·02·05 · SHIFT-08)', () => {
  it('공지·FAQ 는 아래 주소까지, 근무표·채팅·문서 목록·올리기는 그 주소만 연다', () => {
    for (const p of [
      '/senior/notices',
      '/senior/notices/new',
      '/senior/notices/abc',
      '/senior/faqs',
      '/senior/faqs/abc',
      '/senior/roster',
      '/senior/chat',
      '/senior/documents',
      '/senior/documents/new',
    ]) {
      expect(managerAllows(p)).toBe(true)
    }
  })

  it('문자 실패 모아 보기·문서 상세·그 밖의 아래 주소는 막는다', () => {
    for (const p of ['/senior/notices/sms', '/senior/documents/abc', '/senior/roster/x', '/senior/chat/x', '/senior/roster-x']) {
      expect(managerAllows(p)).toBe(false)
    }
  })
})

/*
 * 라우트 가드(`middleware/auth.global.ts`)는 이 판정 하나만 본다. 가드 안에 롤마다 조건을 따로 적으면
 * 한 곳을 열 때 다른 조건이 그대로 막거나(대시보드 master 전용 검사) 거꾸로 넓어진다
 */
describe('roleAllows', () => {
  it('master 는 어디든 들어간다', () => {
    for (const p of ['/', '/senior', '/senior/reports', '/senior/workers', '/users']) expect(roleAllows('master', p)).toBe(true)
  })

  it('담당자는 담당자에게 연 화면만 들어간다', () => {
    for (const p of ['/senior', '/senior/reports', '/senior/attendance', '/senior/holidays', '/senior/attendance-requests']) {
      expect(roleAllows('manager', p)).toBe(true)
    }
    for (const p of ['/', '/users', '/senior/workers', '/senior/worksites', '/senior/accounts', '/senior/notices/sms', '/senior/reports/x']) {
      expect(roleAllows('manager', p)).toBe(false)
    }
  })

  it('수요처는 근무지·출퇴근 기록만 — 대시보드·리포트는 막는다', () => {
    for (const p of ['/senior/attendance', '/senior/worksites', '/senior/worksites/abc']) expect(roleAllows('worksite', p)).toBe(true)
    for (const p of ['/', '/senior', '/senior/reports', '/senior/workers', '/senior/attendance-requests']) {
      expect(roleAllows('worksite', p)).toBe(false)
    }
  })

  it('기관 관리자는 전체 집계 화면(대시보드·리포트)만 막는다 — 예전 가드 그대로', () => {
    for (const p of ['/', '/senior', '/senior/reports', '/senior/reports/x']) expect(roleAllows('org', p)).toBe(false)
    for (const p of ['/users', '/organization']) expect(roleAllows('org', p)).toBe(true)
  })

  it('메뉴에 있는 화면은 그 롤이 모두 들어갈 수 있다', () => {
    for (const role of ['master', 'manager', 'worksite', 'org'] as const) {
      for (const p of paths(role)) expect(roleAllows(role, p)).toBe(true)
    }
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
    for (const p of paths('manager')) expect(managerAllows(p)).toBe(true)
  })

  // 확정·반려는 담당자·master 몫이다. 주소를 쳐도 조정 요청 메뉴 화면에는 들어가지 못한다
  it('수요처는 조정 요청 메뉴 화면에 들어가지 못한다', () => {
    expect(worksiteAllows('/senior/attendance-requests')).toBe(false)
  })
})

// QA 2026-11-02 MOBILE-02 · 결정 F7 — 휴대폰 폭에서는 출퇴근 기록만, 나머지는 「PC에서만 이용」
describe('phoneAllows', () => {
  it('휴대폰 폭에서는 출퇴근 기록만 연다', () => {
    expect(phoneAllows('/senior/attendance')).toBe(true)
    expect(phoneAllows('/senior/attendance/')).toBe(true)
    for (const p of ['/', '/senior', '/senior/workers', '/senior/holidays', '/senior/worksites', '/users', '/senior/attendance-x', '/senior/attendance-requests']) {
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
