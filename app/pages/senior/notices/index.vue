<script setup lang="ts">
import type { NoticeSummary } from '~/types/dbo'
import type { Column } from '~/types/table'
import { downloadExcel, excelStamp, type ExcelColumn } from '~/utils/excel'

const api = useDboAdmin()
useAdminHeader().setHeader('공지·미열람 관리')
const rows = ref<NoticeSummary[]>([])
const loading = ref(false)
const error = ref('')
const page = ref(1)
const total = ref(0)
const q = ref('')
let sequence = 0
const columns: Column[] = [
  { key: 'title', label: '공지 제목', strong: true },
  { key: 'kind', label: '구분' },
  { key: 'status', label: '상태' },
  { key: 'published_at', label: '발행일' },
]
async function load() {
  const current = ++sequence
  loading.value = true
  error.value = ''
  rows.value = []
  try {
    const result = await api.listNotices({ page: page.value, size: 20, q: q.value })
    if (current !== sequence) return
    rows.value = result.items
    total.value = result.total
  } catch (e) {
    if (current === sequence) { error.value = dboErrorMessage(e); total.value = 0 }
  } finally {
    if (current === sequence) loading.value = false
  }
}
function search() { if (page.value !== 1) page.value = 1; else load() }
watch(page, load)

/* 엑셀 — 검색 조건 전체를 받아 내보낸다 */
const toast = useToast()
const { exporting, startExport, finishExport } = useExcelExport()
const EXCEL_COLUMNS: ExcelColumn[] = [
  { key: 'title', label: '공지 제목' },
  { key: 'kind', label: '구분' },
  { key: 'status', label: '상태' },
  { key: 'published_at', label: '발행일' },
]
async function exportExcel() {
  await startExport()
  try {
    const all = await fetchAllPages((p, size) => api.listNotices({ page: p, size, q: q.value }), (n) => n.id)
    if (!all.length) {
      toast.add({ title: '내보낼 공지가 없습니다.', color: 'warning' })
      return
    }
    const data = all.map((n) => ({
      title: n.title,
      kind: n.kind === 'urgent' ? '긴급' : '일반',
      status: { draft: '임시저장', sent: '발행됨', revoked: '회수됨' }[n.status],
      published_at: n.published_at ? excelStamp(n.published_at) : '미발행',
    }))
    downloadExcel(`공지_${todaySeoul()}`, data, EXCEL_COLUMNS)
  } catch (e) {
    toast.add({ title: '엑셀 내보내기 실패', description: dboErrorMessage(e), color: 'error' })
  } finally {
    finishExport()
  }
}
onMounted(load)
</script>

<template>
  <div class="space-y-5">
    <Teleport to="#admin-topbar-actions">
      <AppButton variant="outline" color="neutral" icon="i-lucide-download" :loading="exporting" @click="exportExcel">
        엑셀 다운로드
      </AppButton>
    </Teleport>
    <p class="text-sm text-muted">공지를 선택하면 문자와 푸시 발송 내역 및 열람 여부를 확인할 수 있습니다</p>
    <p v-if="error" role="alert" class="text-sm text-red-600">{{ error }}</p>
    <DataTable :columns="columns" :rows="rows" :loading="loading" :total="total" :page="page"
      :page-size="20" :page-size-options="[20]" empty-text="조회된 공지가 없습니다" @update:page="page = $event">
      <template #toolbar>
        <form class="flex gap-2" @submit.prevent="search">
          <TextField v-model="q" placeholder="공지 제목 검색" aria-label="공지 제목 검색" />
          <AppButton type="submit" variant="outline">검색</AppButton>
        </form>
        <AppButton variant="outline" @click="load">새로고침</AppButton>
      </template>
      <template #cell-title="{ row }"><NuxtLink :to="`/senior/notices/${row.id}`" class="text-brand-500 hover:underline">{{ row.title }}</NuxtLink></template>
      <template #cell-kind="{ row }">{{ row.kind === 'urgent' ? '긴급' : '일반' }}</template>
      <template #cell-status="{ row }">{{ { draft: '임시저장', sent: '발행됨', revoked: '회수됨' }[row.status as string] }}</template>
      <template #cell-published_at="{ row }">{{ row.published_at ? fmtStamp(row.published_at) : '미발행' }}</template>
    </DataTable>
  </div>
</template>
