// 통합 어드민 좌측 네비게이션 정의 — 앱별(구인구직 / 시니어) 섹션·항목
import { TABLE_LIST } from './tables'

export interface NavItem {
  label: string
  icon: string
  to: string
}
export interface NavSection {
  label?: string
  items: NavItem[]
}
export interface AppNav {
  key: 'jobs' | 'senior'
  label: string
  icon: string
  home: string
  sections: NavSection[]
}

// 구인구직 앱 테이블 아이콘 (lucide)
const JOB_ICONS: Record<string, string> = {
  users: 'i-lucide-users',
  organization_manager: 'i-lucide-id-card',
  organization: 'i-lucide-building-2',
  jobs: 'i-lucide-briefcase',
  notices: 'i-lucide-megaphone',
}

// 구인구직 앱 — 레지스트리(TABLE_LIST) 기반 동적 생성
function jobsApp(): AppNav {
  const crud = TABLE_LIST.filter((t) => t.mode === 'crud' && !t.hideInNav)
  const log = TABLE_LIST.filter((t) => t.mode === 'log' && !t.hideInNav)
  return {
    key: 'jobs',
    label: '구인구직',
    icon: 'i-lucide-briefcase',
    home: '/',
    sections: [
      { items: [{ label: '대시보드', icon: 'i-lucide-layout-dashboard', to: '/' }] },
      {
        label: '데이터 관리',
        items: crud.map((t) => ({
          label: t.label,
          icon: JOB_ICONS[t.name] || 'i-lucide-table',
          to: `/${t.name}`,
        })),
      },
      {
        label: '로그',
        items: log.map((t) => ({
          label: t.label,
          icon: 'i-lucide-scroll-text',
          to: `/${t.name}`,
        })),
      },
    ],
  }
}

/**
 * 출결 조정 요청(QA 2026-11-02 PARTNER-02) — 담당자·master 가 확정·반려한다. 메뉴에 기다림 수를 붙인다(`AppSidebar`).
 * 수요처는 이 메뉴 없이 출퇴근 기록의 「내 요청」 탭으로 본다
 */
export const ATTENDANCE_REQUESTS_PATH = '/senior/attendance-requests'

// 시니어 출퇴근·채팅 앱 — dbo-admin API 연동
const seniorApp: AppNav = {
  key: 'senior',
  label: '시니어 출퇴근',
  icon: 'i-lucide-users-round',
  home: '/senior',
  sections: [
    { items: [{ label: '대시보드', icon: 'i-lucide-layout-dashboard', to: '/senior' }] },
    {
      label: '운영',
      items: [
        { label: '명부 관리', icon: 'i-lucide-users', to: '/senior/workers' },
        { label: '근무지·수요처', icon: 'i-lucide-building-2', to: '/senior/worksites' },
        { label: '출퇴근 기록', icon: 'i-lucide-clock', to: '/senior/attendance' },
        { label: '조정 요청', icon: 'i-lucide-clipboard-check', to: ATTENDANCE_REQUESTS_PATH },
        { label: '휴무 관리', icon: 'i-lucide-calendar-off', to: '/senior/holidays' },
        { label: '리포트', icon: 'i-lucide-chart-column', to: '/senior/reports' },
      ],
    },
    {
      label: '소통',
      items: [
        { label: '공지·미열람 관리', icon: 'i-lucide-megaphone', to: '/senior/notices' },
        { label: '채팅방', icon: 'i-lucide-message-square', to: '/senior/chat' },
        { label: 'FAQ 관리', icon: 'i-lucide-circle-help', to: '/senior/faqs' },
        { label: 'AI 문서 관리', icon: 'i-lucide-file-text', to: '/senior/documents' },
      ],
    },
    {
      label: '설정',
      items: [
        { label: '사업 관리', icon: 'i-lucide-layers', to: '/senior/programs' },
        { label: '계정·권한', icon: 'i-lucide-shield-check', to: '/senior/accounts' },
      ],
    },
  ],
}

/** 어드민 롤 — server/utils/admin.ts 의 AdminRole 과 같은 값이다 */
export type NavRole = 'master' | 'worksite' | 'org' | 'manager'

/**
 * 롤이 볼 수 있는 메뉴만 남긴다.
 *
 * **화면을 가리는 것은 편의일 뿐 보안이 아니다.** 실제 차단은 서버가
 * assertTableAccess·applyRoleScope 로 한다. 여기서 숨겨도 주소를 직접 치면
 * 요청은 가고, 거기서 404/403 이 난다.
 */
export function getApps(role: NavRole = 'master'): AppNav[] {
  if (role === 'master') return [jobsApp(), seniorApp]

  if (role === 'org') {
    // 기관 관리자 — 구인구직의 종사자·기관만
    const allowed = new Set(['/users', '/organization'])
    const jobs = jobsApp()
    return [
      {
        ...jobs,
        sections: jobs.sections
          .map((s) => ({ ...s, items: s.items.filter((i) => allowed.has(i.to)) }))
          .filter((s) => s.items.length > 0),
      },
    ]
  }

  // 담당자(사회복지사) — 맡은 수요처의 출퇴근 기록·조정 요청과 휴무 관리
  if (role === 'manager') return [seniorOnly(MANAGER_PATHS, '/senior/attendance')]

  // 수요처 담당자 — 시니어의 출퇴근 기록·근무지만. 첫 화면은 오늘 출결이다(QA 2026-11-02 PARTNER-04)
  return [seniorOnly(WORKSITE_PATHS, '/senior/attendance')]
}

/**
 * 담당자에게 연 화면. 메뉴와 라우트 가드(`middleware/auth.global.ts`)가 같은 목록을 쓴다.
 * 휴무 관리(2026-10-27)·조정 요청(2026-11-04, QA PARTNER-02)은 서버가 맡은 근무지로 범위를 좁힌다.
 */
const MANAGER_PATHS = ['/senior/attendance', ATTENDANCE_REQUESTS_PATH, '/senior/holidays']

/** 담당자가 이 경로에 들어갈 수 있는가. 접두만 같은 다른 경로(`/senior/holidays-x`)는 막는다 */
export function managerAllows(path: string): boolean {
  return allows(MANAGER_PATHS, path)
}

/**
 * 수요처 담당자에게 연 화면. 메뉴와 라우트 가드가 같은 목록을 쓴다.
 *
 * **주소를 직접 쳐도 막는다**(QA 2026-11-02 PARTNER-03). 메뉴만 숨겼더니 명부 관리·계정 화면이
 * 「등록된 … 없습니다」 빈 화면으로 열렸다. 데이터는 서버가 막지만 화면이 이유 없이 비어 보인다.
 * 메뉴 순서가 곧 이 배열 순서다 — 시니어 앱 메뉴 정의 순서를 따른다.
 */
const WORKSITE_PATHS = ['/senior/worksites', '/senior/attendance']

/** 수요처 담당자가 이 경로에 들어갈 수 있는가 */
export function worksiteAllows(path: string): boolean {
  return allows(WORKSITE_PATHS, path)
}

/**
 * 휴대폰 폭에서 여는 화면(QA 2026-11-02 MOBILE-02, 결정 F7). 나머지 메뉴는 「PC에서만 이용」으로 두고,
 * 주소로 들어오면 「PC에서 이용해 주세요」 안내를 그린다(`AdminShell`).
 *
 * **롤 규칙과 따로 본다.** 롤이 막은 화면은 라우트 가드가 먼저 돌려보낸다. 이 목록은 그 위에 폭 제한만 더한다.
 */
const PHONE_PATHS = ['/senior/attendance']

/** 휴대폰 폭에서 이 경로를 열 수 있는가 */
export function phoneAllows(path: string): boolean {
  return allows(PHONE_PATHS, path)
}

/**
 * 휴대폰 폭이 아닌 폭 — Tailwind `sm`(40rem = 640px) 이상. 휴대폰 카드(`DataTable` 의 `sm:` 클래스)와 같은 경계다.
 * 세로 휴대폰은 430px 안팎이다. 셸의 햄버거 전환(`lg` 1024px)이나 `md`(768px)를 쓰면 1366px 노트북 반쪽 창(683px)과
 * 아이패드 미니 세로(744px)까지 「PC에서 이용해 주세요」가 된다.
 */
export const PC_MEDIA = '(min-width: 40rem)'

/** 휴대폰 폭 안내 화면의 바로가기 — 이 롤의 메뉴 가운데 휴대폰에서 열리는 첫 화면. 없으면 null(기관 관리자) */
export function phoneHome(role: NavRole): string | null {
  for (const app of getApps(role)) {
    for (const section of app.sections) {
      const item = section.items.find((i) => phoneAllows(i.to))
      if (item) return item.to
    }
  }
  return null
}

function allows(paths: string[], path: string): boolean {
  return paths.some((p) => path === p || path.startsWith(`${p}/`))
}

/** 시니어 앱에서 허용한 메뉴만 남긴다. home 은 남긴 메뉴 중 하나여야 한다. */
function seniorOnly(paths: string[], home: string): AppNav {
  const allowed = new Set(paths)
  return {
    ...seniorApp,
    home,
    sections: seniorApp.sections
      .map((s) => ({ ...s, items: s.items.filter((i) => allowed.has(i.to)) }))
      .filter((s) => s.items.length > 0),
  }
}

// 현재 경로로 활성 앱 판별
export function appKeyForPath(path: string): AppNav['key'] {
  return path.startsWith('/senior') ? 'senior' : 'jobs'
}
