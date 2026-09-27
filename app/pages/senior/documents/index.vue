<!-- AI 문서 관리 — 목록·파일명 검색·정렬 (GET /dbo-admin/documents, 상태는 서버가 날짜로 계산) -->
<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import type { Column } from '~/types/table'
import type { DocumentListItem, Worksite } from '~/types/dbo'

const api = useDboAdmin()
const toast = useToast()
const { setHeader } = useAdminHeader()
setHeader('AI 문서 관리')

const rows = ref<DocumentListItem[]>([])
const total = ref(0)
const page = ref(1)
const pageSize = ref(20)
const q = ref('')
const sortKey = ref('effective_date')
const loading = ref(false)
const worksites = ref<Worksite[]>([])

// 서버는 방향을 받지 않는다 — 파일명만 오름차순, 날짜는 최신순(documents.ts listDocuments)
const sortDir = computed(() => (sortKey.value === 'filename' ? 'asc' : 'desc'))
const worksiteName = (wid: string) => worksites.value.find((w) => w.id === wid)?.name ?? wid

const columns: Column[] = [
  { key: 'filename', label: '파일명', sortable: true, strong: true },
  { key: 'kind', label: '형식' },
  { key: 'version', label: '버전' },
  { key: 'state', label: '상태' },
  { key: 'effective_date', label: '발효일', sortable: true },
  { key: 'expiry_date', label: '종료일' },
  { key: 'scope', label: '적용 범위' },
  { key: 'byte_size', label: '크기', align: 'right' },
  { key: 'updated_at', label: '수정일', sortable: true },
]

async function load() {
  loading.value = true
  try {
    const res = await api.listDocuments({ page: page.value, size: pageSize.value, q: q.value, sort: sortKey.value })
    rows.value = res.items
    total.value = res.total
  } catch (e: any) {
    toast.add({ title: '문서 조회 실패', description: dboErrorMessage(e), color: 'error' })
  } finally {
    loading.value = false
  }
}

async function loadWorksites() {
  try {
    worksites.value = (await api.listWorksites({ size: 100 })).items
  } catch {
    // 근무지 이름은 표기 편의다. 실패하면 id 로 보인다.
  }
}

function search() {
  page.value = 1
  load()
}

function toggleSort(key: string) {
  sortKey.value = key
  page.value = 1
  load()
}

onMounted(() => {
  load()
  loadWorksites()
})
</script>

<template>
  <div class="flex min-h-[calc(100vh-8rem)] flex-col">
    <DataTable
      :columns="columns"
      :rows="rows"
      :loading="loading"
      :sort-key="sortKey"
      :sort-dir="sortDir"
      :page="page"
      :page-size="pageSize"
      :total="total"
      :page-size-options="[20, 50, 100]"
      empty-text="등록된 AI 문서가 없습니다."
      @sort="toggleSort"
      @update:page="(p) => { page = p; load() }"
      @update:page-size="(s) => { pageSize = s; page = 1; load() }"
    >
      <template #toolbar>
        <PillSearch v-model="q" placeholder="파일명 검색" @search="search" />
      </template>
      <template #toolbar-end>
        <span class="text-sm text-muted tabular-nums">전체 {{ total.toLocaleString() }}건</span>
      </template>

      <template #cell-kind="{ row }">
        <Tag>{{ row.kind || '—' }}</Tag>
      </template>
      <template #cell-version="{ row }">{{ row.version || '—' }}</template>
      <template #cell-state="{ row }">
        <StatusBadge :tone="docStateTone(row.state)">{{ row.state }}</StatusBadge>
      </template>
      <template #cell-effective_date="{ row }">{{ row.effective_date || '—' }}</template>
      <template #cell-expiry_date="{ row }">{{ row.expiry_date || '무기한' }}</template>
      <template #cell-scope="{ row }">{{ docScopeLabel(row, worksiteName) }}</template>
      <template #cell-byte_size="{ row }">
        <span class="tabular-nums">{{ fmtBytes(row.byte_size) }}</span>
      </template>
      <template #cell-updated_at="{ row }">{{ fmtStamp(row.updated_at) }}</template>

      <template #actions="{ row }">
        <NuxtLink :to="`/senior/documents/${row.id}`" class="text-sm font-medium text-brand-500 hover:underline">
          상세
        </NuxtLink>
      </template>
    </DataTable>
  </div>
</template>
