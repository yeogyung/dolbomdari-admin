# 통합 어드민 디자인 개편 체크리스트

브랜치: `feat/admin-redesign` · 계획서: `~/.claude/plans/iridescent-painting-mountain.md`

## Phase 0 — 토큰/폰트
- [x] `nuxt.config.ts` components pathPrefix:false
- [x] `main.css` 디자인 토큰(red brand + 상태색 + warm neutral) + 폰트(Inter/Noto Sans KR)
- [x] `app.config.ts` primary=brand + success/warning/info 매핑

## Phase 1 — 컴포넌트 라이브러리 (원자 → 유기체 → 템플릿)
### 원자 (app/components/atoms)
- [x] AppButton (variant: solid/soft/outline/ghost, color, size, loading, icon)
- [x] IconButton
- [x] StatusBadge (green/red/amber/blue/gray + dot)
- [x] Tag
- [x] Card
- [x] Divider
- [x] PageTitle (제목 + 설명 + 우측 액션 슬롯)
- [x] EmptyState
- [x] AppSpinner (기존 Spinner 대체)
- [x] FormField (label + hint + error 래퍼)
- [x] TextField / SelectField / DateField / AppTextarea
- [x] Toggle / Checkbox
- [x] SearchInput
- [x] Avatar

### 유기체 (app/components/organisms)
- [x] AppSidebar (앱 스위처 + 앱별 네비, shared/nav.ts)
- [x] AppTopbar (사용자·로그아웃)
- [x] DataTable (툴바: 검색·페이지크기·엑셀 + 넘버링·정렬·행액션 + 페이지네이션)
- [x] StatCard (KPI)
- [ ] AppModal / ConfirmDialog
- [ ] RecordForm (재작성)
- [ ] ChatPanel (방 목록 + 대화)
- [ ] MobileBlock ("PC에서 이용해 주세요")

### 템플릿 (app/components/templates)
- [x] AdminShell (Sidebar + Topbar + 본문)
- [ ] ListPage / DetailPage / FormPage / DashboardPage / MobileAttendancePage

## Phase 2 — 셸
- [x] shared/nav.ts (apps → sections → items)
- [x] default.vue → AdminShell 사용
- [x] 1024↓ 사이드바 햄버거

## Phase 3 — 공고추천 재스킨
- [x] `/[table]` 목록 → DataTable
- [ ] 상세/edit/new → 새 폼·상세 컴포넌트
- [x] 대시보드 → StatCard
- [ ] Relations 3종 재스킨

## Phase 4 — 시니어 앱 신규(목데이터)
- [ ] app/mocks/senior/*.ts
- [ ] /senior 대시보드(오늘 출결)
- [ ] /senior/workers (+[id])
- [ ] /senior/worksites (+[id], /new)
- [ ] /senior/attendance (목록·수정)
- [ ] /senior/notices (+/new)
- [ ] /senior/accounts
- [ ] /senior/chat
- [ ] 모바일: 출퇴근 3화면 + 그 외 MobileBlock

## Phase 5 — 검증
- [ ] npm run dev 전체 동작
- [ ] 타입 체크

## 디자인 대조 (HTML 시안 vs 구현)
- [x] 1차 대조 에이전트 → 불일치 수정(브랜드 blue, Noto600, 사이드바 계정, 테이블 체크박스/상세, 버튼 웨이트, 배지 패딩, 페이지네이션 웨이트)
- [x] 2차 대조 에이전트 → 7건 반영 확인, hover/미세편차 정리 → 정적 화면 시안과 통일
