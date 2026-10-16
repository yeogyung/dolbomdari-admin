# 어드민 개선 목록 (2026-10-16 점검)

점검 결과를 우선순위별로 모은 작업 목록이다. 처리하면 체크하고, 결정 이유는 `context-notes.md` Phase 18 에 남긴다.

## 1순위 — 보안

- [x] 이력서·공고 추천 라우트 6곳 master 전용으로 막기 (`requireMaster`)
  - `resume-pdf/[resumeId].get`, `resume-links/index.get·post`, `resume-links/[token].delete`, `resume-links/[token]/sms.post`, `actions/recommend-job.post`
  - 지금은 `requireAdmin` 만 불러 기관(org)·수요처(worksite) 계정도 통과한다

## 2순위 — 데이터가 조용히 틀리게 보이는 곳

- [x] 구인구직 엑셀 1000행 잘림 — `[table]/index.get.ts` export 를 1000행씩 이어 받기
- [x] 대시보드 지표 오류를 0 으로 삼킴 — `stats/summary.get.ts` 오류를 500 으로 올려 캐시에 남지 않게
- [x] 출퇴근 근무지 필터 100곳 제한 — `attendance/index.vue` 를 `listAllWorksites` 로
- [x] 근무지 화면 담당자·수요처 계정 목록 100명 제한 — `worksites/index.vue`
- [x] 하단 기록 표가 오류·권한 없음을 「0건 / 기록 없음」으로 표시 — `*Relations.vue` 에 오류 표시
- [x] 하단 기록 표 100건만 보이는데 건수는 전체 — 「최근 100건」 안내
- [x] `/me` 한 번 실패로 로그아웃 — 401/403 일 때만 로그아웃, 네트워크 오류는 유지
- [x] 필터를 빠르게 바꾸면 이전 응답이 덮어씀 — 목록 화면 요청 순번 가드

## 3순위 — 표기와 일관성

- [x] UTC 원문 시각 — 구인구직 목록·수정 폼·엑셀, `JobRelations`, `ResumeSharePanel`
- [x] 공고 상세 기록 표 난수 id — `JobRelations` 를 `RelationTable` + 이름 표시로
- [x] 조회 조건 URL 유지 — 구인구직 목록, 출퇴근, 채팅
- [x] 기존 `useListQuery` 화면(근무지·명부·문서·공지, FAQ 는 즉시 필터라 제외)도 조회를 `committedOf` 로 — 치다 만 검색어로 페이지를 넘기면 주소와 목록이 어긋난다
- [x] 계정·사업·FAQ 페이지 번호 무반응
- [x] 계정·사업 수정 모달에서 상태 「종료」 변경이 확인 없이 진행
- [x] `FormField` 오류 문구 파랑(`text-brand-500`) → 빨강
- [ ] 조회 실패 표시·확인 방식(`confirm()` vs 모달)·검색 방식 통일 — 범위가 커서 따로 논의

## 4순위 — 접근성

- [x] `Checkbox` 키보드 선택
- [x] `DataTable` 페이지·정렬 버튼 스크린리더 라벨
- [x] `AppModal` dialog 역할·포커스 관리
- [x] `FormField` 라벨과 입력칸 연결

## 코드 밖 — 사용자 확인 필요

- [ ] 배포: 월간 리포트 서버(`feat/admin-monthly-report`), 담당자 범위 마이그레이션·서버
- [ ] 브라우저 확인: Phase 11~17 화면
- [ ] 운영 데이터: 햇살요양원 담당자 칸의 수요처 계정 정리
