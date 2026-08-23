<!-- 원자: 체크박스 + 선택적 라벨 -->
<script setup lang="ts">
defineProps<{ label?: string; disabled?: boolean }>()
const model = defineModel<boolean>()
</script>

<template>
  <label class="inline-flex cursor-pointer items-center gap-2 select-none" :class="{ 'opacity-50': disabled }">
    <span
      class="flex size-5 items-center justify-center rounded-md border transition-colors"
      :class="model ? 'border-brand-500 bg-brand-500' : 'border-slate-300 bg-white'"
      @click="!disabled && (model = !model)"
    >
      <UIcon v-if="model" name="i-lucide-check" class="size-3.5 text-white" />
    </span>
    <span v-if="label" class="text-sm text-slate-700">{{ label }}</span>
  </label>
</template>
