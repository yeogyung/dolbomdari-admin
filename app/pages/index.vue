<!-- 대시보드 — 테이블별 총 건수 카드 -->
<script setup lang="ts">
import { TABLE_LIST } from '#shared/tables'

const api = useAdminApi()
const counts = ref<Record<string, number | null>>({})
const loading = ref(true)

const tables = TABLE_LIST.filter((t) => !t.hideInNav)

onMounted(async () => {
  await Promise.all(
    tables.map(async (t) => {
      try {
        const res = await api.list(t.name, { page: 1, pageSize: 1 })
        counts.value[t.name] = res.total
      } catch {
        counts.value[t.name] = null
      }
    }),
  )
  loading.value = false
})
</script>

<template>
  <div>
    <h1 class="mb-4 text-xl font-bold">대시보드</h1>
    <div class="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4">
      <NuxtLink v-for="t in tables" :key="t.name" :to="`/${t.name}`">
        <UCard class="transition hover:shadow-md">
          <div class="text-sm text-gray-500">{{ t.label }}</div>
          <div class="mt-1 text-2xl font-bold">
            <UIcon v-if="loading" name="i-heroicons-arrow-path" class="size-5 animate-spin text-gray-300" />
            <span v-else-if="counts[t.name] === null" class="text-red-400">오류</span>
            <span v-else>{{ counts[t.name]?.toLocaleString() }}</span>
          </div>
        </UCard>
      </NuxtLink>
    </div>
  </div>
</template>
