<!-- 원자: 빈 상태 안내 -->
<script setup lang="ts">
withDefaults(defineProps<{ icon?: string; title?: string; description?: string }>(), {
  icon: 'i-lucide-inbox',
  title: '데이터가 없습니다.',
})
</script>

<template>
  <div class="flex flex-col items-center justify-center gap-2 py-12 text-center">
    <UIcon :name="icon" class="size-8 text-slate-300" />
    <p class="text-sm font-medium text-slate-500">{{ title }}</p>
    <p v-if="description" class="text-xs text-slate-400">{{ description }}</p>
    <div v-if="$slots.action" class="mt-2">
      <slot name="action" />
    </div>
  </div>
</template>
