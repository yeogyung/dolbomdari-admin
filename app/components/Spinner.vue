<!-- 로딩 스피너 — 회전 아이콘 + 선택적 라벨 -->
<script setup lang="ts">
defineProps<{ label?: string }>()
</script>

<template>
  <div class="flex items-center justify-center gap-2 py-10 text-gray-400">
    <UIcon name="i-heroicons-arrow-path" class="size-5 animate-spin" />
    <span v-if="label" class="text-sm">{{ label }}</span>
  </div>
</template>
