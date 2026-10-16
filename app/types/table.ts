// DataTable 컬럼 정의 타입 (컴포넌트 간 공용 — .vue에서 타입 import 시 자동 임포트가 깨지는 문제 회피)
export interface Column {
  key: string
  label: string
  sortable?: boolean
  align?: 'left' | 'right'
  strong?: boolean // 이름 등 강조 컬럼 (ink + semibold)
  /** 셀 문구를 바꿀 때(예: UTC 시각 → 서울 yyyy.mm.dd hh:mm). 없으면 기본 표기 */
  format?: (value: unknown) => string
}
