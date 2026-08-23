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
