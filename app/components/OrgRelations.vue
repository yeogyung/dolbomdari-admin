<!-- 기관 상세 하단 — 기관 정보(담당자 입력)·소속 담당자·등록 공고·보낸 추천·관심/연락 종사자 (organization_id 필터) -->
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
  { table: 'organization_manager', title: '소속 담당자', timeCol: 'updated_at' },
  { table: 'jobs', title: '등록 공고', timeCol: 'created_at' },
  { table: 'job_recommendations', title: '보낸 공고 추천', timeCol: 'created_at' },
  { table: 'worker_bookmarks', title: '관심 종사자', timeCol: 'created_at' },
  { table: 'worker_contact_views', title: '연락한 종사자', timeCol: 'viewed_at' },
]

const data = ref<Record<string, { rows: Record<string, any>[]; total: number; failed?: boolean }>>({})
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
  if (s.table === 'organization_manager') {
    return [
      {
        label: '담당자',
        text: (r) => r.manager_name || r.id,
        to: (r) => `/organization_manager/${encodeURIComponent(r.id)}`,
      },
      { label: '직책', text: (r) => r.position || '—' },
      { label: '전화', text: (r) => r.phone || '—', nowrap: true },
      { label: '이메일', text: (r) => r.manager_email || '—' },
    ]
  }
  if (s.table === 'jobs') {
    return [{ label: '공고', text: (r) => r.title || r.id, to: (r) => `/jobs/${encodeURIComponent(r.id)}` }, time]
  }
  if (s.table === 'job_recommendations') return [jobCol, workerCol, time]
  return [workerCol, time]
}

/** 기관 테이블엔 이름뿐이라 주소·전화 등은 담당자들이 가입 때 입력한 값에서 고른다 */
const orgInfo = computed(() => summarizeOrgInfo(data.value.organization_manager?.rows ?? []))

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
        data.value[s.table] = { rows: [], total: 0, failed: true }
      }
    }),
  )
  loading.value = false
})
</script>

<template>
  <div class="space-y-6">
    <AppCard v-if="!loading && orgInfo.length" padding="none">
      <template #header>
        <h3 class="text-[15px] font-semibold text-ink">기관 정보</h3>
        <span class="text-xs text-muted">담당자가 가입할 때 입력한 값 · 최근 수정 기준</span>
      </template>
      <dl class="grid grid-cols-1 px-6 pb-4 md:grid-cols-2 md:gap-x-8">
        <div
          v-for="e in orgInfo"
          :key="e.key"
          class="grid grid-cols-[8rem_1fr] gap-4 border-b border-hairline-soft py-3.5 text-sm"
        >
          <dt class="font-medium text-muted">{{ e.label }}</dt>
          <dd class="flex min-w-0 flex-wrap items-center gap-2 break-words text-body">
            {{ e.text }}
            <Tag v-if="e.differs">담당자마다 다름</Tag>
          </dd>
        </div>
        <OrgDocumentRow :managers="data.organization_manager?.rows ?? []" />
      </dl>
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
