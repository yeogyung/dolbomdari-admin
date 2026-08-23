<!-- 원자: 날짜 입력 -->
<script setup lang="ts">
withDefaults(defineProps<{ type?: 'date' | 'time' | 'datetime-local'; disabled?: boolean }>(), {
  type: 'date',
})
const model = defineModel<string | null>()
</script>

<template>
  <input
    v-model="model"
    :type="type"
    :disabled="disabled"
    class="h-10 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-900 outline-none transition-colors focus:border-brand-500 focus:ring-2 focus:ring-brand-100 disabled:bg-slate-50"
  />
</template>
