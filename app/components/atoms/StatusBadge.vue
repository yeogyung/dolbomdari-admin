<!-- 원자: 상태 배지 — 알약형, 디자인 시맨틱 톤 -->
<script setup lang="ts">
type Tone = 'green' | 'red' | 'amber' | 'blue' | 'gray'

withDefaults(defineProps<{ tone?: Tone }>(), { tone: 'gray' })

// 디자인 규칙: 재직=green(up), 미출근=red(down), 연결됨=blue(brand), 대기/종료/미연결=gray
const toneCls: Record<Tone, string> = {
  green: 'bg-up-soft text-up',
  red: 'bg-down-soft text-down',
  amber: 'bg-[#fdf6e3] text-accent',
  blue: 'bg-brand-soft text-brand-500',
  gray: 'bg-surface-strong text-muted',
}
</script>

<template>
  <span
    class="inline-flex items-center rounded-full px-2.5 py-1.5 text-xs leading-none font-semibold whitespace-nowrap"
    :class="toneCls[tone]"
  >
    <slot />
  </span>
</template>
