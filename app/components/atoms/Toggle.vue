<!-- 원자: 토글 스위치 -->
<script setup lang="ts">
defineProps<{ disabled?: boolean }>()
const model = defineModel<boolean>()
</script>

<template>
  <button
    type="button"
    role="switch"
    :aria-checked="!!model"
    :disabled="disabled"
    class="relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors disabled:opacity-50"
    :class="model ? 'bg-brand-500' : 'bg-slate-300'"
    @click="model = !model"
  >
    <span
      class="inline-block size-5 rounded-full bg-white shadow transition-transform"
      :class="model ? 'translate-x-5' : 'translate-x-0.5'"
    />
  </button>
</template>
