<!-- 유기체: KPI 카드 — 라벨 + 큰 수치 (시안 W1 대시보드 기준) -->
<script setup lang="ts">
withDefaults(
  defineProps<{ label: string; value: string | number; tone?: 'ink' | 'up' | 'down' | 'primary' }>(),
  { tone: 'ink' },
)
const toneCls = {
  ink: 'text-ink',
  up: 'text-up',
  down: 'text-down',
  primary: 'text-brand-500',
}
</script>

<template>
  <div class="flex flex-col gap-2.5 rounded-[24px] border border-hairline bg-white p-6">
    <span class="text-sm font-medium text-muted">{{ label }}</span>
    <span class="text-[36px] leading-none font-medium tabular-nums" :class="toneCls[tone]">{{ value }}</span>
  </div>
</template>
