<!-- 기관 상세 하단 — 등록 공고·보낸 추천·관심/연락 종사자 (organization_id 필터) -->
<script setup lang="ts">
const props = defineProps<{ organizationId: string }>()
const api = useAdminApi()

interface Section {
  table: string
  title: string
  timeCol: string
}

const sections: Section[] = [
  { table: 'jobs', title: '등록 공고', timeCol: 'created_at' },
  { table: 'job_recommendations', title: '보낸 공고 추천', timeCol: 'created_at' },
  { table: 'worker_bookmarks', title: '관심 종사자', timeCol: 'created_at' },
  { table: 'worker_contact_views', title: '연락한 종사자', timeCol: 'viewed_at' },
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
          f: 'organization_id',
          op: 'eq',
          v: props.organizationId,
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
  <div class="space-y-6">
    <AppCard v-for="s in sections" :key="s.table">
      <template #header>
        <h3 class="text-[15px] font-semibold text-ink">{{ s.title }}</h3>
        <Tag>{{ data[s.table]?.total ?? 0 }}건</Tag>
      </template>

      <AppSpinner v-if="loading" size="sm" label="불러오는 중…" />
      <p v-else-if="!data[s.table]?.rows.length" class="py-6 text-center text-sm text-muted-soft">기록이 없습니다.</p>
      <div v-else class="overflow-x-auto">
        <table class="w-full border-collapse">
          <thead>
            <tr>
              <th class="w-12 pr-3 pb-2.5 text-left text-[13px] font-semibold whitespace-nowrap text-muted">No.</th>
              <!-- 등록 공고: 공고, 그 외: 공고/종사자 -->
              <th v-if="s.table === 'jobs'" class="pr-3 pb-2.5 text-left text-[13px] font-semibold whitespace-nowrap text-muted">공고</th>
              <template v-else>
                <th v-if="s.table === 'job_recommendations'" class="pr-3 pb-2.5 text-left text-[13px] font-semibold whitespace-nowrap text-muted">공고 ID</th>
                <th class="pr-3 pb-2.5 text-left text-[13px] font-semibold whitespace-nowrap text-muted">종사자 ID</th>
              </template>
              <th class="pr-3 pb-2.5 text-left text-[13px] font-semibold whitespace-nowrap text-muted">시각</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="(row, i) in data[s.table]!.rows" :key="i">
              <td class="border-t border-hairline-soft py-2.5 pr-3 text-sm tabular-nums text-muted-soft">{{ i + 1 }}</td>

              <!-- 등록 공고 -->
              <td v-if="s.table === 'jobs'" class="border-t border-hairline-soft py-2.5 pr-3 text-sm">
                <NuxtLink :to="`/jobs/${encodeURIComponent(row.id)}`" class="font-medium text-brand-500 hover:underline">
                  {{ row.title || row.id }}
                </NuxtLink>
              </td>

              <!-- 그 외 -->
              <template v-else>
                <td v-if="s.table === 'job_recommendations'" class="border-t border-hairline-soft py-2.5 pr-3 text-sm">
                  <NuxtLink :to="`/jobs/${encodeURIComponent(row.job_id)}`" class="font-medium text-brand-500 hover:underline">
                    {{ row.job_id }}
                  </NuxtLink>
                </td>
                <td class="border-t border-hairline-soft py-2.5 pr-3 text-sm">
                  <NuxtLink :to="`/users/${encodeURIComponent(row.worker_id)}`" class="font-medium text-brand-500 hover:underline">
                    {{ row.worker_id }}
                  </NuxtLink>
                </td>
              </template>

              <td class="border-t border-hairline-soft py-2.5 pr-3 text-sm whitespace-nowrap text-body">{{ fmtTime(row[s.timeCol]) }}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </AppCard>
  </div>
</template>
