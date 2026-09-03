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

## Phase 4 — 시니어 어드민 실 API 연동 (dbo-admin)
근거: `C:\Works\handoff\openapi-admin.json` (2026-08-25, 26개 엔드포인트)

- [x] `app/types/dbo.ts` — 명세 기반 요청·응답 타입
- [x] `app/composables/useDboAdmin.ts` — Edge Function 클라이언트 + 오류 한국어화
- [x] `app/utils/dbo.ts` — 요일·출결 상태·시각(Asia/Seoul)·전화번호 포맷
- [x] `shared/nav.ts` — 공지 제거(API 미구현), 사업 관리 추가, 라벨 정리
- [x] `/senior` 대시보드 — 오늘 출결 집계 + 확인 필요 근무 + 운영 규모
- [x] `/senior/workers` 명부 목록·검색·상태 필터·등록
- [x] `/senior/workers/[id]` 상세 수정(전화번호 변경 경고)·계약 종료·반복 배정 CRUD
- [x] `/senior/worksites` 근무지 목록·등록·수정 + QR 토큰 열람·재발급
- [x] `/senior/attendance` 기간·근무지·이름 조회 + 대리 기록 수정 + 엑셀 내보내기
- [x] `/senior/programs` 사업 목록·등록·수정(구분 색)
- [x] `/senior/accounts` 운영관리자·수요처 계정 발급·수정·종료
- [x] `/senior/chat` 채팅방 목록·대화 열람·활성/종료
- [x] `npm run build` 통과 + 8개 라우트 HTTP 200 확인
- [ ] 실제 master 세션으로 화면 왕복 검증 (데이터 0행 상태여서 브라우저 확인 필요)

### 백엔드 미구현으로 화면을 만들지 않은 항목
- 어드민 공지 운영(W5/W6): 목록·대상 지정·확인율·회수·미열람 재발송
- 출결 CSV 서버 내보내기(현재는 클라이언트 엑셀로 대체)
- 게시판·댓글·시니어 메모, 인앱 알림함, AI 근거 문서·FAQ·미답변, 리포트·날씨
- 어드민 채팅방 생성(열람·상태 변경만 가능)
