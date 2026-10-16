<!-- 원자: 체크박스 + 선택적 라벨 -->
<script setup lang="ts">
// 실제 input 을 숨겨 두고 그림은 그 상태를 따른다 — 키보드(Tab·Space)와 스크린리더가 쓸 수 있게
// tabindex=-1 은 표시 전용(행 전체가 고르는 표)일 때 — 탭 순서에서 뺀다
defineProps<{ label?: string; disabled?: boolean; ariaLabel?: string; tabindex?: number | string }>()
const model = defineModel<boolean>()
</script>

<template>
  <label class="inline-flex cursor-pointer items-center gap-2 select-none" :class="{ 'opacity-50': disabled }">
    <input
      v-model="model"
      type="checkbox"
      class="peer sr-only"
      :disabled="disabled"
      :tabindex="tabindex"
      :aria-label="label ? undefined : ariaLabel"
    />
    <span
      class="flex size-5 items-center justify-center rounded-md border transition-colors peer-focus-visible:ring-2 peer-focus-visible:ring-brand-300"
      :class="model ? 'border-brand-500 bg-brand-500' : 'border-slate-300 bg-white'"
      aria-hidden="true"
    >
      <UIcon v-if="model" name="i-lucide-check" class="size-3.5 text-white" />
    </span>
    <span v-if="label" class="text-sm text-slate-700">{{ label }}</span>
  </label>
</template>
