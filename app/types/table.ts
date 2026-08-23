// DataTable 컬럼 정의 타입 (컴포넌트 간 공용 — .vue에서 타입 import 시 자동 임포트가 깨지는 문제 회피)
export interface Column {
  key: string
  label: string
  sortable?: boolean
  align?: 'left' | 'right'
  strong?: boolean // 이름 등 강조 컬럼 (ink + semibold)
}
