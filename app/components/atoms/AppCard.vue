<!-- 원자: 카드 — 24px 라운드 + 헤어라인 + 소프트 섀도 -->
<script setup lang="ts">
withDefaults(defineProps<{ padding?: 'none' | 'sm' | 'md' | 'lg' }>(), { padding: 'md' })
</script>

<template>
  <div class="rounded-[24px] border border-hairline bg-white shadow-[0_4px_12px_rgba(0,0,0,0.04)]">
    <div v-if="$slots.header" class="flex items-center justify-between border-b border-hairline-soft px-6 py-4">
      <slot name="header" />
    </div>
    <div
      :class="{
        'p-8': padding === 'lg',
        'p-6': padding === 'md',
        'p-4': padding === 'sm',
        '': padding === 'none',
      }"
    >
      <slot />
    </div>
  </div>
</template>
