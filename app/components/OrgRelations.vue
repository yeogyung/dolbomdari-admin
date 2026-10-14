<!-- 기관 상세 하단 — 등록 공고·보낸 추천·관심/연락 종사자 (organization_id 필터) -->
<script setup lang="ts">
import type { RelationColumn } from '~/components/RelationTable.vue'

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

const jobCol: RelationColumn = {
  label: '공고',
  text: (r) => r.job_id__ref ?? r.job_id,
  to: (r) => `/jobs/${encodeURIComponent(r.job_id)}`,
}
const workerCol: RelationColumn = {
  label: '종사자',
  text: (r) => r.worker_id__ref ?? r.worker_id,
  to: (r) => `/users/${encodeURIComponent(r.worker_id)}`,
}

/** 기록마다 보이는 열 — 난수 id 대신 공고 제목·종사자 이름(refs), 시각은 서울 yyyy.mm.dd hh:mm */
function columnsFor(s: Section): RelationColumn[] {
  const time: RelationColumn = { label: '시각', text: (r) => fmtDateTime(r[s.timeCol]), nowrap: true }
  if (s.table === 'jobs') {
    return [{ label: '공고', text: (r) => r.title || r.id, to: (r) => `/jobs/${encodeURIComponent(r.id)}` }, time]
  }
  if (s.table === 'job_recommendations') return [jobCol, workerCol, time]
  return [workerCol, time]
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
    <RelationTable
      v-for="s in sections"
      :key="s.table"
      :title="s.title"
      :loading="loading"
      :total="data[s.table]?.total ?? 0"
      :rows="data[s.table]?.rows ?? []"
      :columns="columnsFor(s)"
    />
  </div>
</template>
