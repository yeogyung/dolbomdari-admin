// 명부 목록 근무지·사업 칸 표기 테스트(QA 2026-11-07 ADMIN-02)
import { describe, expect, it } from 'vitest'
import { firstAndMore, rosterProgramNames, rosterSiteCells } from '../app/utils/rosterSites'

const site = (id: string, name: string, program: string | null) => ({
  id,
  name,
  program_id: program ? `p-${program}` : null,
  program_name: program,
})

describe('firstAndMore', () => {
  it('없으면 —, 하나면 그 이름, 여럿이면 첫 하나 외 N', () => {
    expect(firstAndMore([])).toBe('—')
    expect(firstAndMore(['가'])).toBe('가')
    expect(firstAndMore(['가', '나', '다'])).toBe('가 외 2')
  })
})

describe('rosterProgramNames', () => {
  it('같은 사업은 한 번, 사업 없는 근무지는 뺀다', () => {
    expect(
      rosterProgramNames([site('w1', '가', '도시락'), site('w2', '나', null), site('w3', '다', '도시락'), site('w4', '라', '카페')]),
    ).toEqual(['도시락', '카페'])
  })
})

describe('rosterSiteCells', () => {
  it('옛 서버(칸 없음)는 null — 근무지 없음과 가른다', () => {
    expect(rosterSiteCells(undefined)).toBeNull()
  })
  it('근무지가 없으면 두 칸 모두 —', () => {
    expect(rosterSiteCells([])).toEqual({ worksite: '—', program: '—', fullWorksites: '', fullPrograms: '' })
  })
  it('여러 곳이면 첫 하나 외 N, 전체 이름은 쉼표로', () => {
    expect(rosterSiteCells([site('w1', '서대문점', '도시락'), site('w2', '은평점', '도시락'), site('w3', '마포점', '카페')])).toEqual({
      worksite: '서대문점 외 2',
      program: '도시락 외 1',
      fullWorksites: '서대문점, 은평점, 마포점',
      fullPrograms: '도시락, 카페',
    })
  })
})
