// 어드민이 관리하는 테이블 메타데이터 레지스트리 — 서버 화이트리스트 + 클라이언트 목록/폼 렌더링 공용
// 스키마 권위 소스: 메인 앱 저장소의 supabase/migrations

export type FieldType =
  | 'text'
  | 'number'
  | 'boolean'
  | 'date'
  | 'datetime'
  | 'array'
  | 'select'
  | 'textarea'

export interface FormField {
  name: string
  label: string
  type: FieldType
  options?: string[] // select 전용
  readonly?: boolean // 수정 폼에서 비활성 (id, created_at 등)
  createOnly?: boolean // 생성 시에만 입력 (예: jobs.id)
}

export interface TableDef {
  name: string
  label: string // 사이드바/제목 한글명
  mode: 'crud' | 'log' // crud: 생성/수정/삭제, log: 목록/삭제만
  pk: string[] // 기본키 컬럼 (복합키 지원)
  canCreate: boolean // false면 신규 생성 불가 (auth FK 등)
  hideInNav?: boolean // 사이드바/대시보드에서 숨김 (종사자 상세로 이동한 테이블)
  listColumns?: string[] // 목록 노출 컬럼. 생략 시 조회 결과의 모든 키 사용
  searchColumns?: string[] // q 검색 대상 (ilike). 생략 시 검색 비활성
  defaultSort?: { column: string; ascending: boolean }
  fields: FormField[]
}

const TS_READONLY: FormField[] = [
  { name: 'created_at', label: '생성일시', type: 'datetime', readonly: true },
  { name: 'updated_at', label: '수정일시', type: 'datetime', readonly: true },
]

export const TABLES: Record<string, TableDef> = {
  users: {
    name: 'users',
    label: '종사자',
    mode: 'crud',
    pk: ['id'],
    canCreate: false, // id가 auth.users FK → 앱 회원가입으로만 생성
    listColumns: ['id', 'name', 'phone', 'gender', 'job_type', 'personal_history', 'updated_at'],
    searchColumns: ['name', 'phone', 'job_type'],
    defaultSort: { column: 'updated_at', ascending: false },
    fields: [
      { name: 'id', label: 'ID', type: 'text', readonly: true },
      { name: 'phone', label: '전화번호', type: 'text' },
      { name: 'name', label: '이름', type: 'text' },
      { name: 'gender', label: '성별', type: 'select', options: ['남성', '여성'] },
      { name: 'job_type', label: '직종', type: 'text' },
      { name: 'qualifications', label: '자격증', type: 'array' },
      {
        name: 'personal_history',
        label: '경력',
        type: 'select',
        options: ['신입', '1년 미만', '1~3년', '3~5년', '5년 이상'],
      },
      { name: 'work_types', label: '희망 근무형태', type: 'array' },
      { name: 'work_days', label: '희망 근무요일', type: 'array' },
      { name: 'regions', label: '희망 지역', type: 'array' },
      { name: 'photo_uri', label: '사진 URL', type: 'text' },
      { name: 'bio', label: '자기소개', type: 'textarea' },
      { name: 'strengths', label: '강점', type: 'array' },
      { name: 'birth_date', label: '생년월일', type: 'date' },
      { name: 'last_active_at', label: '마지막 접속', type: 'datetime', readonly: true },
      ...TS_READONLY,
    ],
  },

  organization_manager: {
    name: 'organization_manager',
    label: '기관 담당자',
    mode: 'crud',
    pk: ['id'],
    canCreate: false, // id가 auth.users FK
    listColumns: ['id', 'manager_name', 'org_name', 'position', 'biz_num', 'phone', 'updated_at'],
    searchColumns: ['manager_name', 'org_name', 'biz_num', 'phone'],
    defaultSort: { column: 'updated_at', ascending: false },
    fields: [
      { name: 'id', label: 'ID', type: 'text', readonly: true },
      { name: 'organization_id', label: '소속 기관 ID', type: 'text' },
      { name: 'position', label: '직책', type: 'text' },
      { name: 'manager_name', label: '담당자명', type: 'text' },
      { name: 'org_name', label: '기관명', type: 'text' },
      { name: 'biz_num', label: '사업자번호', type: 'text' },
      { name: 'rep_name', label: '대표자명', type: 'text' },
      { name: 'phone', label: '담당자 전화', type: 'text' },
      { name: 'org_phone', label: '기관 전화', type: 'text' },
      { name: 'address', label: '주소', type: 'text' },
      { name: 'photo_uri', label: '사진 URL', type: 'text' },
      ...TS_READONLY,
    ],
  },

  organization: {
    name: 'organization',
    label: '기관',
    mode: 'crud',
    pk: ['id'],
    canCreate: true, // id default gen_random_uuid()
    listColumns: ['id', 'name', 'created_at'],
    searchColumns: ['name'],
    defaultSort: { column: 'created_at', ascending: false },
    fields: [
      { name: 'id', label: 'ID', type: 'text', readonly: true },
      { name: 'name', label: '기관명', type: 'text' },
      ...TS_READONLY,
    ],
  },

  jobs: {
    name: 'jobs',
    label: '공고',
    mode: 'crud',
    pk: ['id'],
    canCreate: true, // id는 text PK (기본값 없음) → 생성 시 직접 입력/자동 UUID
    listColumns: ['id', 'title', 'work_type', 'company', 'location', 'salary', 'is_active', 'deadline_date', 'created_at'],
    searchColumns: ['title', 'company', 'org_name', 'location', 'work_type'],
    defaultSort: { column: 'created_at', ascending: false },
    fields: [
      { name: 'id', label: 'ID', type: 'text', readonly: true, createOnly: true },
      { name: 'source', label: '출처', type: 'select', options: ['manual', 'work24', 'crawled'] },
      { name: 'title', label: '제목', type: 'text' },
      { name: 'work_type', label: '공고 유형', type: 'text' },
      { name: 'tags', label: '태그', type: 'array' },
      { name: 'salary', label: '급여(표시)', type: 'text' },
      { name: 'min_sal', label: '최저급여', type: 'number' },
      { name: 'max_sal', label: '최고급여', type: 'number' },
      { name: 'location', label: '지역', type: 'text' },
      { name: 'days', label: '근무요일', type: 'text' },
      { name: 'time', label: '근무시간', type: 'text' },
      { name: 'company', label: '회사명', type: 'text' },
      { name: 'org_name', label: '기관명', type: 'text' },
      { name: 'org_biz_no', label: '기관 사업자번호', type: 'text' },
      { name: 'org_address', label: '기관 주소', type: 'text' },
      { name: 'org_representative', label: '기관 대표자', type: 'text' },
      { name: 'organization_id', label: '기관 ID', type: 'text' },
      { name: 'phone', label: '연락처', type: 'text' },
      { name: 'is_org_verified', label: '기관 검증', type: 'boolean' },
      { name: 'is_active', label: '활성', type: 'boolean' },
      { name: 'description', label: '설명', type: 'textarea' },
      { name: 'registration_date', label: '등록일', type: 'date' },
      { name: 'deadline_date', label: '마감일', type: 'date' },
      { name: 'deleted_at', label: '삭제일시', type: 'datetime', readonly: true },
      { name: 'wanted_info_url', label: '외부 링크', type: 'text' },
      ...TS_READONLY,
    ],
  },

  notices: {
    name: 'notices',
    label: '공지/가이드',
    mode: 'crud',
    pk: ['id'],
    canCreate: true,
    listColumns: ['id', 'category', 'title', 'published_at', 'created_at'],
    searchColumns: ['title', 'content'],
    defaultSort: { column: 'published_at', ascending: false },
    fields: [
      { name: 'id', label: 'ID', type: 'text', readonly: true },
      { name: 'category', label: '분류', type: 'select', options: ['공지', '가이드'] },
      { name: 'title', label: '제목', type: 'text' },
      { name: 'content', label: '내용', type: 'textarea' },
      { name: 'published_at', label: '발행일', type: 'date' },
      { name: 'created_at', label: '생성일시', type: 'datetime', readonly: true },
    ],
  },

  // ── 로그 테이블 (목록/삭제만) ──
  bookmarks: {
    name: 'bookmarks',
    label: '북마크(종사자→공고)',
    mode: 'log',
    pk: ['user_id', 'job_id'],
    canCreate: false,
    hideInNav: true, // 종사자 상세로 이동
    defaultSort: { column: 'created_at', ascending: false },
    fields: [],
  },
  job_views: {
    name: 'job_views',
    label: '공고 열람 기록',
    mode: 'log',
    pk: ['user_id', 'job_id'],
    canCreate: false,
    hideInNav: true, // 종사자 상세로 이동
    defaultSort: { column: 'viewed_at', ascending: false },
    fields: [],
  },
  job_contact_views: {
    name: 'job_contact_views',
    label: '공고 연락처 확인',
    mode: 'log',
    pk: ['id'],
    canCreate: false,
    hideInNav: true, // 종사자 상세로 이동
    defaultSort: { column: 'viewed_at', ascending: false },
    fields: [],
  },
  worker_bookmarks: {
    name: 'worker_bookmarks',
    label: '관심 종사자(기관→종사자)',
    mode: 'log',
    pk: ['id'],
    canCreate: false,
    defaultSort: { column: 'created_at', ascending: false },
    fields: [],
  },
  worker_contact_views: {
    name: 'worker_contact_views',
    label: '종사자 연락처 확인',
    mode: 'log',
    pk: ['id'],
    canCreate: false,
    defaultSort: { column: 'viewed_at', ascending: false },
    fields: [],
  },
}

export const TABLE_LIST: TableDef[] = Object.values(TABLES)

export function getTable(name: string | undefined): TableDef | undefined {
  if (!name) return undefined
  return TABLES[name]
}

/** 수정/생성 시 무시할 컬럼 (읽기전용 pk·타임스탬프) */
export function readonlyFieldNames(def: TableDef): string[] {
  return def.fields.filter((f) => f.readonly).map((f) => f.name)
}
