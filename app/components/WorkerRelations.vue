<!-- 종사자 상세 하단 — 이력서 + 북마크·열람·연락처확인·받은 추천 (user_id/worker_id 필터) -->
<script setup lang="ts">
import type { RelationColumn } from '~/components/RelationTable.vue'

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

const data = ref<Record<string, { rows: Record<string, any>[]; total: number; failed?: boolean }>>({})

/** 열은 모든 기록이 같다 — 공고(제목, 상세 링크)와 시각 */
const columnsFor = (s: Section): RelationColumn[] => [
  { label: '공고', text: (r) => r.job_id__ref ?? r.job_id, to: (r) => `/jobs/${encodeURIComponent(r.job_id)}` },
  { label: '시각', text: (r) => fmtDateTime(r[s.timeCol]), nowrap: true },
]
const resume = ref<Record<string, any> | null>(null)
const resumeFailed = ref(false)
const loading = ref(true)

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
        data.value[s.table] = { rows: [], total: 0, failed: true }
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
        resumeFailed.value = true
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
          상태 {{ resume.status }} · 수정 {{ fmtDateTime(resume.updated_at) }}
        </span>
        <NuxtLink :to="`/resumes/${encodeURIComponent(resume.id)}`" class="font-medium text-brand-500 hover:underline">
          이력서 보기 →
        </NuxtLink>
      </div>
      <p v-else-if="resumeFailed" class="py-6 text-center text-sm text-down">이력서를 불러오지 못했습니다.</p>
      <p v-else class="py-6 text-center text-sm text-muted-soft">작성된 이력서가 없습니다.</p>
    </AppCard>

    <RelationTable
      v-for="s in sections"
      :key="s.table"
      :title="s.title"
      :loading="loading"
      :total="data[s.table]?.total ?? 0"
      :rows="data[s.table]?.rows ?? []"
      :columns="columnsFor(s)"
      :failed="data[s.table]?.failed"
    />
  </div>
</template>
