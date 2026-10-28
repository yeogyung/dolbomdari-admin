// 순수 유틸 테스트용 vitest 설정 — 컴포넌트는 테스트하지 않는다
import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  // Nuxt 가 앱 코드에 거는 #shared 별칭 — 앱 유틸을 그대로 불러 테스트하려고
  resolve: { alias: { '#shared': fileURLToPath(new URL('./shared', import.meta.url)) } },
  test: {
    include: ['test/**/*.test.ts'],
  },
})
