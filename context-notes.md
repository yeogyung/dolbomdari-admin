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
