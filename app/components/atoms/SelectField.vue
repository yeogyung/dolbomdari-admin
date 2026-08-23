<!-- 원자: 셀렉트 — options는 문자열 배열 또는 {label,value} -->
<script setup lang="ts">
type Option = string | { label: string; value: string | number }
const props = withDefaults(
  defineProps<{ options: Option[]; placeholder?: string; disabled?: boolean }>(),
  { placeholder: '선택' },
)
const model = defineModel<string | number | null>()

const normalized = computed(() =>
  props.options.map((o) => (typeof o === 'string' ? { label: o, value: o } : o)),
)
</script>

<template>
  <div class="relative">
    <select
      v-model="model"
      :disabled="disabled"
      class="h-10 w-full appearance-none rounded-lg border border-slate-300 bg-white pr-9 pl-3 text-sm text-slate-900 outline-none transition-colors focus:border-brand-500 focus:ring-2 focus:ring-brand-100 disabled:bg-slate-50"
    >
      <option :value="null" disabled>{{ placeholder }}</option>
      <option v-for="o in normalized" :key="String(o.value)" :value="o.value">{{ o.label }}</option>
    </select>
    <UIcon
      name="i-lucide-chevron-down"
      class="pointer-events-none absolute top-1/2 right-3 size-4 -translate-y-1/2 text-slate-400"
    />
  </div>
</template>
