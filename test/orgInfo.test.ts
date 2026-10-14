// 기관 정보 요약 — 담당자들이 입력한 주소·전화 등에서 최근 값과 불일치 여부를 고른다
import { describe, expect, it } from 'vitest'
import { summarizeOrgInfo } from '../app/utils/orgInfo'

const m = (o: Record<string, unknown>) => ({
  address: null,
  org_phone: null,
  biz_num: null,
  rep_name: null,
  updated_at: '2026-10-01T00:00:00Z',
  ...o,
})

describe('summarizeOrgInfo', () => {
  it('가장 최근에 수정된 담당자의 값을 쓴다', () => {
    const out = summarizeOrgInfo([
      m({ address: '서울 옛 주소', updated_at: '2026-09-01T00:00:00Z' }),
      m({ address: '서울 새 주소', updated_at: '2026-10-02T00:00:00Z' }),
    ])
    expect(out[0]).toEqual({ key: 'address', label: '주소', text: '서울 새 주소', differs: true })
  })

  it('값이 모두 같으면 differs 는 false — 앞뒤 공백 차이는 같은 값', () => {
    const out = summarizeOrgInfo([m({ biz_num: '123-45-67890' }), m({ biz_num: ' 123-45-67890 ' })])
    expect(out.find((e) => e.key === 'biz_num')).toMatchObject({ text: '123-45-67890', differs: false })
  })

  it('최근 담당자가 비워 둔 칸은 값이 있는 다음 담당자의 값을 쓴다', () => {
    const out = summarizeOrgInfo([
      m({ org_phone: '02-111-2222', updated_at: '2026-09-01T00:00:00Z' }),
      m({ org_phone: '', updated_at: '2026-10-02T00:00:00Z' }),
    ])
    expect(out.find((e) => e.key === 'org_phone')).toMatchObject({ text: '02-111-2222', differs: false })
  })

  it('네 칸을 정해진 순서로, 아무도 입력하지 않았으면 —', () => {
    expect(summarizeOrgInfo([m({})]).map((e) => [e.label, e.text])).toEqual([
      ['주소', '—'],
      ['기관 전화', '—'],
      ['사업자번호', '—'],
      ['대표자명', '—'],
    ])
  })

  it('담당자가 없으면 빈 목록', () => expect(summarizeOrgInfo([])).toEqual([]))
})
