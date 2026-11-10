<!-- 담당자의 보낸 공지 목록(QA 2026-11-07 MGR-01) — 앱 「보낸 공지」와 같다. 조회는 supabase dbo_notices 직접(RLS), 본인이 보낸 발행 공지만. Figma 없음 -->
<script setup lang="ts">
import { onMounted, ref, watch } from 'vue'
import type { Column } from '~/types/table'
import { noticeTypeLabel } from '~/utils/notices'

type Row = { id: string; title: string; kind: 'normal' | 'urgent'; is_special: boolean; published_at: string | null }

const supabase = useSupabase()
const rows = ref<Row[]>([])
const total = ref(0)
const page = ref(1)
const loading = ref(false)
const error = ref('')
const PAGE_SIZE = 20
const columns: Column[] = [
  { key: 'title', label: '공지 제목', strong: true },
  { key: 'kind', label: '구분' },
  { key: 'published_at', label: '발행일' },
]
let sequence = 0

async function load() {
  const current = ++sequence
  loading.value = true
  error.value = ''
  try {
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) throw new Error('세션이 없습니다. 다시 로그인해 주세요.')
    const from = (page.value - 1) * PAGE_SIZE
    const { data, error: e, count } = await supabase
      .from('dbo_notices')
      .select('id, title, kind, is_special, published_at', { count: 'exact' })
      .eq('status', 'sent')
      .eq('author_profile_id', session.user.id)
      .order('published_at', { ascending: false, nullsFirst: false })
      .range(from, from + PAGE_SIZE - 1)
    if (e) throw e
    if (current !== sequence) return
    rows.value = (data ?? []) as Row[]
    total.value = count ?? 0
  } catch (e) {
    if (current !== sequence) return
    rows.value = []
    total.value = 0
    error.value = dboErrorMessage(e, '공지를 불러오지 못했습니다.')
  } finally {
    if (current === sequence) loading.value = false
  }
}
watch(page, load)
onMounted(load)
</script>

<template>
  <div class="space-y-5">
    <Teleport to="#admin-topbar-actions">
      <AppButton icon="i-lucide-pencil" @click="navigateTo('/senior/notices/new')">공지 작성</AppButton>
    </Teleport>
    <p class="text-sm text-muted">내가 보낸 공지입니다. 공지를 고르면 열람 현황을 보고 안 읽은 분에게 다시 알릴 수 있습니다.</p>
    <p v-if="error" role="alert" class="text-sm text-red-600">{{ error }}</p>
    <DataTable :columns="columns" :rows="rows" :loading="loading" :total="total" :page="page"
      :page-size="PAGE_SIZE" :page-size-options="[PAGE_SIZE]" empty-text="보낸 공지가 없습니다" @update:page="page = $event">
      <template #toolbar>
        <AppButton variant="outline" @click="load">새로고침</AppButton>
      </template>
      <template #cell-title="{ row }"><NuxtLink :to="`/senior/notices/${row.id}`" class="text-brand-500 hover:underline">{{ row.title }}</NuxtLink></template>
      <template #cell-kind="{ row }">{{ noticeTypeLabel(row as Row) }}</template>
      <template #cell-published_at="{ row }">{{ row.published_at ? fmtStamp(row.published_at) : '미발행' }}</template>
    </DataTable>
  </div>
</template>
