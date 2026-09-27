<!-- FAQ 관리 — 목록·승인 상태 필터·검색 (조회는 supabase dbo_faqs 직접, 페이지 없이 sort 순 전량) -->
<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import type { Column } from '~/types/table'
import type { Faq, FaqStatus } from '~/types/dbo'

const faqs = useFaqs()
const toast = useToast()
const { setHeader } = useAdminHeader()
setHeader('FAQ 관리')

const all = ref<Faq[]>([])
const loading = ref(false)
const q = ref('')
const statusFilter = ref<'' | FaqStatus>('')

// 서버가 페이지를 나누지 않는다 — 프롬프트에 실리는 순서(sort) 그대로 전부 보여 준다
const rows = computed(() => filterFaqs(all.value, { q: q.value, status: statusFilter.value }))
const pendingCount = computed(() => all.value.filter((f) => f.status === 'pending').length)

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

onMounted(load)
</script>

<template>
  <div class="flex min-h-[calc(100vh-8rem)] flex-col">
    <DataTable
      :columns="columns"
      :rows="rows"
      :loading="loading"
      :total="rows.length"
      :page-size="100"
      :empty-text="all.length ? '조건에 맞는 FAQ가 없습니다.' : '등록된 FAQ가 없습니다.'"
    >
      <template #toolbar>
        <PillSearch v-model="q" placeholder="질문·답변 검색" />
        <PillSelect
          v-model="statusFilter"
          :options="[{ label: '상태 전체', value: '' }, ...FAQ_STATUSES]"
        />
      </template>
      <template #toolbar-end>
        <span class="text-sm text-muted tabular-nums">
          전체 {{ all.length }}개 · 승인 대기 {{ pendingCount }}개
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
  </div>
</template>
