// 기관 정보 요약 — 기관 테이블엔 이름뿐이라 담당자들이 가입 때 입력한 주소·전화 등에서 대표 값을 고른다

const ORG_INFO_FIELDS = [
  { key: 'address', label: '주소' },
  { key: 'org_phone', label: '기관 전화' },
  { key: 'biz_num', label: '사업자번호' },
  { key: 'rep_name', label: '대표자명' },
] as const

export interface OrgInfoEntry {
  key: string
  label: string
  text: string
  /** 담당자마다 입력한 값이 다르다 — 화면에 「담당자마다 다름」을 붙인다 */
  differs: boolean
}

/**
 * 칸마다 가장 최근에 수정된 담당자의 값을 쓴다(비워 둔 담당자는 건너뛴다).
 * 담당자가 여럿이면 사람마다 다르게 입력했을 수 있어, 서로 다른 값이 둘 이상이면 differs 로 알린다.
 */
export function summarizeOrgInfo(managers: Record<string, unknown>[]): OrgInfoEntry[] {
  if (!managers.length) return []
  const recent = [...managers].sort((a, b) => String(b.updated_at ?? '').localeCompare(String(a.updated_at ?? '')))
  return ORG_INFO_FIELDS.map(({ key, label }) => {
    const values = recent.map((m) => String(m[key] ?? '').trim()).filter(Boolean)
    return { key, label, text: values[0] ?? '—', differs: new Set(values).size > 1 }
  })
}
