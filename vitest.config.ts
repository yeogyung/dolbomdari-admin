// 순수 유틸 테스트용 vitest 설정 — 컴포넌트는 테스트하지 않는다
import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    include: ['test/**/*.test.ts'],
  },
})
