// 구인구직 상세 화면의 표시 모델 — 레지스트리 detail 설정으로 머리·카드 묶음·값 문구·참조 링크를 만든다
import type { TableDef } from '../../shared/tables'
import { fmtDateTime } from './datetime'

export interface DetailEntry {
  key: string
  label: string
  text: string
  /** 2열 배치에서 두 칸을 합칠지 — 반 칸에 넣으면 줄바꿈이 심해 읽기 어렵다 */
  wide: boolean
  /** 참조(refs) 필드면 참조 테이블 상세 경로 */
  to?: string
}

export interface DetailCard {
  title: string
  /** detail 설정이 없는 테이블만 「N개 항목」을 보인다(예전 화면 그대로) */
  count?: number
  entries: DetailEntry[]
}

export interface DetailView {
  /** detail 설정이 없으면 null — 머리를 그리지 않는다 */
  title: string | null
  cards: DetailCard[]
}

const REF_SUFFIX = '__ref'

function textOf(value: unknown): string {
  if (value === null || value === undefined || value === '') return '—'
  if (Array.isArray(value)) return value.join(', ')
  if (typeof value === 'boolean') return value ? '✓' : '✗'
  if (typeof value === 'object') return JSON.stringify(value, null, 2)
  return String(value)
}

export function buildDetailView(
  def: TableDef,
  record: Record<string, unknown>,
  tables: Record<string, TableDef>,
): DetailView {
  const detail = def.detail
  const hidden = new Set(detail?.hidden ?? [])
  const fieldOrder = def.fields.map((f) => f.name)

  // 표시 순서: 레지스트리 필드 순서 우선, 그 뒤에 조회 결과의 나머지 키. `*__ref` 는 해당 필드 칸에 합친다
  const keys = [
    ...fieldOrder.filter((k) => k in record),
    ...Object.keys(record).filter((k) => !fieldOrder.includes(k)),
  ].filter((k) => !k.endsWith(REF_SUFFIX) && !hidden.has(k))

  const entryOf = (key: string): DetailEntry => {
    const field = def.fields.find((f) => f.name === key)
    const raw = record[key]
    const ref = def.refs?.find((r) => r.column === key)
    let text: string
    let to: string | undefined
    if (ref) {
      const name = record[`${key}${REF_SUFFIX}`]
      text = textOf(name ?? raw)
      const target = tables[ref.table]
      if (raw && target && target.pk.length === 1) to = `/${ref.table}/${encodeURIComponent(String(raw))}`
    } else if (detail && field?.type === 'datetime') {
      // 시각 표기는 detail 설정이 있는 화면만 바꾼다 — 나머지 테이블은 예전 원문 그대로
      text = fmtDateTime(raw as string | null)
    } else {
      text = textOf(raw)
    }
    // 참조 칸은 id 가 아니라 이름을 보이므로 ref 라벨(예: 「소속 기관」)을 쓴다 — 필드 라벨은 수정 폼·엑셀의 id 칸용
    const label = ref?.label || field?.label || key
    const entry: DetailEntry = { key, label, text, wide: text.includes('\n') || text.length > 60 }
    if (to) entry.to = to
    return entry
  }

  const entries = keys.map(entryOf)
  if (!detail) {
    return { title: null, cards: [{ title: `${def.label} 정보`, count: entries.length, entries }] }
  }

  const grouped = new Set((detail.groups ?? []).flatMap((g) => g.fields))
  const cards: DetailCard[] = (detail.groups ?? []).map((g) => ({
    title: g.title,
    entries: entries.filter((e) => g.fields.includes(e.key)),
  }))
  const rest = entries.filter((e) => !grouped.has(e.key))
  if (rest.length) cards.push({ title: detail.restTitle ?? `${def.label} 정보`, entries: rest })

  const title = record[detail.titleField]
  return { title: title ? String(title) : '이름 없음', cards }
}
