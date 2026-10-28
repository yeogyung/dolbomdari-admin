// 이력서 A4 장 나누기 — 줄 목록, 줄 단위로 넘기기, 붙여 옮길 줄, 이어지는 섹션의 빈 라벨 칸
import { describe, expect, it } from 'vitest'
import { docRows, paginate, type DocRow, type PageRow } from '../app/utils/resumePages'
import type { Resume } from '../shared/resume-form'

function makeResume(careerCount = 1): Resume {
  return {
    id: 'r1',
    user_id: 'u1',
    status: 'completed',
    name: '홍길동',
    birth_date: '1960-07-05',
    phone: '01012345678',
    base_address: '서울시 강남구',
    detail_address: '101동 202호',
    careers: Array.from({ length: careerCount }, (_, i) => ({
      company: `가나요양원 ${i + 1}호점`,
      start_ym: '2020-01',
      end_ym: null,
      duty: '방문요양',
    })),
    qualifications: [{ name: '요양보호사', acquired_ym: '2019-11', issuer: '보건복지부' }],
    trainings: [],
    educations: [],
    signature: { name: '홍길동', signed_at: '2026-09-01T00:00:00Z' },
    updated_at: '2026-09-01T00:00:00Z',
  }
}

/** 줄 종류를 짧은 문자열로 — 장 구성을 한눈에 비교하려고 */
function shape(row: DocRow): string {
  if (row.kind === 'head') return `head${row.part}`
  if (row.kind === 'sign') return 'sign'
  return `${row.section.key}:${row.kind}`
}

const sideOf = (page: PageRow[]) => page.filter((r) => r.side).map((r) => [shape(r), r.side!.label, r.side!.span])

describe('docRows', () => {
  it('머리 4줄, 섹션마다 머리글 1줄과 기본 행 수까지 채운 항목 줄, 끝에 서명', () => {
    const rows = docRows(makeResume())
    expect(rows.map(shape)).toEqual([
      'head0', 'head1', 'head2', 'head3',
      'careers:columns', ...Array(5).fill('careers:item'),
      'qualifications:columns', ...Array(3).fill('qualifications:item'),
      'trainings:columns', 'trainings:item',
      'educations:columns', 'educations:item',
      'sign',
    ])
    const first = rows[5]!
    expect(first.kind === 'item' && first.cells).toEqual(['2020.01 ~ 재직중', '가나요양원 1호점', '방문요양'])
  })

  it('항목이 기본 행 수보다 많으면 그만큼 늘어난다', () => {
    expect(docRows(makeResume(8)).filter((r) => shape(r) === 'careers:item')).toHaveLength(8)
  })
})

describe('paginate', () => {
  it('다 들어가면 한 장 — 섹션 첫 줄에 라벨 칸, 걸치는 줄 수는 섹션 전체', () => {
    const rows = docRows(makeResume())
    const pages = paginate(rows, rows.map(() => 30), 10_000)
    expect(pages).toHaveLength(1)
    expect(sideOf(pages[0]!)).toEqual([
      ['careers:columns', '경력 사항', 6],
      ['qualifications:columns', '자격 사항', 4],
      ['trainings:columns', '훈련 사항', 2],
      ['educations:columns', '최종 학력', 2],
    ])
  })

  it('넘치면 줄 단위로 다음 장에 — 빠지거나 겹치는 줄이 없고 장마다 높이를 넘지 않는다', () => {
    const rows = docRows(makeResume(40))
    const heights = rows.map(() => 30)
    const pages = paginate(rows, heights, 600)
    expect(pages.length).toBeGreaterThan(1)
    expect(pages.flat().map(shape)).toEqual(rows.map(shape))
    for (const page of pages) expect(page.length * 30).toBeLessThanOrEqual(600)
  })

  it('다음 장에서 이어지는 섹션은 머리글 없이 시작하고 라벨 칸은 비운다', () => {
    const rows = docRows(makeResume(40))
    const pages = paginate(rows, rows.map(() => 30), 600)
    // 첫 장 20줄 = 머리 4 + 경력 머리글 1 + 경력 15
    expect(sideOf(pages[0]!)).toEqual([['careers:columns', '경력 사항', 16]])
    expect(shape(pages[1]![0]!)).toBe('careers:item')
    expect(sideOf(pages[1]!)[0]).toEqual(['careers:item', '', 20])
  })

  it('섹션 머리글 줄은 홀로 장 끝에 남지 않고 첫 항목과 함께 넘어간다', () => {
    const rows = docRows(makeResume())
    // 머리 4줄 + 경력 머리글 1줄까지만 들어가는 높이
    const pages = paginate(rows, rows.map(() => 30), 150)
    expect(pages[0]!.map(shape)).toEqual(['head0', 'head1', 'head2', 'head3'])
    expect(pages[1]!.slice(0, 2).map(shape)).toEqual(['careers:columns', 'careers:item'])
  })

  it('머리 네 줄(사진 칸이 걸침)은 쪼개지 않는다', () => {
    const rows = docRows(makeResume())
    const pages = paginate(rows, rows.map(() => 30), 100)
    expect(pages[0]!.map(shape)).toEqual(['head0', 'head1', 'head2', 'head3'])
  })

  it('서명 줄이 안 들어가면 통째로 다음 장', () => {
    const rows = docRows(makeResume())
    const heights = rows.map((r) => (r.kind === 'sign' ? 120 : 30))
    const total = heights.reduce((a, b) => a + b, 0)
    const pages = paginate(rows, heights, total - 1)
    expect(pages).toHaveLength(2)
    expect(pages[1]!.map(shape)).toEqual(['sign'])
  })

  it('높이를 모르면(0) 한 장', () => {
    const rows = docRows(makeResume(40))
    expect(paginate(rows, rows.map(() => 0))).toHaveLength(1)
  })
})
