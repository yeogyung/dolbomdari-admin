<!-- 원자: 여러 줄 텍스트 입력 -->
<script setup lang="ts">
withDefaults(defineProps<{ placeholder?: string; rows?: number; disabled?: boolean }>(), { rows: 4 })
/** FormField 안에 있으면 라벨과 이어질 id */
const fieldId = inject<string | undefined>('form-field-id', undefined)
const model = defineModel<string | null>()
</script>

<template>
  <textarea
    :id="fieldId"
    v-model="model"
    :rows="rows"
    :placeholder="placeholder"
    :disabled="disabled"
    class="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none transition-colors placeholder:text-slate-400 focus:border-brand-500 focus:ring-2 focus:ring-brand-100 disabled:bg-slate-50"
  />
</template>
