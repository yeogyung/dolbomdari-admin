# 컨텍스트 노트 — 돌봄다리 어드민

작업 중 내린 결정과 근거를 계속 추가한다.

## 핵심 결정
- **RLS 우회**: dolbomdari의 모든 테이블은 RLS로 본인 행만 접근 가능. 어드민은 전체 데이터를 다뤄야 하므로 `service_role` 키를 서버(server/api)에서만 사용. 클라이언트는 자체 서버 API만 호출한다.
- **인증**: 클라이언트가 anon 키로 Supabase 이메일 로그인 → 발급된 access token을 서버 API 요청 헤더에 첨부 → 서버가 `auth.getUser(token)`로 검증하고 이메일이 `NUXT_ADMIN_EMAILS` allowlist에 있는지 확인.
- **config-driven CRUD**: 테이블 10개를 하드코딩하지 않고 `shared/tables.ts` 레지스트리 하나로 목록/폼을 공용 렌더링. 레지스트리가 곧 서버 화이트리스트 역할도 한다.
- **목록 테이블 UI**: Nuxt UI 4의 UTable(TanStack 기반)은 컬럼 API가 복잡하고 버전 민감. 안정성을 위해 목록은 Tailwind 순수 `<table>`로 렌더링하고, 폼 요소(UInput/USelect/UTextarea 등)와 UButton/UPagination/UModal만 Nuxt UI 컴포넌트 사용.
- **엑셀**: SheetJS(xlsx) 클라이언트 사이드 생성. 서버 목록 API에 `all=true`(페이지네이션 없이 전량, 상한 캡)로 전체 조회 후 워크북 생성.

## 스키마 권위 소스
메인 앱 저장소의 `supabase/migrations/` (SQL DDL). API 매핑은 메인 앱의 `lib/api/*.ts`.

## 환경/제약
- Node v20.19.5 (일부 패키지가 node>=22 권장하지만 경고 수준). Nuxt 4.4.8 / @nuxt/ui 4.9.0 / supabase-js 2.109.0 / xlsx 0.18.5.
- dolbomdari-admin은 git 저장소가 아님 → 커밋 단계 생략(사용자가 원하면 init).
- service_role 키와 관리자 이메일은 사용자가 .env에 직접 채워야 동작.

## 구현 중 조정된 사항
- **삭제 라우트**: 복합키(bookmarks, job_views) 지원을 위해 `[id].delete` 대신 `index.delete.ts`(PK 컬럼값을 쿼리 파라미터로 받음)로 구현. get/put은 단일 id crud 테이블만 `[id]` 라우트로 처리.
- **생성 제한**: `users`/`organization_manager`는 id가 auth.users FK라 신규 생성 불가(canCreate=false, 수정/삭제만). `jobs`는 text PK라 생성 시 미입력이면 서버에서 randomUUID로 자동 부여.
- **SPA(ssr:false)**: 세션/localStorage 처리 단순화. 서버 API(Nitro)는 정상 동작.
- **컬러 모드**: 레이아웃이 라이트 기준이라 `colorMode.preference='light'`로 고정. (색상 모드 저장값이 있으면 재방문 시 그 값 우선 — 최초 1회 반영됨)
- **목록 컬럼**: 레지스트리 listColumns 우선, 없으면(로그 테이블) 조회 결과의 키로 동적 렌더링.

## Node 20 WebSocket 이슈 (중요)
- `@supabase/supabase-js`의 `createClient`는 Node 20에서 전역 WebSocket이 없어 즉시 throw("Node.js 20 detected without native WebSocket support"). 서버(Nitro) API가 전부 깨짐.
- 해결: `server/plugins/websocket-polyfill.ts`에서 `ws`로 `globalThis.WebSocket` 폴리필. `ws`를 명시적 의존성으로 추가. (Node 22+로 올리면 폴리필 불필요.)

## 검증 결과 (2026-07-12) — 전체 통과
- `npm run build` 성공. 라우트 `/api/admin/:table`, `/api/admin/:table/:id` 정상.
- 관리자 계정은 service_role admin API로 비밀번호 설정 + email_confirm 처리(자격증명은 별도 보관, 저장소에 기록하지 않음). Supabase 비번 정책 최소 6자.
- **주의**: `.env` 변경 후에는 dev 서버를 재시작해야 runtimeConfig에 반영됨(런타임에 키 빈 값이면 500).
- end-to-end(헤드리스 + 브라우저): 로그인 성공, 토큰 없음 401, 잘못된 테이블 404, `users`/`jobs` 목록 200(실데이터), 대시보드 집계, 공고 목록 UI·페이지네이션·검색·엑셀/생성 버튼 렌더링 확인.
- 엑셀 다운로드는 파일 저장이라 브라우저 하니스에서 클릭 검증은 생략(데이터 경로 all=true는 검증됨).

## 추가 요구사항 반영 (2026-07-12)
- **브랜드 컬러 #0370FF**: `app/assets/css/main.css`에 `@theme`로 brand 팔레트 정의, `app/app.config.ts`에서 `ui.colors.primary='brand'`. 검증: 버튼 배경 `rgb(3,112,255)` 확인.
- **상세 보기**: 목록 각 행 클릭(또는 '상세' 버튼) → `USlideover`로 전체 컬럼 read-only 표시 + 수정/삭제 액션. crud/log 모두, 복합키도 지원(라우팅 불필요).
- **공고 출처 탭**: 전체 / 사용자 생성(source=manual) / 자동 생성(source≠manual). 서버 목록 API의 컬럼 필터(f/op/v) 사용. 탭별 건수 필터링 동작 확인.
- **난수 id → 넘버링**: 목록에서 `id` 컬럼 제외, 좌측에 `No.`((page-1)*pageSize+i+1) 표시. 상세/수정/삭제는 실제 id 사용. 엑셀은 데이터 보존 위해 id 포함 전체 컬럼 유지.
- **정렬**: 컬럼 헤더 클릭 → asc/desc 토글(▲/▼), 서버 `sort`/`dir` 파라미터. 컬럼명은 `^[a-z_][a-z0-9_]*$` 정규식으로 검증(로그 테이블도 지원).
- 참고: 프리뷰 스크린샷 서비스가 반복 타임아웃되어 DOM 조회(preview_eval)로 기능 검증함(색상/넘버링/탭 필터/정렬/슬라이드오버 모두 통과).
