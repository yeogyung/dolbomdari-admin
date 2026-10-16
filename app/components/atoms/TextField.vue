<!-- 원자: 텍스트 입력 -->
<script setup lang="ts">
withDefaults(
  defineProps<{
    type?: string
    placeholder?: string
    disabled?: boolean
    readonly?: boolean
  }>(),
  { type: 'text' },
)
/** FormField 안에 있으면 라벨과 이어질 id */
const fieldId = inject<string | undefined>('form-field-id', undefined)
const model = defineModel<string | number | null>()
</script>

<template>
  <input
    :id="fieldId"
    v-model="model"
    :type="type"
    :placeholder="placeholder"
    :disabled="disabled"
    :readonly="readonly"
    class="h-10 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-900 outline-none transition-colors placeholder:text-slate-400 focus:border-brand-500 focus:ring-2 focus:ring-brand-100 disabled:bg-slate-50 disabled:text-slate-400 read-only:bg-slate-50"
  />
</template>
