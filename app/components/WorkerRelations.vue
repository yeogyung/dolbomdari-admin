<!-- 종사자 상세 하단 — 해당 종사자의 북마크·공고 열람·연락처 확인 기록 (user_id 필터) -->
<script setup lang="ts">
const props = defineProps<{ userId: string }>()
const api = useAdminApi()

interface Section {
  table: string
  title: string
  timeCol: string
}

const sections: Section[] = [
  { table: 'bookmarks', title: '북마크한 공고', timeCol: 'created_at' },
  { table: 'job_views', title: '공고 열람 기록', timeCol: 'viewed_at' },
  { table: 'job_contact_views', title: '공고 연락처 확인', timeCol: 'viewed_at' },
]

const data = ref<Record<string, { rows: Record<string, any>[]; total: number }>>({})
const loading = ref(true)

function fmtTime(v: unknown): string {
  if (!v) return '—'
  return String(v).replace('T', ' ').slice(0, 19)
}

onMounted(async () => {
  await Promise.all(
    sections.map(async (s) => {
      try {
        const res = await api.list(s.table, {
          f: 'user_id',
          op: 'eq',
          v: props.userId,
          sort: s.timeCol,
          dir: 'desc',
          pageSize: 100,
        })
        data.value[s.table] = { rows: res.rows, total: res.total }
      } catch {
        data.value[s.table] = { rows: [], total: 0 }
      }
    }),
  )
  loading.value = false
})
</script>

<template>
  <div class="space-y-4">
    <UCard v-for="s in sections" :key="s.table">
      <template #header>
        <div class="flex items-center gap-2">
          <span class="font-semibold">{{ s.title }}</span>
          <span class="text-sm text-gray-400">{{ data[s.table]?.total ?? 0 }}건</span>
        </div>
      </template>

      <Spinner v-if="loading" label="불러오는 중…" />
      <p v-else-if="!data[s.table]?.rows.length" class="py-4 text-center text-sm text-gray-400">
        기록이 없습니다.
      </p>
      <table v-else class="min-w-full text-sm">
        <thead class="text-left text-gray-500">
          <tr>
            <th class="w-12 py-1.5 font-medium">No.</th>
            <th class="py-1.5 font-medium">공고 ID</th>
            <th class="py-1.5 font-medium">시각</th>
          </tr>
        </thead>
        <tbody class="divide-y divide-gray-100">
          <tr v-for="(row, i) in data[s.table]!.rows" :key="i">
            <td class="py-1.5 text-gray-400">{{ i + 1 }}</td>
            <td class="py-1.5">
              <NuxtLink :to="`/jobs/${encodeURIComponent(row.job_id)}`" class="text-primary-600 hover:underline">
                {{ row.job_id }}
              </NuxtLink>
            </td>
            <td class="py-1.5 text-gray-600">{{ fmtTime(row[s.timeCol]) }}</td>
          </tr>
        </tbody>
      </table>
    </UCard>
  </div>
</template>
