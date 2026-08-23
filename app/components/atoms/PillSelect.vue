<!-- 원자: 알약형 셀렉트 (목록 툴바 필터용, h44) -->
<script setup lang="ts">
type Option = string | { label: string; value: string | number }
const props = defineProps<{ options: Option[] }>()
const model = defineModel<string | number | null>()
const normalized = computed(() =>
  props.options.map((o) => (typeof o === 'string' ? { label: o, value: o } : o)),
)
</script>

<template>
  <div class="relative">
    <select
      v-model="model"
      class="h-11 appearance-none rounded-full border border-hairline bg-white pr-9 pl-4 text-[15px] font-medium text-ink outline-none transition-colors focus:border-brand-500"
    >
      <option v-for="o in normalized" :key="String(o.value)" :value="o.value">{{ o.label }}</option>
    </select>
    <UIcon name="i-lucide-chevron-down" class="pointer-events-none absolute top-1/2 right-3 size-4 -translate-y-1/2 text-muted" />
  </div>
</template>
