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

## Phase 10 — 운영 피드백 4건 (2026-10-03)

계획: 담당자(사회복지사) 어드민 로그인 + 담당 수요처 출결만 열람, 배정 수정이 앱에 반영되도록 근무 행 재동기화,
명부 역할 필터, 담당자 상세에 「담당 수요처」 편집. 서버(`dolbomdari-server`)·앱(`db-operation-rn`) 변경 포함.

### 2. 배정 수정 → 앱 반영
- [x] 서버: 배정 생성·수정·삭제 시 오늘(KST) 이후·출결 없는 `dbo_shifts` 재동기화 + 테스트
- [x] 앱: 내정보 탭이 포커스마다 배정을 다시 불러온다

### 3. 명부 역할 필터
- [x] 서버: `GET /directory?role=senior|manager` + 라우트 스키마
- [x] 어드민: 명부 목록에 역할 PillSelect

### 4. 담당자 상세 → 담당 수요처
- [x] 상세: 시니어만 「반복 배정」, 담당자는 「담당 수요처」 카드
- [x] 담당 수요처 저장 경로(서버/어드민 API)

### 1. 담당자 어드민 로그인
- [x] 서버 문지기(dbo-admin) manager 허용 + 출결 범위를 담당 수요처로 제한 + 테스트
- [x] 어드민 Nitro `requireAdmin` manager 롤 + 사이드바는 출퇴근 기록만
- [x] 미들웨어 첫 화면 `/senior/attendance`, 권한 없음 시 로그인 화면 안내 문구

### 검증
- [x] 서버 `deno test` · 어드민 `npm test` + `npm run build` · 앱 타입체크
- [ ] 서버 배포(`make deploy-dbo` 등) — 사용자 확인 후
- [ ] 담당자 계정으로 로그인·출결 목록·수정, 명부에서 담당 수요처 지정 브라우저 확인 (사용자 확인 필요)

## Phase 11 — 배정 담당자 칸 동기화 (2026-10-08)

계획: 앱은 `dbo_assignments.manager_profile_id`(배정 담당자)로, 어드민은 `dbo_worksites.manager_directory_id`(근무지 담당자)로
담당 범위를 정해 서로 어긋났다(김미영 사례). 앱·RLS 는 그대로 두고, 근무지 담당자를 배정 담당자 칸에 맞춰 채운다.

- [ ] 마이그레이션: `dbo_sync_assignment_managers(worksite_ids)` 함수 + 기존 데이터 1회 동기화 — 파일 생성이 권한 정책에 막혀 사용자 결정 대기
- [x] 서버: 배정 생성·담당 수요처 저장·명부 등록·근무지 담당자 변경·담당자 종료/상태 변경 때 동기화 + 테스트 (e80b2c7)
- [x] 서버: 담당자 로그인 때 동기화(실패해도 로그인은 계속)
- [x] 리뷰 반영(재시도해도 같은 결과, managerProfileId 거절, 근무지 생성 시 동기화 제거)
- [x] 어드민: 근무지 담당자 라벨 정정 (8eaf2b4)
- [ ] 배포: 마이그레이션 → 서버(dbo-admin·dbo-public). 서버만 먼저 나가면 저장이 manager_sync_failed
- [ ] 운영 데이터: 햇살요양원 근무지 담당자 칸의 한정숙(role=worksite) 정리 — 사용자 확인 대기

## Phase 12 — 근무지 담당자 칸으로 담당자 범위 일원화 (2026-10-08)

계획: 담당자(사회복지사)는 「근무지 담당자」로 근무지에 1명 지정한다(`dbo_worksites.care_manager_directory_id`, 명부 id).
앱·어드민 모두 「시니어 → 배정 → 근무지 → 근무지 담당자」로 범위를 정한다. Phase 11(배정 담당자 동기화)은 폐기한다.
`manager_directory_id` 는 원래 의미(수요처 담당자, role=worksite)로 되돌린다. 배정의 `manager_profile_id` 는 남기되 읽지 않는다.

- [x] 마이그레이션 `20261008020000_dbo_worksite_care_manager.sql`: 새 칸 + 값 이전 + RLS 함수 5개
- [x] 서버: Phase 11 동기화 커밋(e80b2c7) 되돌리기 (7929223)
- [x] 앱 API + 마이그레이션 (78b4a61), dbo-admin (c24f9b0) — 서버 테스트 334 통과, 리뷰 반영(manageablePeople 페이지 처리)
- [x] 어드민 화면: 근무지 담당자/수요처 담당자 분리 (332a239)
- [x] 시니어 앱: 「담당 선생님」을 서버 담당자 목록에서 근무지 기준으로 (6c64430)
- [ ] 시니어 앱 구 함수 `api/dbo-open-direct` 정리(아직 배정 담당자 기준, package.json deploy:api 에 남아 있음)
- [ ] 데모 시드: 근무지 담당자(care_manager_directory_id) 채우기 — 운영 DB 를 덮을 수 있어 담당자 배치 확정 후
- [ ] 배포: 마이그레이션(db push) → 서버(dbo, dbo-admin) → 어드민 → 앱(OTA)
- [ ] 확인: 김미영 앱·어드민 모두 늘봄어린이집만, 근무지 화면에서 담당자 지정 후 앱 범위 반영

## Phase 13 — 수요처 담당자 상세 + 담당 수요처 지정 (2026-10-09)

계획: 명부 상세가 수요처 담당자(role=worksite)도 다룬다. 담당 수요처는 1곳이고, 지정하면 권한 칸
`dbo_directory.worksite_id` 와 표시 칸 `dbo_worksites.manager_directory_id`(수요처 담당자)를 함께 맞춘다.
근무지 담당자(사회복지사, care_manager_directory_id)와 다르다.

- [x] 서버: 명부 상세·수정·종료에 worksite 역할 포함 + `PUT /directory/{id}/worksite` + 테스트 (서버 340 통과)
- [x] 어드민: 명부 목록 수요처 행 → 상세, 상세에 「담당 수요처」 카드·지정 모달(1곳)
- [x] 리뷰 반영: 이메일 계정 저장 시 빈 전화번호 전송으로 400 나던 문제
- [ ] 배포: 서버(dbo-admin) → 어드민

## Phase 14 — 목록 화면 엑셀 내보내기 (2026-10-11)

계획: 내보내기가 없던 senior 목록 화면에 상단바 「엑셀 다운로드」를 붙인다. 페이지가 있는 목록은 조회 조건 전체를
`fetchAllPages` 로 받아 내보내고, 전량을 이미 받은 목록(FAQ·사업·계정)은 화면의 행(필터 반영)을 그대로 쓴다.
셀 값은 화면 표기(라벨·이름)로 바꾸되 날짜는 연도까지 쓴다.

- [x] `excel.ts`: 연도 포함 시각 표기 `excelStamp` + 테스트
- [x] 명부 관리 (`/senior/workers`)
- [x] 근무지·수요처 (`/senior/worksites`)
- [x] 계정·권한 (`/senior/accounts`)
- [x] 사업 관리 (`/senior/programs`)
- [x] AI 문서 관리 (`/senior/documents`)
- [x] FAQ 관리 (`/senior/faqs`)
- [x] 공지 목록 (`/senior/notices`)
- [x] 공지 수신자 (`/senior/notices/[id]`)
- [x] 테스트·타입검사(신규 오류 0) → 리뷰(지적 없음, 근무지 빈 값 표기만 맞춤)
- [x] 내보내기 중 화면 전체 스피너 오버레이(`useExcelExport` + `ExcelExportOverlay`) — 내보내기 있는 10개 화면 공통

## Phase 15 — 시니어 월간 리포트 (2026-10-14)

계획: master 전용 `/senior/reports` — dbo-admin `GET /dbo-admin/reports/monthly`(서버 브랜치 `feat/admin-monthly-report`)로
출결·인력·공지를 월 단위로 본다. 서버는 원값만 주고 비율·표기는 어드민 `utils/reports.ts` 가 만든다.

- [x] 타입(`MonthlyReport`)·API 클라이언트(`getMonthlyReport`)·표기 유틸(`recentMonths`·`pct`·`fmtMinutes`·`throughLabel`) + 테스트
- [x] 메뉴 「리포트」(master 만) + 미들웨어로 master 외 홈 이동 + 테스트
- [x] 리포트 페이지 — 요약·상태 분포·일별 추이·근무지/사업별·결석 상위·인력·공지
- [x] 테스트·타입검사(신규 오류 0)
- [ ] 서버 배포 후 실제 master 세션으로 화면 확인(메뉴·월 전환·빈 달 문구), worksite 계정 직접 입력 시 홈 이동

## Phase 16 — 대시보드·리포트 캐시 (2026-10-14)

계획: 메뉴를 오갈 때마다 집계 API 를 다시 부르지 않게 탭 메모리 TTL 캐시(5분)를 둔다. 5분 안에는 요청 없이 캐시를 보이고,
상단바 「새로고침」으로 강제 갱신한다. 화면에 「HH:MM 기준」을 적어 캐시된 값임을 알린다. 서버 변경 없음.

- [x] `utils/ttlCache.ts` — TTL·강제 갱신·실패 미보관·동시 호출 합치기·비우기 + 테스트
- [x] 로그아웃·권한 거부 시 캐시 비우기(`useAdminRole().clear()`)
- [x] 시니어 대시보드(`/senior`) — 오늘 출결·규모 카드
- [x] 구인구직 대시보드(`/`) — 핵심 지표·테이블 건수
- [x] 리포트(`/senior/reports`) — 월별
- [x] 테스트·타입검사(신규 0) → 리뷰(계정 전환 시 캐시 잔존·첫 로딩 중 새로고침 경쟁 2건 반영)

## Phase 17 — 구인구직 상세 공통 컴포넌트 + 기관 화면 (2026-10-14)

계획: 종사자 상세에 페이지 분기로 넣었던 머리·숨김·카드 묶음·시각 표기를 레지스트리 `TableDef.detail` + 공통 `RecordDetail` 로 옮기고,
기관 담당자·기관 상세에 같은 방식을 적용한다. 하단 기록 표는 `RelationTable` 로 공통화하고 난수 id 를 이름으로 바꾼다.
기관 목록에 등록 공고·관심 종사자·연락한 종사자 수 컬럼을 붙인다(서버 `counts`).

- [x] `recordDetail.ts` 순수 함수 + `RecordDetail.vue` + 상세 페이지 교체(종사자 회귀 없음) + 테스트
- [x] 서버 `resolveRefs` 추출·단건 조회 적용, 기관 담당자·기관 `detail`
- [x] 기관 목록 집계 컬럼(`tallyCounts` 테스트, `attachCounts`, 정렬 가드)
- [x] `RelationTable` 공통화, 기관 하단 표 이름·서울 시각
- [x] 테스트·타입검사(신규 0) → 리뷰(담당자 엑셀 「소속 기관」 머리글 중복 반영) → 화면 확인 요청

## Phase 18 — 어드민 점검 개선 (2026-10-16)

계획: 점검에서 나온 항목을 `improvements.md` 에 우선순위로 모으고 위에서부터 처리한다. 항목별 체크는 그 파일에서 한다.

- [x] 개선 목록 문서(`improvements.md`)
- [ ] 1순위 보안 → 2순위 데이터 정확성 → 3순위 표기 → 4순위 접근성 순서로 처리

## 이력서 PDF 글자 누락 수정 (2026-10-28)

- [x] 샘플 PDF 내장 글꼴 디코드 — 서브셋 109개 글리프 중 33개 손상 확인(원본 TTF 는 정상)
- [x] 내장 글꼴 글리프 전수 디코드 테스트 추가(실패 확인) → `subset: false` 로 통과
- [x] 재생성 샘플 육안 확인(성명·날짜·서명란 전부 표시), vitest 278 · vue-tsc 통과
- [x] 리뷰 반영 — 테스트의 `lookup(..., PDFRawStream)` 타입 오류(TS2769)를 `instanceof` 필터로 수정. `test/` 는 vue-tsc 범위 밖이라 strict `tsc` 로 따로 확인
- [ ] 배포 후 실제 이력서 PDF 다운로드 확인

## 이력서 서류 A4·워터마크·저장 + 상세 화면 정리 (2026-10-28)

계획: 어드민 이력서 상세와 링크 공개 열람(`/r/[token]`)의 서류를 A4 장(794×1123px)으로 나눠 보이고, 장마다 가운데에 돌봄다리 마크
워터마크(폭 18%·투명도 12%)를 얹는다. 넘치면 줄 단위로 다음 장에 넘기고 머리글은 다시 쓰지 않는다. 장을 브라우저에서 그림으로 떠서
PDF·PNG(여러 장은 세로로 이어 붙인 한 장)로 저장한다. 공개 링크는 종사자당 하나만 살려 두고, 복사는 주소만 한다.
상세 카드의 JSON 칸(경력·자격·훈련·학력·비상연락처·동의·서명)은 항목별 줄로 풀고, 칸 이름은 굵게 한다.

- [x] 링크 복사 시 주소만 복사(비밀번호 제외)
- [x] 공개 링크 발급 시 이전 링크 자동 폐기(서버) + 살아 있는 링크가 있으면 발급 전 확인창
- [x] 상세 카드 JSON 칸 항목별 표기(`resumeFields.ts` + `buildDetailView` 문구 함수) + 테스트
- [x] 상세 카드 칸 이름 굵게(`RecordDetail` 공용 — 모든 테이블)
- [x] 장 나누기 순수 함수(`resumePages.ts`) + 테스트
- [x] 저장(`resumeExport.ts` — html-to-image → PNG 이어 붙이기 / pdf-lib PDF)
- [x] `ResumeDocument` A4 장·워터마크·축소 표시, 상세 화면 서류 카드에 저장 버튼, 공유 패널 PDF 버튼 제거
- [ ] 서버 PDF 렌더러·글꼴·라우트·테스트 제거(쓰는 곳이 없어짐)
- [ ] 링크 레포에 같은 서류 컴포넌트·유틸·테스트 복제 + 열람 페이지 저장 버튼
- [ ] 테스트·타입검사·빌드(두 레포)
- [x] 브라우저 실측 확인 — 한 장·여러 장 장 나누기, 저장 파일 열어 보기(링크 페이지에 API 응답을 가짜로 넣어 확인)
  경력 1건 1장 · 긴 글 섞인 40건 3장 · 모바일 390px 24건 2장 모두 표 높이 ≤ 1011px, PDF 쪽수 = 화면 장 수, PNG 육안 확인
- [ ] 리뷰 에이전트
- [ ] 배포 후 어드민 상세 화면·실제 링크로 확인
