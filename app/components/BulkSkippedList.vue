<!-- 일괄 처리에서 빼는 것 — 고른 것 가운데 처리하지 않을 것과 그 까닭(오늘 기록이 아님·시니어가 아님 등) -->
<script setup lang="ts">
withDefaults(
  defineProps<{
    items: { name: string; reason: string }[]
    unit?: string
  }>(),
  { unit: '건' },
)
</script>

<template>
  <details v-if="items.length" class="rounded-lg border border-hairline px-4 py-3 text-sm">
    <summary class="cursor-pointer font-medium text-body">
      빼고 처리하는 {{ items.length }}{{ unit }} 보기
    </summary>
    <ul class="mt-2 max-h-48 list-disc space-y-0.5 overflow-y-auto pl-5 text-muted">
      <li v-for="(s, i) in items" :key="i">{{ s.name }} — {{ s.reason }}</li>
    </ul>
  </details>
</template>
