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
      SYSTEM_SECTION,
    ],
  }
}

// 앱 공통 — 시스템(어드민 접근 계정 관리)
const SYSTEM_SECTION: NavSection = {
  label: '시스템',
  items: [{ label: '관리자', icon: 'i-lucide-shield-check', to: '/admins' }],
}

// 시니어 출퇴근·채팅 앱 — 신규(목 데이터)
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
        { label: '시니어 관리', icon: 'i-lucide-users', to: '/senior/workers' },
        { label: '근무지·수요처', icon: 'i-lucide-building-2', to: '/senior/worksites' },
        { label: '출퇴근 기록', icon: 'i-lucide-clock', to: '/senior/attendance' },
      ],
    },
    {
      label: '소통',
      items: [
        { label: '공지 관리', icon: 'i-lucide-megaphone', to: '/senior/notices' },
        { label: '채팅방', icon: 'i-lucide-message-square', to: '/senior/chat' },
      ],
    },
    {
      label: '설정',
      items: [{ label: '계정·권한', icon: 'i-lucide-shield-check', to: '/senior/accounts' }],
    },
    SYSTEM_SECTION,
  ],
}

export function getApps(): AppNav[] {
  return [jobsApp(), seniorApp]
}

// 현재 경로로 활성 앱 판별
export function appKeyForPath(path: string): AppNav['key'] {
  return path.startsWith('/senior') ? 'senior' : 'jobs'
}
