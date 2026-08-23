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
  // 외래키(난수 UUID)를 참조 테이블의 이름 컬럼으로 해석 → `${column}__ref` 가상 컬럼 생성
  refs?: RefDef[]
  fields: FormField[]
}

export interface RefDef {
  column: string // 이 테이블의 FK 컬럼
  table: string // 참조 테이블
  field: string // 참조 테이블에서 보여줄 이름 컬럼
  label: string // 목록 헤더 라벨
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
    listColumns: ['id', 'name', 'phone', 'gender', 'job_type', 'is_job_seeking', 'personal_history', 'updated_at'],
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
      { name: 'is_job_seeking', label: '구직중', type: 'boolean' },
      { name: 'min_wage', label: '희망 급여', type: 'number' },
      { name: 'cert_number', label: '자격증 번호', type: 'text' },
      { name: 'region_codes', label: '희망 지역코드', type: 'array' },
      { name: 'type', label: '가입 경로', type: 'text', readonly: true },
      { name: 'kakao_oauth_id', label: '카카오 OAuth ID', type: 'text', readonly: true },
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
    listColumns: ['id', 'title', 'work_type', 'company', 'location', 'salary', 'is_active', 'share_count', 'deadline_date', 'created_at'],
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
      { name: 'summary', label: '요약(한줄)', type: 'textarea' },
      { name: 'share_count', label: '공유수', type: 'number', readonly: true },
      // 수급자·돌봄 상세
      { name: 'care_grade', label: '요양등급', type: 'text' },
      { name: 'recipient_gender', label: '수급자 성별', type: 'text' },
      { name: 'recipient_age', label: '수급자 연령', type: 'text' },
      { name: 'cognitive_state', label: '인지상태', type: 'text' },
      { name: 'eating_state', label: '식사상태', type: 'text' },
      { name: 'mobility_state', label: '이동상태', type: 'text' },
      { name: 'toileting_state', label: '배변상태', type: 'text' },
      { name: 'bath_method', label: '목욕방법', type: 'text' },
      { name: 'cohabitation', label: '동거여부', type: 'text' },
      { name: 'residence_type', label: '거주형태', type: 'text' },
      // 근무 상세
      { name: 'work_address', label: '근무지 주소', type: 'text' },
      { name: 'work_detail_address', label: '근무지 상세주소', type: 'text' },
      { name: 'work_form', label: '근무형태', type: 'text' },
      { name: 'work_days', label: '근무요일(상세)', type: 'text' },
      { name: 'main_duty', label: '주요업무', type: 'textarea' },
      // 모집조건
      { name: 'recruit_count', label: '모집인원', type: 'number' },
      { name: 'required_qualification', label: '필수 자격', type: 'textarea' },
      { name: 'preferred_strengths', label: '우대 강점', type: 'textarea' },
      { name: 'experience_preference', label: '경력 우대', type: 'text' },
      // 급여 상세
      { name: 'salary_type', label: '급여 유형', type: 'text' },
      { name: 'salary_display_type', label: '급여 표시 유형', type: 'text' },
      { name: 'days_negotiable', label: '요일 협의', type: 'boolean' },
      { name: 'time_negotiable', label: '시간 협의', type: 'boolean' },
      // 마감·상태
      { name: 'close_reason', label: '마감 사유', type: 'text' },
      { name: 'closed_at', label: '마감일시', type: 'datetime', readonly: true },
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
    hideInNav: true, // 로그 nav에서 숨김(레지스트리·relations 용도 유지)
    label: '관심 종사자(기관→종사자)',
    mode: 'log',
    pk: ['id'],
    canCreate: false,
    defaultSort: { column: 'created_at', ascending: false },
    fields: [],
  },
  worker_contact_views: {
    name: 'worker_contact_views',
    hideInNav: true, // 로그 nav에서 숨김(레지스트리·relations 용도 유지)
    label: '종사자 연락처 확인',
    mode: 'log',
    pk: ['id'],
    canCreate: false,
    defaultSort: { column: 'viewed_at', ascending: false },
    fields: [],
  },

  // ── 신설 테이블 (열람/삭제) ──
  resumes: {
    name: 'resumes',
    label: '이력서',
    mode: 'log',
    pk: ['id'],
    canCreate: false, // user_id가 auth.users FK, 앱에서만 생성
    listColumns: ['name', 'phone', 'status', 'updated_at'],
    searchColumns: ['name', 'phone'],
    defaultSort: { column: 'updated_at', ascending: false },
    fields: [
      { name: 'id', label: 'ID', type: 'text', readonly: true },
      { name: 'user_id', label: '종사자 ID', type: 'text', readonly: true },
      { name: 'status', label: '상태', type: 'text', readonly: true },
      { name: 'last_saved_at', label: '마지막 저장', type: 'datetime', readonly: true },
      { name: 'name', label: '성명', type: 'text' },
      { name: 'birth_date', label: '생년월일', type: 'date' },
      { name: 'gender', label: '성별', type: 'text' },
      { name: 'phone', label: '휴대폰', type: 'text' },
      { name: 'base_address', label: '주소', type: 'text' },
      { name: 'detail_address', label: '상세주소', type: 'text' },
      { name: 'region_code', label: '법정동코드', type: 'text' },
      { name: 'careers', label: '경력(JSON)', type: 'textarea' },
      { name: 'qualifications', label: '자격증(JSON)', type: 'textarea' },
      { name: 'trainings', label: '교육·훈련(JSON)', type: 'textarea' },
      { name: 'educations', label: '학력(JSON)', type: 'textarea' },
      { name: 'final_education', label: '최종학력', type: 'text' },
      { name: 'desired_regions', label: '희망 지역', type: 'array' },
      { name: 'desired_region_codes', label: '희망 지역코드', type: 'array' },
      { name: 'desired_jobs', label: '희망 직종', type: 'array' },
      { name: 'desired_work_types', label: '희망 근로형태', type: 'array' },
      { name: 'desired_work_days', label: '희망 요일', type: 'array' },
      { name: 'emergency_contact', label: '비상연락처(JSON)', type: 'textarea' },
      { name: 'household_type', label: '세대구성', type: 'text' },
      { name: 'health_status', label: '건강상태', type: 'text' },
      { name: 'motivations', label: '신청동기', type: 'array' },
      { name: 'special_notes', label: '특이사항', type: 'textarea' },
      { name: 'consents', label: '동의(JSON)', type: 'textarea' },
      { name: 'signature', label: '서명(JSON)', type: 'textarea' },
      ...TS_READONLY,
    ],
  },

  job_recommendations: {
    name: 'job_recommendations',
    label: '공고 추천(기관→종사자)',
    mode: 'log',
    pk: ['id'],
    canCreate: false,
    listColumns: ['organization_id__ref', 'job_id__ref', 'worker_id__ref', 'read_at', 'created_at'],
    defaultSort: { column: 'created_at', ascending: false },
    refs: [
      { column: 'organization_id', table: 'organization', field: 'name', label: '기관' },
      { column: 'job_id', table: 'jobs', field: 'title', label: '공고' },
      { column: 'worker_id', table: 'users', field: 'name', label: '종사자' },
    ],
    fields: [
      { name: 'id', label: 'ID', type: 'text', readonly: true },
      { name: 'organization_id', label: '기관 ID', type: 'text' },
      { name: 'job_id', label: '공고 ID', type: 'text' },
      { name: 'worker_id', label: '종사자 ID', type: 'text' },
      { name: 'read_at', label: '읽음 시각', type: 'datetime' },
      ...TS_READONLY,
    ],
  },

  // ── 알림/공유 로그 ──
  notification_logs: {
    name: 'notification_logs',
    label: '알림 발송 로그',
    mode: 'log',
    pk: ['id'],
    canCreate: false,
    listColumns: ['user_id__ref', 'type_id', 'title', 'status', 'created_at', 'opened_at'],
    searchColumns: ['type_id', 'title'],
    defaultSort: { column: 'created_at', ascending: false },
    refs: [{ column: 'user_id', table: 'users', field: 'name', label: '사용자' }],
    fields: [
      { name: 'id', label: 'ID', type: 'text', readonly: true },
      { name: 'user_id', label: '사용자 ID', type: 'text' },
      { name: 'type_id', label: '타입', type: 'text' },
      { name: 'dedupe_key', label: '중복키', type: 'text' },
      { name: 'status', label: '상태', type: 'text' },
      { name: 'reason', label: '사유', type: 'text' },
      { name: 'title', label: '제목', type: 'text' },
      { name: 'body', label: '본문', type: 'textarea' },
      { name: 'route', label: '딥링크', type: 'text' },
      { name: 'opened_at', label: '읽음 시각', type: 'datetime' },
      { name: 'created_at', label: '생성일시', type: 'datetime', readonly: true },
    ],
  },
  job_shares: {
    name: 'job_shares',
    label: '공고 공유 로그',
    mode: 'log',
    pk: ['id'],
    canCreate: false,
    listColumns: ['job_id__ref', 'user_id__ref', 'channel', 'path', 'created_at'],
    defaultSort: { column: 'created_at', ascending: false },
    refs: [
      { column: 'job_id', table: 'jobs', field: 'title', label: '공고' },
      { column: 'user_id', table: 'users', field: 'name', label: '사용자' },
    ],
    fields: [
      { name: 'id', label: 'ID', type: 'text', readonly: true },
      { name: 'job_id', label: '공고 ID', type: 'text' },
      { name: 'user_id', label: '사용자 ID', type: 'text' },
      { name: 'channel', label: '채널', type: 'text' },
      { name: 'path', label: '경로', type: 'text' },
      { name: 'created_at', label: '생성일시', type: 'datetime', readonly: true },
    ],
  },
  notification_settings: {
    name: 'notification_settings',
    hideInNav: true, // 로그 nav에서 숨김(레지스트리·relations 용도 유지)
    label: '알림 설정',
    mode: 'log',
    pk: ['user_id'],
    canCreate: false,
    listColumns: ['user_id', 'push_enabled', 'job_recommend', 'deadline', 'activity', 'notice', 'marketing', 'updated_at'],
    searchColumns: ['user_id'],
    defaultSort: { column: 'updated_at', ascending: false },
    fields: [
      { name: 'user_id', label: '사용자 ID', type: 'text', readonly: true },
      { name: 'push_enabled', label: '푸시 전체', type: 'boolean' },
      { name: 'job_recommend', label: '일자리 추천', type: 'boolean' },
      { name: 'deadline', label: '마감', type: 'boolean' },
      { name: 'activity', label: '활동', type: 'boolean' },
      { name: 'notice', label: '공지', type: 'boolean' },
      { name: 'marketing', label: '마케팅', type: 'boolean' },
      { name: 'updated_at', label: '수정일시', type: 'datetime', readonly: true },
    ],
  },
  push_tokens: {
    name: 'push_tokens',
    hideInNav: true, // 로그 nav에서 숨김(레지스트리·relations 용도 유지)
    label: '푸시 토큰',
    mode: 'log',
    pk: ['id'],
    canCreate: false,
    listColumns: ['id', 'user_id', 'platform', 'enabled', 'updated_at'],
    searchColumns: ['user_id'],
    defaultSort: { column: 'updated_at', ascending: false },
    fields: [
      { name: 'id', label: 'ID', type: 'text', readonly: true },
      { name: 'user_id', label: '사용자 ID', type: 'text' },
      { name: 'token', label: '토큰', type: 'text' },
      { name: 'platform', label: '플랫폼', type: 'text' },
      { name: 'enabled', label: '활성', type: 'boolean' },
      ...TS_READONLY,
    ],
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
