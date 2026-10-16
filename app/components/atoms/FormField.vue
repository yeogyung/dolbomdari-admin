<!-- 원자: 폼 필드 래퍼 — 라벨/필수표시/힌트/에러 -->
<script setup lang="ts">
import { provide, useId } from 'vue'

defineProps<{ label?: string; required?: boolean; hint?: string; error?: string }>()
// 라벨과 입력칸을 잇는다 — 안의 입력 원자(TextField 등)가 이 id 를 받아 쓴다. 라벨을 누르면 입력칸에 포커스가 가고 스크린리더가 이름을 읽는다
const fieldId = useId()
provide('form-field-id', fieldId)
</script>

<template>
  <div class="space-y-1.5">
    <label v-if="label" :for="fieldId" class="block text-sm font-medium text-slate-700">
      {{ label }}
      <span v-if="required" class="text-brand-500">*</span>
    </label>
    <slot />
    <p v-if="error" class="text-xs text-down">{{ error }}</p>
    <p v-else-if="hint" class="text-xs text-slate-400">{{ hint }}</p>
  </div>
</template>
