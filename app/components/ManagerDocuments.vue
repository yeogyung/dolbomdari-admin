<!-- 담당자 AI 문서 목록(QA 2026-11-07 MGR-05) — supabase dbo_documents 직접(RLS: 담당자·master). 올리기는 문서 등록 화면(앱 API). 상세·새 판·종료는 master 몫이다. Figma 없음 -->
<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import type { Column } from '~/types/table'

type Row = {
  id: string
  filename: string
  kind: string | null
  excluded_at: string | null
  byte_size: number | null
  updated_at: string
  created_by_name: string | null
}

const supabase = useSupabase()
const app = useDboApp()
/** AI 가 아직 읽지 못한 문서(결정 D16). 못 받으면 비워 둔다 — 상태 칸만 덜 정확하다 */
const preparing = ref(new Set<string>())
const rows = ref<Row[]>([])
const loading = ref(false)
const error = ref('')
const q = ref('')
const columns: Column[] = [
  { key: 'filename', label: '파일명', strong: true },
  { key: 'kind', label: '형식' },
  { key: 'state', label: '상태' },
  { key: 'created_by_name', label: '올린 사람' },
  { key: 'updated_at', label: '수정일' },
]
const shown = computed(() => {
  const word = q.value.trim().toLowerCase()
  return word ? rows.value.filter((r) => r.filename.toLowerCase().includes(word)) : rows.value
})

async function load() {
  loading.value = true
  error.value = ''
  try {
    const [{ data, error: e }, prep] = await Promise.all([
      supabase
        .from('dbo_documents')
        .select('id, filename, kind, excluded_at, byte_size, updated_at, created_by_name')
        .order('updated_at', { ascending: false })
        .limit(500),
      app.preparingDocuments().catch(() => ({ ids: [] as string[] })),
    ])
    if (e) throw e
    rows.value = (data ?? []) as Row[]
    preparing.value = new Set(prep.ids)
  } catch (e) {
    rows.value = []
    error.value = dboErrorMessage(e, '문서를 불러오지 못했습니다.')
  } finally {
    loading.value = false
  }
}
/** 상태 — 빼 둔 문서 · AI 가 아직 읽지 못한(색인 전) 문서 · 사용 중 */
function stateLabel(r: Row): string {
  if (r.excluded_at) return '사용 안 함'
  return preparing.value.has(r.id) ? '준비 중' : '사용 중'
}
onMounted(load)
</script>

<template>
  <div class="space-y-5">
    <Teleport to="#admin-topbar-actions">
      <AppButton icon="i-lucide-upload" @click="navigateTo('/senior/documents/new')">문서 올리기</AppButton>
    </Teleport>
    <p class="text-sm text-muted">AI 가 답할 때 참고하는 문서입니다. 올린 문서는 AI 가 읽는 동안 「준비 중」으로 보입니다.</p>
    <p v-if="error" role="alert" class="text-sm text-red-600">{{ error }}</p>
    <DataTable :columns="columns" :rows="shown" :loading="loading" :total="shown.length" :page="1"
      :page-size="Math.max(shown.length, 1)" :page-size-options="[Math.max(shown.length, 1)]" empty-text="문서가 없습니다">
      <template #toolbar>
        <form class="flex gap-2" @submit.prevent>
          <TextField v-model="q" placeholder="파일명 검색" aria-label="파일명 검색" />
        </form>
        <AppButton variant="outline" @click="load">새로고침</AppButton>
      </template>
      <template #cell-kind="{ row }">{{ row.kind ?? '—' }}</template>
      <template #cell-state="{ row }">{{ stateLabel(row as Row) }}</template>
      <template #cell-created_by_name="{ row }">{{ row.created_by_name ?? '—' }}</template>
      <template #cell-updated_at="{ row }">{{ fmtStamp(row.updated_at) }}</template>
    </DataTable>
  </div>
</template>
