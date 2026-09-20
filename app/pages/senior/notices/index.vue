<script setup lang="ts">
import type { NoticeSummary } from '~/types/dbo'
import type { Column } from '~/types/table'

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
onMounted(load)
</script>

<template>
  <div class="space-y-5">
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
