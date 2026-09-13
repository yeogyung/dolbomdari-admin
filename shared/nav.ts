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
      ],
    },
    {
      label: '소통',
      items: [
        { label: '채팅방', icon: 'i-lucide-message-square', to: '/senior/chat' },
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
export type NavRole = 'master' | 'worksite' | 'org'

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

  // 수요처 담당자 — 시니어의 근무지·출퇴근 기록만
  const allowed = new Set(['/senior/worksites', '/senior/attendance'])
  return [
    {
      ...seniorApp,
      home: '/senior/worksites',
      sections: seniorApp.sections
        .map((s) => ({ ...s, items: s.items.filter((i) => allowed.has(i.to)) }))
        .filter((s) => s.items.length > 0),
    },
  ]
}

// 현재 경로로 활성 앱 판별
export function appKeyForPath(path: string): AppNav['key'] {
  return path.startsWith('/senior') ? 'senior' : 'jobs'
}
