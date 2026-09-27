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

- [ ] app/mocks/senior/\*.ts
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

- 어드민 공지 운영(W5/W6): 대상 지정·확인율 집계·회수·미열람 재발송
- 출결 CSV 서버 내보내기(현재는 클라이언트 엑셀로 대체)
- 게시판·댓글·시니어 메모, 인앱 알림함, AI 근거 문서·FAQ·미답변, 리포트·날씨
- 어드민 채팅방 생성(열람·상태 변경만 가능)

## Phase 5 — 구인구직 상세·수정·생성 화면 디자인 통일

목록 화면은 이미 시안 디자인으로 넘어왔는데 상세·수정·생성만 Nuxt UI 날것으로 남아 있었다.
`<script setup>` 은 건드리지 않는다 — 마크업과 클래스만 바꾼다.

- [x] `RecordForm.vue` — 입력 위젯을 프로젝트 atoms 로, 버튼 pill 화
- [x] `[table]/[id]/index.vue` 상세 — 제목·액션 상단바로, 키-값 카드 재구성
- [x] `[table]/[id]/edit.vue` 수정 — 제목 상단바로, AppCard
- [x] `[table]/new.vue` 생성 — 제목 상단바로, AppCard
- [x] `WorkerRelations.vue` — 종사자 상세 하단
- [x] `OrgRelations.vue` — 기관 상세 하단
- [x] `JobRelations.vue` — 공고 상세 하단(요약 타일 + 추천 모달)
- [x] `ResumeSharePanel.vue` — 이력서 공유 패널
- [x] 검증: `<script>` 블록 무변경 확인 + `vue-tsc --noEmit` + `npm test`
- [ ] 브라우저 육안 확인 (로그인 계정이 없어 사용자 확인 필요)
- [x] 고아가 된 구식 `Spinner.vue` 삭제(전부 `AppSpinner` 로 옮겨감)

### 공지 발송 채널·미열람 조회

- [x] `/senior/notices` 목록과 `/senior/notices/[id]` 상세
- [x] 참여자별 문자·푸시 접수 상태 및 실제 열람 기록 표시
- [x] 전체·문자·푸시 필터와 전체·미열람·열람 완료 필터
- [x] 문자와 푸시 병행 수신자는 양쪽 채널에 포함
- [x] 앱 미가입자는 미열람에서 제외하며 기존 공지의 채널은 추정하지 않음
- [ ] 운영 DB 마이그레이션과 dbo·dbo-admin·어드민 배포 및 실데이터 확인

서버의 `20260917000000_dbo_notice_deliveries.sql` 적용이 선행되어야 한다.
문자·푸시 필터는 공급자 접수 기준이며 단말 수신 보장이나 열람 완료를 뜻하지 않는다.
이력 없는 기존 공지는 화면에서 이력 없음으로 안내한다.

## Phase 6 — FAQ 승인 관리 (`/senior/faqs`)

담당자가 앱에서 올린 FAQ(`pending`)를 master 가 웹에서 승인·반려한다. 서버 변경 없음.
조회는 supabase-js 로 RLS 를 타고 직접 읽고, 승인·반려만 dbo-admin `PATCH /faqs/{id}` 로 쓴다.

- [x] `Faq`·`FaqStatus` 타입, `useFaqs`(조회), `updateFaqStatus`(쓰기)
- [x] `utils/faqs.ts` 라벨·톤·필터·범위·오류 메시지 + `test/faqs.test.ts`
- [x] `/senior/faqs` 목록 — 승인 상태 배지, 상태 필터, 질문·답변 검색
- [x] `/senior/faqs/[id]` 상세 — 승인·반려(사유 없음, 결정 번복 허용)
- [x] 좌측 메뉴 '소통' 에 FAQ 관리 추가
- [x] `npm test` + `npm run build`
- [ ] master 세션으로 목록·상세·승인·반려 왕복 브라우저 확인 (사용자 확인 필요)

원격 DB 에 서버의 `20260925000000_dbo_knowledge_manager.sql` 이 적용되어 있어야 한다.

## Phase 7 — 목록 체크박스 제거·본문 최대 폭 해제·상세 2열

체크박스는 디자인 개편(6007301)에서 시안을 옮기며 들어온 장식이다. 선택 기능이 없다.

- [x] `[table]/index.vue` 의 `selectable` 제거 + DataTable 의 `selectable` prop·마크업 제거
- [x] `AdminShell.vue` 본문 `max-w-[1200px]` 제거 (폼 화면은 자체 `max-w-3xl` 유지)
- [x] `[table]/[id]/index.vue` 상세 — `max-w-4xl` 제거, 항목 2열(긴 값은 2칸 병합)
- [x] `npm test` + `npm run build`
- [ ] 브라우저 육안 확인 (사용자 확인 필요)

## Phase 8 — AI(RAG) 문서 관리 (`/senior/documents`)

서버 설계: `dolbomdari-server/docs/superpowers/specs/2026-09-15-dbo-documents-admin-design.md`.
이번 범위는 목록·상세·수정. 신규 등록(파일 추출)은 다음 라운드.

- [x] `DocumentListItem`·`DocumentDetail`·`DocumentState` 타입, `listDocuments`·`getDocument`·`updateDocument`
- [x] `utils/documents.ts` 상태 톤·범위 라벨·용량·`buildDocumentPatch`·`utcYesterday` + `test/documents.test.ts`
- [x] `/senior/documents` 목록 — 상태 배지, 파일명 검색, 서버 페이지·정렬
- [x] `/senior/documents/[id]` 상세 — 버전·발효일·종료일·본문 수정, 색인 청크 수, 근거에서 빼기
- [x] 좌측 메뉴 '소통' 에 AI 문서 관리 추가
- [x] `npm test` + `npm run build`
- [ ] master 세션으로 목록·상세·수정·근거에서 빼기 브라우저 확인 (사용자 확인 필요)

## Phase 9 — AI 문서 등록 (md·docx·pdf)

HWP 는 지원하지 않는다(사용자 결정). 서버는 텍스트만 받으므로 브라우저가 추출한다.

- [x] `pdfjs-dist`·`mammoth` 설치 — 등록 화면에서만 동적 import
- [x] `utils/documentImport.ts` 형식 판별·텍스트 정리·등록 본문 검증 + `test/documentImport.test.ts`
- [x] `useDocumentExtract` — md(텍스트)·docx(mammoth)·pdf(pdf.js) 추출
- [x] `createDocument` API + `/senior/documents/new` 등록 화면(추출 → 검수·수정 → 등록)
- [x] 목록 상단 「문서 등록」 버튼
- [x] `npm test` + `npm run build`
- [ ] 실제 md·docx·pdf 파일로 추출 품질 브라우저 확인 (사용자 확인 필요)
