<!-- 원자: 아이콘 전용 버튼 -->
<script setup lang="ts">
withDefaults(
  defineProps<{ icon: string; label?: string; disabled?: boolean; tone?: 'neutral' | 'danger' }>(),
  { tone: 'neutral' },
)
</script>

<template>
  <button
    type="button"
    :disabled="disabled"
    :aria-label="label"
    :title="label"
    class="inline-flex size-8 items-center justify-center rounded-lg transition-colors disabled:opacity-40"
    :class="tone === 'danger' ? 'text-brand-500 hover:bg-brand-50' : 'text-slate-500 hover:bg-slate-100'"
  >
    <UIcon :name="icon" class="size-4" />
  </button>
</template>
