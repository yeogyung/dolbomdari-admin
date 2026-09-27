# 통합 어드민 개편 — 컨텍스트 노트

작업 중 내린 결정과 근거를 계속 append 한다.

## 배경
- 앱 2개(공고추천=프리픽스 없는 테이블 / 채팅·시니어=dbo_* 테이블)의 어드민을 하나로 통합.
- 받은 HTML 디자인(시니어 출퇴근 관리)이 통합 어드민의 디자인 기준.
- 공고추천 기존 페이지는 재스킨, HTML 디자인 화면은 신규(목 데이터 우선).

## 결정 사항
- **브랜드 색**: blue `#0370ff` (디자인 시안 실측 — 로고 샘플). red `#cf202f`(하락)·green `#05b169`(상승)은 시맨틱(텍스트 전용, fill 금지). ⚠️ 최초에 red를 브랜드로 오인 → 교정함. 기존 어드민 블루가 원래 맞았음.
- **디자인 시안 실측**: canvas 익스포트의 `__bundler/template`을 추출해 실제 DOM/토큰 확인(scratchpad/design/template.html). 전체가 CSS 변수 기반: pill(radius 100px) 버튼·필터, 24px 카드, `#f7f7f7` 콘텐츠 배경, 232px 사이드바(active=brand-soft `#eaf2ff`), lucide 아이콘, Inter+Noto Sans KR. 화면: W1 대시보드/W2 시니어목록/W3 상세/W4 출퇴근/W5 공지/W6~9 부가/M 모바일.
- **컴포넌트 스택**: 커스텀 Tailwind 우선(아토믹 3단계). 모달/페이지네이션 등 복잡 위젯만 @nuxt/ui 내부 활용.
- **폰트**: Google Fonts CDN(@import)으로 Inter + Noto Sans KR. 새 의존성 설치 회피(offline 제약 없는 일반 웹앱).
- **컴포넌트 auto-import**: `components: [{ path:'~/components', pathPrefix:false }]` → 폴더명이 이름에 안 붙음. 이름 충돌 방지 위해 접두사 `App*`/명확한 이름 사용.
- **신규 화면 라우트**: `/senior/*`. 사이드바 앱 스위처로 컨텍스트 전환.
- **데이터**: dbo_* 14개 테이블 live 존재하나 0행. 출퇴근 테이블 없음 → 신규 화면 목 데이터. 목 구조는 dbo 스키마 컬럼명에 최대한 맞춰 후속 연동 용이하게.

## dbo 스키마 요약 (근거: dolbomdari-server .../20260807000000_dbo_v2_init.sql)
- dbo_directory(phone,name,role[senior/manager/worksite/master])
- dbo_profiles(id=auth.uid, directory_id, phone, name, role, font_scale, avatar_path)
- dbo_worksites(id, name)  ← 주소/QR/담당자 없음(디자인이 앞섬)
- dbo_assignments(directory_id, worksite_id, start_time, end_time, manager_profile_id, period_start/end)
- dbo_rooms(title, kind[group/direct], ai_enabled, created_by) / dbo_room_members(room_id, profile_id, last_read_at) / dbo_messages(room_id, sender_type[user/ai], sender_id, body, sources jsonb, answered) / dbo_attachments
- dbo_documents(filename, kind, version, status, effective_date, expiry_date, body) / dbo_faqs(question, answer, enabled, sort) / dbo_unanswered_questions

## 미해결/후속
- 출퇴근(attendance) 스키마 신설 필요(후속). 근무지 주소·QR·수요처담당자 컬럼 확장 필요.
- role 4단계(schema) vs 2단계(design) 정책 조정 필요.
- vue-tsc 미설치 → 타입 검증은 dev 빌드 또는 별도 설치.

## 2026-09-03 — 시니어 어드민을 목데이터에서 실 API로 전환

### 호출 경로: Nitro 프록시 없이 브라우저 → Edge Function 직접
- `dbo-admin`은 `access-control-allow-origin: *`와 `authorization, apikey` 허용 헤더를
  응답한다(OPTIONS 확인). 그래서 프록시 라우트를 새로 만들지 않고 브라우저에서 바로 부른다.
- 기본 URL은 `runtimeConfig.public.supabaseUrl + '/functions/v1/dbo-admin'`로 조립한다.
  이 어드민의 Supabase 프로젝트(`qxihbjhjiqhlqegjzvpo`)가 운영센터와 같은 프로젝트라
  새 환경변수가 필요 없다.
- 인증은 로그인 세션의 access token + anon key. 기존 `useAdminApi`(공고추천용 자체 서버 API,
  service_role)와는 완전히 별도 경로다. 두 계열을 섞지 않는다.

### 권한 경계 (명세 description에서 확인)
- `master`: 전체. `worksite`: 담당 근무지의 출결·배정·근무지 읽기만.
- 쓰기(명부·근무지·배정·사업·계정·출결 수정)는 전부 master 전용이다.
- 화면은 역할로 버튼을 숨기지 않는다 — `/dbo-admin`에 "내 역할" 엔드포인트가 없어서
  추측 대신 403 응답을 한국어 토스트로 보여 주는 쪽을 택했다. 역할 조회 API가 생기면
  버튼 가시성을 그때 붙인다.

### 남은 계약 공백
- **출결 상태 코드**: 서버가 `status`를 자유 문자열로 열어 두었고(명세: "향후 업무 상태
  확장을 위해 문자열") 어디에도 어휘가 없다. 화면은 `checked_in/checked_out/late/absent`를
  쓰고, 응답에 모르는 코드가 오면 배지·선택지에 그 값을 그대로 노출한다. 앱의 QR 출퇴근이
  쓰는 실제 코드와 맞는지 백엔드 확인이 필요하다. 대리 기록은 `method: 'manual'`로 남긴다.
- **배정의 `managerProfileId`**: profile id를 주는 목록 API가 없어서(계정 목록의 `id`는
  directory 기준) 폼에서 뺐다. 필요해지면 profiles 조회 경로가 먼저 필요하다.
- **배정 수정 범위**: PATCH가 `directoryId`·`worksiteId`를 받지 않는다. 근무지를 바꾸려면
  삭제 후 재등록이라고 폼에서 안내한다.
- **역할 필터**: 명부 목록에 `role` 쿼리가 없다. 시니어/담당자 구분은 컬럼 표시만 하고,
  근무지 담당자 셀렉트는 첫 100건을 받아 클라이언트에서 `role === 'manager'`로 좁힌다.
  명부가 100명을 넘으면 서버 필터가 필요하다.
- **목록 상한**: 모든 목록이 `size` 최대 100이다. 출결 엑셀과 대시보드 오늘 집계는
  100건씩 페이지를 순회해 전량을 모은다.
- **정렬 방향**: 목록 API가 `sort`만 받고 방향 파라미터가 없다. 테이블 헤더는 컬럼 전환만
  하고 화살표는 오름차순 고정으로 보인다.

### 기타
- 전화번호 수정은 앱 연결이 끊기므로 필드 경고 + confirm 2중으로 막는다(명세 요구).
- QR은 토큰 문자열 열람·복사·재발급만 제공한다. QR 이미지 렌더링 라이브러리는 새로
  설치하지 않았다.
- 기존 `AppButton`은 `to` prop을 받지 않는다(`<button>`에 attr로 흘러 이동이 안 된다).
  `app/pages/[table]/index.vue`의 "새로 만들기"가 그 상태다 — 이번 변경 범위가 아니라
  손대지 않았고, 신규 화면은 `@click="navigateTo(...)"`나 `NuxtLink`를 쓴다.

### 출결 조인 모양 (2026-09-17)
- **`attendance` 는 배열이 아니라 객체다.** 출퇴근 기록이 어드민에 안 보인다는 신고를 받아
  운영 DB 를 실측했다. QR 출근은 `dbo_attendance` 에 정상으로 들어와 있었고 `shift_id` 도
  당일 shift 에 제대로 걸려 있었다 — 끊긴 곳은 읽는 쪽이었다.
- 원인은 `dbo_attendance.shift_id` 의 unique 제약이다. PostgREST 가 이 조인을 to-one 으로
  판정해 배열이 아닌 단일 객체(없으면 `null`)를 내려 주는데, 화면은 `row.attendance?.[0]`
  으로 배열처럼 꺼내고 있었다. 그래서 상태·출근·퇴근·근무시간 칸이 전부 `—` 로 보였다.
- 타입(`AttendanceRecord[]`)이 틀려 있던 탓에 컴파일러가 이 실수를 못 잡았다. 타입을 실측대로
  고치고 꺼내는 규칙은 `attendanceOf()` 한 곳으로 모았다(`test/dbo-attendance.test.ts` 가
  실측 응답을 픽스처로 고정한다).

### 구인구직 상세 화면 디자인 통일 (2026-09-19)
- **디자인 세대가 둘이었다.** 목록 화면은 시안 디자인(AppCard·DataTable·토큰)으로 넘어왔는데
  상세·수정·생성만 Nuxt UI 날것(UCard·`text-gray-*`)으로 남아 있었다. 목록에서 상세로 들어가는
  순간 디자인 언어가 바뀌어서 "밋밋하다"는 인상의 원인이 됐다.
- `[table]` 은 동적 라우트라 파일 3개가 구인구직 테이블 16개 화면을 전부 그린다. 한 번 고치면
  전부 바뀌는 대신, 한 번 틀리면 전부 틀린다.
- **기능 무변경이 제약이었다.** `<script setup>` 은 손대지 않는 것을 원칙으로 삼고, 예외를 둘만
  허용했다 — 제목을 상단바로 올리기 위한 `setHeader` 호출(상세·수정·생성 3개)과 StatusBadge 톤
  매핑 상수 `SHARE_TONE`(ResumeSharePanel). 둘 다 추가만 했고 기존 줄은 고치지 않았다.
  근거는 커밋 전에 `<script>` 블록만 뽑아 diff 로 확인했다.
- **제목·액션을 상단바(`#admin-topbar-actions`)로 옮겼다.** 다른 화면이 전부 그렇게 하고 있어서
  상세만 본문에 제목을 두면 목록↔상세 전환에서 제목 위치가 튄다.
- `AppButton` 은 여전히 `to` prop 이 없다. 새로 쓴 곳은 `@click="navigateTo(...)"` 를 썼다.
  `[table]/index.vue` 의 「새로 만들기」 버튼은 아직 `:to` 라서 눌러도 이동하지 않는다 —
  이번 범위(디자인)가 아니라 손대지 않았다. **고칠 때 별도 커밋으로 다루자.**
- 반복되는 연관 목록 카드(Worker/Org/JobRelations)는 구조가 비슷하지만 컬럼이 제각각이라
  공용 컴포넌트로 묶지 않았다. 슬롯으로 받으면 결국 지금과 같은 모양이 된다.
- 하위 목록의 빈 상태는 `EmptyState`(py-12) 대신 한 줄짜리 문구를 썼다. 한 화면에 네다섯 개가
  쌓이면 빈 공간만 400px 넘게 생긴다.

### FAQ 승인 관리 (2026-09-27)
- **읽기는 supabase-js 직접, 쓰기는 Edge Function.** 사용자 요청으로 GET 을 웹에서 PostgREST 로
  부른다. 서버 마이그레이션 `20260925000000_dbo_knowledge_manager.sql` 이 `dbo_faqs`·
  `dbo_faq_worksites` 의 select 를 `dbo_can_manage_knowledge()`(master·manager)로 열어 두었다.
  쓰기 정책은 없다 — 서버 원칙(AGENTS §1.5)대로 승인·반려는 `PATCH /dbo-admin/faqs/{id}` 다.
- 덕분에 Edge Function 에 없던 단건 조회가 생긴다. 상세는 목록을 받아 find 하지 않고
  `.eq('id').maybeSingle()` 로 읽는다.
- **`dbo_worksites` 는 컬럼을 적어서 embed 한다.** qr_token 을 가리려고 테이블 select 를
  걷고 컬럼 단위로만 grant 했기 때문에(`20260906030000_dbo_worksite_qr_token_guard.sql`)
  `*` 로 읽으면 42501 권한 오류가 난다.
- 조회 클라이언트는 `useDboAdmin` 에 넣지 않고 `useFaqs` 로 분리했다. `useDboAdmin` 은
  Edge Function 전용 `req` 를 공유하는 파일이라 섞으면 오류 처리(`dboErrorMessage` 는 HTTP
  상태 기준, PostgREST 는 `code` 기준)가 한 파일 안에서 두 갈래가 된다.
- **승인·반려는 `status` 만 보낸다.** 승인 시 `enabled=true`, 반려 시 `enabled=false` 는 서버
  `parseFaqPatch` 가 채운다. 화면에서 enabled 를 따로 보내면 그 규칙을 덮어쓴다.
- 반려 사유는 받지 않는다(저장할 컬럼이 없다). 결정은 언제든 바꿀 수 있다 — 대기는 승인·반려,
  승인은 반려만, 반려는 승인만 보인다. 서버도 전이 제약이 없다.
- 이번 범위 밖: FAQ 생성·수정·순서 변경·enabled 수동 토글·미답변 질문 화면.

### 목록 체크박스·최대 폭·상세 2열 (2026-09-27)
- **체크박스는 기능이 없는 장식이었다.** 디자인 개편(6007301)에서 시안 W2/W4 의 체크박스 칸을
  빈 네모(`<span>`)로 옮겼고 선택·일괄 처리 로직은 붙인 적이 없다. 사용자 요청으로 prop 째 걷었다 —
  쓰는 곳이 `[table]/index.vue` 하나뿐이라 남겨 둘 이유가 없다. 일괄 처리가 생기면 그때 다시 만든다.
- **최대 폭은 셸 한 곳(`AdminShell.vue` 의 `max-w-[1200px]`)이 모든 화면에 걸고 있었다.** 테이블
  열을 최대한 보이려고 셸에서 풀었다. 그래서 시니어 화면·대시보드도 함께 넓어진다. 생성·수정 폼은
  각자 `max-w-3xl` 이 있어 그대로다.
- 상세 2열에서 긴 값(줄바꿈·JSON·60자 초과)은 두 칸을 합친다. 반 칸에 긴 설명을 넣으면 줄바꿈이
  심해져 오히려 읽기 어렵다. 2열에서는 `divide-y` 가 칸 단위로 안 그려져 칸마다 `border-b` 를 준다.

### AI(RAG) 문서 관리 (2026-09-28)
- **조회는 Edge Function GET 이다(FAQ 와 다르다).** 문서 상태(현행·발효예정·만료·미정·제외함)는
  저장값이 아니라 서버 `documentState()` 가 날짜·excluded_at 으로 계산하고, AI 검색도 같은 규칙을
  쓴다. 프론트가 규칙을 복제하면 두 곳이 어긋날 수 있어(서버 설계 §5) 서버 계산값을 그대로 받는다.
  색인 청크 수도 상세 GET 이 준다.
- **상태 필터를 두지 않는다.** 서버가 state 로 거르지 않는다(계산값이라 컬럼이 없다). 현재 페이지만
  클라이언트에서 거르면 「전체 N건」·페이지네이션과 어긋나 오해를 부른다. 필요해지면 서버에 필터를 더한다.
- **「근거에서 빼기」는 종료일을 UTC 기준 어제로 PATCH 한다.** 서버 `today()` 가
  `toISOString().slice(0,10)`(UTC)이고 만료 판정이 `expiry_date < today` 라서, 서울 기준 어제를 쓰면
  서울 00~09시에는 그 날짜가 서버의 「오늘」과 같아 현행으로 남는다. 응답 state 가 만료가 아니면 경고한다.
- 수정은 바뀐 항목만 보낸다(`buildDocumentPatch`). 종료일을 비우면 `null` 을 명시한다 — 서버가
  「안 보냄(무변경)」과 `null`(무기한으로 되돌림)을 다르게 다룬다. 본문이 바뀐 경우에만 서버가 재색인하고
  `indexed: false` 면 크론이 재시도하므로 그렇게 안내한다.
- 「제외함」(앱 F8 에서 담당자가 뺀 것)은 어드민 PATCH 로 되돌릴 수 없다. 이번 범위에서 되살리기 버튼은 없다.
