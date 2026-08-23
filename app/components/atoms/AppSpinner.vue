<!-- 원자: 로딩 스피너 + 선택적 라벨 -->
<script setup lang="ts">
withDefaults(defineProps<{ label?: string; size?: 'sm' | 'md' }>(), { size: 'md' })
</script>

<template>
  <div class="flex items-center justify-center gap-2 py-8 text-slate-400">
    <UIcon name="i-lucide-loader-circle" class="animate-spin" :class="size === 'sm' ? 'size-4' : 'size-5'" />
    <span v-if="label" class="text-sm">{{ label }}</span>
  </div>
</template>
