<!-- 원자: 알약형 검색 입력 (목록 툴바용, h44) -->
<script setup lang="ts">
withDefaults(defineProps<{ placeholder?: string; width?: string }>(), {
  placeholder: '검색',
  width: 'max-w-[360px]',
})
const emit = defineEmits<{ search: [] }>()
const model = defineModel<string>()
</script>

<template>
  <div class="relative flex-1" :class="width">
    <UIcon name="i-lucide-search" class="pointer-events-none absolute top-1/2 left-[18px] size-[18px] -translate-y-1/2 text-muted" />
    <input
      v-model="model"
      :placeholder="placeholder"
      class="h-11 w-full rounded-full border border-hairline bg-white pr-4 pl-12 text-[15px] text-ink outline-none transition-colors placeholder:text-muted focus:border-brand-500"
      @keyup.enter="emit('search')"
    />
  </div>
</template>
