# 어드민 웹 구축 체크리스트

## 설정
- [x] @nuxt/ui, @supabase/supabase-js, xlsx 설치
- [x] nuxt.config.ts (모듈, runtimeConfig, ssr:false, colorMode)
- [x] .env / .env.example
- [x] app/assets/css/main.css (tailwind + nuxt ui)
- [x] app.vue (UApp 래퍼)

## 데이터 정의
- [x] shared/tables.ts 테이블 레지스트리 (10개 테이블)

## 서버 계층
- [x] server/utils/admin.ts (serviceClient, requireAdmin, assertTable, sanitizePayload)
- [x] server/api/admin/[table]/index.get.ts (목록 + 페이지네이션 + 검색 + all)
- [x] server/api/admin/[table]/index.post.ts (생성)
- [x] server/api/admin/[table]/[id].get.ts (단건)
- [x] server/api/admin/[table]/[id].put.ts (수정)
- [x] server/api/admin/[table]/index.delete.ts (삭제 — 복합키 지원)

## 클라이언트 계층
- [x] app/composables/useSupabase.ts (anon 클라이언트)
- [x] app/composables/useAdminApi.ts (토큰 첨부 $fetch)
- [x] app/utils/excel.ts (SheetJS .xlsx)
- [x] app/middleware/auth.global.ts

## 페이지
- [x] app/layouts/default.vue (사이드바 + 헤더)
- [x] app/components/RecordForm.vue (공용 폼)
- [x] app/pages/login.vue
- [x] app/pages/index.vue (대시보드)
- [x] app/pages/[table]/index.vue (목록)
- [x] app/pages/[table]/new.vue (생성)
- [x] app/pages/[table]/[id].vue (수정/삭제)

## 검증
- [x] npm run build 성공, 빌드 에러 없음
- [x] dev 서버 기동, 로그인 페이지 렌더링(라이트 모드)
- [x] 미인증 API 접근 → 401 확인
- [ ] (사용자 키 필요) 로그인 → 목록 → 페이지네이션 → 엑셀 → CRUD 라운드트립
- [ ] (사용자 키 필요) 비관리자 이메일 로그인 시 403 확인

## 사용자 후속 작업
- [ ] .env 에 NUXT_SUPABASE_SERVICE_ROLE_KEY 채우기 (Supabase 대시보드 > Settings > API)
- [ ] .env 에 NUXT_ADMIN_EMAILS 채우기 (관리자 이메일)
- [ ] Supabase Auth 에 관리자 이메일/비밀번호 계정 생성
