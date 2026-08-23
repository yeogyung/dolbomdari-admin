<!-- 원자: 검색 입력 — 좌측 아이콘 + 엔터 이벤트 -->
<script setup lang="ts">
withDefaults(defineProps<{ placeholder?: string }>(), { placeholder: '검색' })
const emit = defineEmits<{ search: [] }>()
const model = defineModel<string>()
</script>

<template>
  <div class="relative w-64 max-w-full">
    <UIcon
      name="i-lucide-search"
      class="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-slate-400"
    />
    <input
      v-model="model"
      :placeholder="placeholder"
      class="h-9 w-full rounded-lg border border-slate-300 bg-white pr-3 pl-9 text-sm text-slate-900 outline-none transition-colors placeholder:text-slate-400 focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
      @keyup.enter="emit('search')"
    />
  </div>
</template>
