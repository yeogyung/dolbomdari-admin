// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  compatibilityDate: '2025-07-15',
  devtools: { enabled: true },
  // 내부 어드민 도구 — SPA 모드로 세션(localStorage) 처리를 단순화 (서버 API는 Nitro로 계속 동작)
  ssr: false,
  modules: ['@nuxt/ui'],
  css: ['~/assets/css/main.css'],
  // 아토믹 3단계 구조 — 폴더 프리픽스 없이 컴포넌트명 그대로 사용 (<AppButton> 등)
  components: [{ path: '~/components', pathPrefix: false }],
  // 라이트 모드 고정 (레이아웃이 라이트 기준)
  colorMode: { preference: 'light', fallback: 'light' },
  runtimeConfig: {
    // 서버 전용 (브라우저 노출 금지) — NUXT_ 접두어 환경변수로 주입
    supabaseServiceRoleKey: '',
    solapiApiKey: '',
    solapiApiSecret: '',
    solapiSender: '',
    public: {
      supabaseUrl: '',
      supabaseAnonKey: '',
      linkBaseUrl: 'https://link.carebridges.kr',
    },
  },
})
