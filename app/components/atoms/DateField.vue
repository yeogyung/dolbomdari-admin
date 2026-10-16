<!-- 원자: 날짜 입력 -->
<script setup lang="ts">
withDefaults(defineProps<{ type?: 'date' | 'time' | 'datetime-local'; disabled?: boolean }>(), {
  type: 'date',
})
/** FormField 안에 있으면 라벨과 이어질 id */
const fieldId = inject<string | undefined>('form-field-id', undefined)
const model = defineModel<string | null>()
</script>

<template>
  <input
    :id="fieldId"
    v-model="model"
    :type="type"
    :disabled="disabled"
    class="h-10 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-900 outline-none transition-colors focus:border-brand-500 focus:ring-2 focus:ring-brand-100 disabled:bg-slate-50"
  />
</template>
