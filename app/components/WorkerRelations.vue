<!-- 종사자 상세 하단 — 이력서 + 북마크·열람·연락처확인·받은 추천 (user_id/worker_id 필터) -->
<script setup lang="ts">
const props = defineProps<{ userId: string }>()
const api = useAdminApi()

interface Section {
  table: string
  title: string
  timeCol: string
  filterCol?: string // 기본 user_id, 추천은 worker_id
}

const sections: Section[] = [
  { table: 'bookmarks', title: '북마크한 공고', timeCol: 'created_at' },
  { table: 'job_views', title: '공고 열람 기록', timeCol: 'viewed_at' },
  { table: 'job_contact_views', title: '공고 연락처 확인', timeCol: 'viewed_at' },
  { table: 'job_recommendations', title: '받은 공고 추천', timeCol: 'created_at', filterCol: 'worker_id' },
]

const data = ref<Record<string, { rows: Record<string, any>[]; total: number }>>({})
const resume = ref<Record<string, any> | null>(null)
const loading = ref(true)

function fmtTime(v: unknown): string {
  if (!v) return '—'
  return String(v).replace('T', ' ').slice(0, 19)
}

onMounted(async () => {
  await Promise.all([
    ...sections.map(async (s) => {
      try {
        const res = await api.list(s.table, {
          f: s.filterCol ?? 'user_id',
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
    (async () => {
      try {
        const res = await api.list('resumes', {
          f: 'user_id',
          op: 'eq',
          v: props.userId,
          pageSize: 1,
        })
        resume.value = res.rows[0] ?? null
      } catch {
        resume.value = null
      }
    })(),
  ])
  loading.value = false
})
</script>

<template>
  <div class="space-y-6">
    <!-- 이력서 -->
    <AppCard>
      <template #header>
        <h3 class="text-[15px] font-semibold text-ink">이력서</h3>
      </template>
      <AppSpinner v-if="loading" size="sm" label="불러오는 중…" />
      <div v-else-if="resume" class="flex flex-wrap items-center justify-between gap-3 text-sm">
        <span class="text-muted">
          상태 {{ resume.status }} · 수정 {{ fmtTime(resume.updated_at) }}
        </span>
        <NuxtLink :to="`/resumes/${encodeURIComponent(resume.id)}`" class="font-medium text-brand-500 hover:underline">
          이력서 보기 →
        </NuxtLink>
      </div>
      <p v-else class="py-6 text-center text-sm text-muted-soft">작성된 이력서가 없습니다.</p>
    </AppCard>

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
              <th class="pr-3 pb-2.5 text-left text-[13px] font-semibold whitespace-nowrap text-muted">공고 ID</th>
              <th class="pr-3 pb-2.5 text-left text-[13px] font-semibold whitespace-nowrap text-muted">시각</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="(row, i) in data[s.table]!.rows" :key="i">
              <td class="border-t border-hairline-soft py-2.5 pr-3 text-sm tabular-nums text-muted-soft">{{ i + 1 }}</td>
              <td class="border-t border-hairline-soft py-2.5 pr-3 text-sm">
                <NuxtLink :to="`/jobs/${encodeURIComponent(row.job_id)}`" class="font-medium text-brand-500 hover:underline">
                  {{ row.job_id }}
                </NuxtLink>
              </td>
              <td class="border-t border-hairline-soft py-2.5 pr-3 text-sm whitespace-nowrap text-body">{{ fmtTime(row[s.timeCol]) }}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </AppCard>
  </div>
</template>
