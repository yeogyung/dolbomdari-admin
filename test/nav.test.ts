// 롤별 사이드바 메뉴 — 담당자는 출퇴근 기록 하나만 본다
import { describe, expect, it } from 'vitest'
import { getApps } from '../shared/nav'

const paths = (role: Parameters<typeof getApps>[0]) =>
  getApps(role).flatMap((a) => a.sections.flatMap((s) => s.items.map((i) => i.to)))

describe('getApps', () => {
  it('담당자는 시니어 앱의 출퇴근 기록만 본다', () => {
    const apps = getApps('manager')
    expect(apps.map((a) => a.key)).toEqual(['senior'])
    expect(apps[0]!.home).toBe('/senior/attendance')
    expect(paths('manager')).toEqual(['/senior/attendance'])
  })

  it('수요처 계정은 근무지·출퇴근 기록을 그대로 본다', () => {
    expect(getApps('worksite')[0]!.home).toBe('/senior/worksites')
    expect(paths('worksite')).toEqual(['/senior/worksites', '/senior/attendance'])
  })
})
