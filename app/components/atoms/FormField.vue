<!-- 원자: 폼 필드 래퍼 — 라벨/필수표시/힌트/에러 -->
<script setup lang="ts">
defineProps<{ label?: string; required?: boolean; hint?: string; error?: string }>()
</script>

<template>
  <div class="space-y-1.5">
    <label v-if="label" class="block text-sm font-medium text-slate-700">
      {{ label }}
      <span v-if="required" class="text-brand-500">*</span>
    </label>
    <slot />
    <p v-if="error" class="text-xs text-brand-500">{{ error }}</p>
    <p v-else-if="hint" class="text-xs text-slate-400">{{ hint }}</p>
  </div>
</template>
