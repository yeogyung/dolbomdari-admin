// 상세 화면 표시 모델 — 종사자 회귀·기본 테이블·참조 이름·숨김·넓은 칸
import { describe, expect, it } from 'vitest'
import { buildDetailView } from '../app/utils/recordDetail'
import type { TableDef } from '../shared/tables'

const tables: Record<string, TableDef> = {
  organization: { name: 'organization', label: '기관', mode: 'crud', pk: ['id'], canCreate: true, fields: [] },
}

const worker: TableDef = {
  name: 'users',
  label: '종사자',
  mode: 'crud',
  pk: ['id'],
  canCreate: false,
  detail: {
    titleField: 'name',
    hidden: ['id', 'name', 'photo_uri'],
    groups: [{ title: '회원 정보', fields: ['phone', 'created_at'] }],
    restTitle: '인적사항',
  },
  fields: [
    { name: 'id', label: 'ID', type: 'text' },
    { name: 'phone', label: '전화번호', type: 'text' },
    { name: 'name', label: '이름', type: 'text' },
    { name: 'gender', label: '성별', type: 'text' },
    { name: 'photo_uri', label: '사진 URL', type: 'text' },
    { name: 'regions', label: '희망 지역', type: 'array' },
    { name: 'created_at', label: '생성일시', type: 'datetime' },
  ],
}

describe('buildDetailView — detail 설정이 있는 테이블', () => {
  const view = buildDetailView(
    worker,
    {
      id: 'u1',
      phone: '01012345678',
      name: '김하나',
      gender: '여성',
      photo_uri: 'https://x',
      regions: ['서울', '부산'],
      created_at: '2026-10-14T00:05:00Z',
    },
    tables,
  )

  it('제목은 titleField 값', () => expect(view.title).toBe('김하나'))

  it('groups 카드 다음에 나머지 카드 — 숨김 필드는 빠지고 필드 순서를 따른다', () => {
    expect(view.cards.map((c) => [c.title, c.entries.map((e) => e.key)])).toEqual([
      ['회원 정보', ['phone', 'created_at']],
      ['인적사항', ['gender', 'regions']],
    ])
  })

  it('시각은 yyyy.mm.dd hh:mm(서울), 배열은 쉼표, 건수 표기는 없다', () => {
    expect(view.cards[0]!.entries[1]).toMatchObject({ label: '생성일시', text: '2026.10.14 09:05' })
    expect(view.cards[1]!.entries[1]!.text).toBe('서울, 부산')
    expect(view.cards.every((c) => c.count === undefined)).toBe(true)
  })

  it('제목 값이 비면 「이름 없음」', () => {
    expect(buildDetailView(worker, { id: 'u1', name: '' }, tables).title).toBe('이름 없음')
  })
})

describe('buildDetailView — detail 이 없는 테이블은 예전 그대로', () => {
  const jobs: TableDef = {
    name: 'jobs',
    label: '공고',
    mode: 'crud',
    pk: ['id'],
    canCreate: true,
    fields: [
      { name: 'id', label: 'ID', type: 'text' },
      { name: 'title', label: '제목', type: 'text' },
      { name: 'created_at', label: '생성일시', type: 'datetime' },
    ],
  }
  const view = buildDetailView(jobs, { id: 'j1', title: '요양보호사', created_at: '2026-10-14T00:05:00Z', extra: true }, tables)

  it('머리 없음, 카드 한 장 「공고 정보」에 전체 컬럼과 건수', () => {
    expect(view.title).toBeNull()
    expect(view.cards).toHaveLength(1)
    expect(view.cards[0]!.title).toBe('공고 정보')
    expect(view.cards[0]!.count).toBe(4)
    expect(view.cards[0]!.entries.map((e) => e.key)).toEqual(['id', 'title', 'created_at', 'extra'])
  })

  it('시각은 원문, 불리언은 ✓', () => {
    expect(view.cards[0]!.entries[2]!.text).toBe('2026-10-14T00:05:00Z')
    expect(view.cards[0]!.entries[3]!.text).toBe('✓')
  })
})

describe('buildDetailView — 참조(__ref)', () => {
  const manager: TableDef = {
    name: 'organization_manager',
    label: '기관 담당자',
    mode: 'crud',
    pk: ['id'],
    canCreate: false,
    refs: [{ column: 'organization_id', table: 'organization', field: 'name', label: '소속 기관' }],
    detail: { titleField: 'manager_name', hidden: ['id', 'manager_name'] },
    fields: [
      { name: 'id', label: 'ID', type: 'text' },
      // 필드 라벨은 수정 폼·엑셀의 id 칸용이고, 상세는 이름을 보이므로 ref 라벨을 쓴다
      { name: 'organization_id', label: '소속 기관 ID', type: 'text' },
      { name: 'manager_name', label: '담당자명', type: 'text' },
    ],
  }

  it('이름을 보이고 참조 상세로 링크, __ref 키는 행으로 새지 않는다', () => {
    const view = buildDetailView(
      manager,
      { id: 'm1', manager_name: '박둘', organization_id: 'o 1', organization_id__ref: '늘봄센터' },
      tables,
    )
    expect(view.cards).toHaveLength(1)
    expect(view.cards[0]!.title).toBe('기관 담당자 정보')
    expect(view.cards[0]!.entries).toEqual([
      { key: 'organization_id', label: '소속 기관', text: '늘봄센터', wide: false, to: '/organization/o%201' },
    ])
  })

  it('참조 이름이 없으면 원래 값, 값이 비면 링크 없음', () => {
    const a = buildDetailView(manager, { id: 'm1', manager_name: '박둘', organization_id: 'o1' }, tables)
    expect(a.cards[0]!.entries[0]).toMatchObject({ text: 'o1', to: '/organization/o1' })
    const b = buildDetailView(manager, { id: 'm1', manager_name: '박둘', organization_id: null }, tables)
    expect(b.cards[0]!.entries[0]!.text).toBe('—')
    expect(b.cards[0]!.entries[0]!.to).toBeUndefined()
  })
})

describe('buildDetailView — 넓은 칸', () => {
  const def: TableDef = {
    name: 't',
    label: 'T',
    mode: 'crud',
    pk: ['id'],
    canCreate: true,
    fields: [{ name: 'bio', label: '소개', type: 'textarea' }],
  }
  it('60자 초과나 줄바꿈이면 두 칸을 합친다', () => {
    expect(buildDetailView(def, { bio: 'a'.repeat(61) }, tables).cards[0]!.entries[0]!.wide).toBe(true)
    expect(buildDetailView(def, { bio: 'a\nb' }, tables).cards[0]!.entries[0]!.wide).toBe(true)
    expect(buildDetailView(def, { bio: 'a'.repeat(60) }, tables).cards[0]!.entries[0]!.wide).toBe(false)
  })
})

describe('buildDetailView — 칸별 문구 함수', () => {
  const def: TableDef = {
    name: 't',
    label: 'T',
    mode: 'log',
    pk: ['id'],
    canCreate: false,
    fields: [
      { name: 'items', label: '항목', type: 'textarea' },
      { name: 'raw', label: '원문', type: 'textarea' },
    ],
  }
  const fieldText = { items: (v: unknown) => (v as string[]).join('\n') }

  it('문구 함수가 있는 칸은 그 결과를 쓰고, 없는 칸은 예전 그대로', () => {
    const view = buildDetailView(def, { items: ['a', 'b'], raw: { k: 1 } }, tables, fieldText)
    expect(view.cards[0]!.entries[0]).toMatchObject({ text: 'a\nb', wide: true })
    expect(view.cards[0]!.entries[1]!.text).toBe(JSON.stringify({ k: 1 }, null, 2))
  })

  it('문구 함수가 빈 문자열을 내면 「—」', () => {
    expect(buildDetailView(def, { items: [] }, tables, fieldText).cards[0]!.entries[0]!.text).toBe('—')
  })
})
