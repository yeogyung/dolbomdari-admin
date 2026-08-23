<!-- 원자: 아바타 — 이미지 또는 이름 이니셜 -->
<script setup lang="ts">
const props = withDefaults(
  defineProps<{ src?: string | null; name?: string; size?: 'sm' | 'md' | 'lg' }>(),
  { size: 'md' },
)
const sizeCls = { sm: 'size-7 text-xs', md: 'size-9 text-sm', lg: 'size-12 text-base' }
const initial = computed(() => (props.name?.trim()?.[0] ?? '?').toUpperCase())
</script>

<template>
  <img
    v-if="src"
    :src="src"
    :alt="name"
    class="rounded-full object-cover"
    :class="sizeCls[size]"
  />
  <span
    v-else
    class="inline-flex items-center justify-center rounded-full bg-brand-50 font-semibold text-brand-500"
    :class="sizeCls[size]"
  >
    {{ initial }}
  </span>
</template>
