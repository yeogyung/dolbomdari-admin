<!-- FAQ 관리 — 목록·승인 상태 필터·검색 (조회는 supabase dbo_faqs 직접, 페이지 없이 sort 순 전량) -->
<script setup lang="ts">
import { ref, computed, onMounted, type Ref } from 'vue'
import type { Column } from '~/types/table'
import type { Faq, FaqStatus } from '~/types/dbo'
import { downloadExcel, excelStamp, type ExcelColumn } from '~/utils/excel'

const faqs = useFaqs()
const toast = useToast()
const { setHeader } = useAdminHeader()
setHeader('FAQ 관리')
/** 담당자는 맡은 근무지 FAQ 를 등록한다(QA 2026-11-07 MGR-05) — 검토 중으로 저장되고 master 가 승인한다 */
const isManager = computed(() => useAdminRole().me.value?.role === 'manager')
const createOpen = ref(false)

const all = ref<Faq[]>([])
const loading = ref(false)
// 검색·필터·정렬·페이지는 주소에 담는다 — 상세에서 뒤로 오면 그대로다(QA 2026-10-11)
const lq = useListQuery({ q: '', status: '' })
const q = lq.q
/** '' 은 반려를 뺀 전체(기본, QA 2026-11-07 ADMIN-10 · 결정 D21), 'all' 은 반려까지 전부 */
const statusFilter = lq.status as Ref<'' | FaqStatus | 'all'>

// 서버가 페이지를 나누지 않는다 — 프롬프트에 실리는 순서(sort) 그대로 전부 보여 준다
const rows = computed(() =>
  filterFaqs(all.value, {
    q: q.value,
    status: statusFilter.value === 'all' ? '' : statusFilter.value,
    hideRejected: statusFilter.value === '',
  }),
)
const pendingCount = computed(() => all.value.filter((f) => f.status === 'pending').length)
const rejectedCount = computed(() => all.value.filter((f) => f.status === 'rejected').length)

const columns: Column[] = [
  { key: 'sort', label: '순서', align: 'center' },
  { key: 'question', label: '질문', strong: true },
  { key: 'category', label: '분류' },
  { key: 'scope', label: '적용 범위' },
  { key: 'status', label: '승인 상태' },
  { key: 'enabled', label: 'AI 사용' },
  { key: 'created_at', label: '등록일' },
]

async function load() {
  loading.value = true
  try {
    all.value = await faqs.listFaqs()
  } catch (e: any) {
    toast.add({ title: 'FAQ 조회 실패', description: faqReadErrorMessage(e), color: 'error' })
  } finally {
    loading.value = false
  }
}

/* 엑셀 — 전량을 받아 두므로 지금 걸린 필터 결과(rows)를 그대로 내보낸다. 답변·적용 근무지는 줄이지 않는다 */
const EXCEL_COLUMNS: ExcelColumn[] = [
  { key: 'sort', label: '순서' },
  { key: 'question', label: '질문' },
  { key: 'answer', label: '답변' },
  { key: 'category', label: '분류' },
  { key: 'scope', label: '적용 범위' },
  { key: 'status', label: '승인 상태' },
  { key: 'enabled', label: 'AI 사용' },
  { key: 'created_at', label: '등록일' },
]

const { exporting, startExport, finishExport } = useExcelExport()

async function exportExcel() {
  if (!rows.value.length) {
    toast.add({ title: '내보낼 FAQ가 없습니다.', color: 'warning' })
    return
  }
  await startExport()
  try {
    const data = rows.value.map((f) => {
      const scope = faqScopeNames(f)
      return {
        sort: f.sort,
        question: f.question,
        answer: f.answer,
        category: f.category ?? '',
        scope: scope.length ? scope.join(', ') : '기관 전체',
        status: faqStatusLabel(f.status),
        enabled: f.enabled ? '사용' : '미사용',
        created_at: excelStamp(f.created_at),
      }
    })
    downloadExcel('FAQ', data, EXCEL_COLUMNS)
  } finally {
    finishExport()
  }
}

onMounted(load)
</script>

<template>
  <div class="flex min-h-[calc(100vh-8rem)] flex-col">
    <Teleport to="#admin-topbar-actions">
      <AppButton v-if="isManager" icon="i-lucide-plus" @click="createOpen = true">FAQ 등록</AppButton>
      <AppButton variant="outline" color="neutral" icon="i-lucide-download" :loading="exporting" :disabled="loading" @click="exportExcel">
        엑셀 다운로드
      </AppButton>
    </Teleport>

    <DataTable
      :columns="columns"
      :rows="rows"
      :loading="loading"
      :total="rows.length"
      :paginated="false"
      :empty-text="all.length ? '조건에 맞는 FAQ가 없습니다.' : '등록된 FAQ가 없습니다.'"
    >
      <template #toolbar>
        <PillSearch v-model="q" placeholder="질문·답변 검색" />
        <PillSelect
          v-model="statusFilter"
          :options="[
            { label: '반려 빼고 전체', value: '' },
            ...FAQ_STATUSES,
            { label: '반려 포함 전체', value: 'all' },
          ]"
        />
      </template>
      <template #toolbar-end>
        <span class="text-sm text-muted tabular-nums">
          전체 {{ all.length }}개 · 승인 대기 {{ pendingCount }}개<template v-if="statusFilter === '' && rejectedCount">
            · 반려 {{ rejectedCount }}개 숨김</template>
        </span>
      </template>

      <template #cell-question="{ row }">
        <span class="line-clamp-2">{{ row.question }}</span>
      </template>
      <template #cell-category="{ row }">{{ row.category || '—' }}</template>
      <template #cell-scope="{ row }">{{ faqScopeLabel(row) }}</template>
      <template #cell-status="{ row }">
        <StatusBadge :tone="faqStatusTone(row.status)">{{ faqStatusLabel(row.status) }}</StatusBadge>
      </template>
      <template #cell-enabled="{ row }">
        <span :class="row.enabled ? 'text-up' : 'text-muted'">{{ row.enabled ? '사용' : '미사용' }}</span>
      </template>
      <template #cell-created_at="{ row }">{{ fmtStamp(row.created_at) }}</template>

      <template #actions="{ row }">
        <NuxtLink
          :to="`/senior/faqs/${row.id}`"
          class="text-sm font-medium text-brand-500 hover:underline"
        >
          상세
        </NuxtLink>
      </template>
    </DataTable>
    <ManagerFaqCreate v-if="isManager" v-model:open="createOpen" @created="load" />
  </div>
</template>
