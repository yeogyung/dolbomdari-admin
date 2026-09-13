<!-- 테이블 목록 — 헤더(상단바) + 툴바(검색·탭) + DataTable(정렬·페이지네이션·엑셀·행 액션) -->
<script setup lang="ts">
import { ref, computed, watch, watchEffect, onMounted } from 'vue'
import { getTable } from '#shared/tables'
import { downloadExcel, type ExcelColumn } from '~/utils/excel'
import type { Column } from '~/types/table'

const route = useRoute()
const api = useAdminApi()
const toast = useToast()
const { setHeader } = useAdminHeader()

const tableName = computed(() => String(route.params.table))
const def = computed(() => getTable(tableName.value))

const rows = ref<Record<string, any>[]>([])
const total = ref(0)
const page = ref(1)
const pageSize = ref(20)
const q = ref('')
const loading = ref(false)
const exporting = ref(false)

const sortCol = ref('')
const sortDir = ref<'asc' | 'desc'>('asc')

const sourceTab = ref<'all' | 'user' | 'auto'>('all')
const isJobs = computed(() => tableName.value === 'jobs')

const detailOpen = ref(false)
const detailRow = ref<Record<string, any> | null>(null)

function labelFor(col: string): string {
  const ref = def.value?.refs?.find((r) => `${r.column}__ref` === col)
  if (ref) return ref.label
  return def.value?.fields.find((f) => f.name === col)?.label || col
}

const tableColumns = computed<Column[]>(() => {
  const base = def.value?.listColumns ?? (rows.value[0] ? Object.keys(rows.value[0]) : [])
  return base
    .filter((c) => c !== 'id')
    .map((key, idx) => ({
      key,
      label: labelFor(key),
      sortable: !key.endsWith('__ref'), // 해석 컬럼은 서버 정렬 불가
      strong: idx === 0,
    }))
})

function displayFull(value: unknown): string {
  if (value === null || value === undefined || value === '') return '—'
  if (Array.isArray(value)) return value.join(', ')
  if (typeof value === 'boolean') return value ? '✓' : '✗'
  if (typeof value === 'object') return JSON.stringify(value, null, 2)
  return String(value)
}

function sourceFilter() {
  if (!isJobs.value || sourceTab.value === 'all') return {}
  return sourceTab.value === 'user'
    ? { f: 'source', op: 'eq' as const, v: 'manual' }
    : { f: 'source', op: 'neq' as const, v: 'manual' }
}

async function load() {
  if (!def.value) return
  loading.value = true
  try {
    const res = await api.list(tableName.value, {
      page: page.value,
      pageSize: pageSize.value,
      q: q.value,
      sort: sortCol.value || undefined,
      dir: sortCol.value ? sortDir.value : undefined,
      ...sourceFilter(),
    })
    rows.value = res.rows
    total.value = res.total
  } catch (e: any) {
    toast.add({ title: '목록 조회 실패', description: e?.data?.statusMessage || e.message, color: 'error' })
  } finally {
    loading.value = false
  }
}

function search() {
  page.value = 1
  load()
}

function changePage(p: number) {
  page.value = p
  load()
}

function changePageSize(size: number) {
  pageSize.value = size
  page.value = 1
  load()
}

function toggleSort(col: string) {
  if (sortCol.value === col) {
    sortDir.value = sortDir.value === 'asc' ? 'desc' : 'asc'
  } else {
    sortCol.value = col
    sortDir.value = 'asc'
  }
  page.value = 1
  load()
}

function setTab(tab: 'all' | 'user' | 'auto') {
  sourceTab.value = tab
  page.value = 1
  load()
}

function goDetail(row: Record<string, any>) {
  if (def.value?.pk.length === 1) {
    navigateTo(`/${tableName.value}/${encodeURIComponent(pkValue(row))}`)
  } else {
    detailRow.value = row
    detailOpen.value = true
  }
}

async function exportExcel() {
  if (!def.value) return
  exporting.value = true
  try {
    const res = await api.list(tableName.value, { all: true, q: q.value, ...sourceFilter() })
    const keys = res.rows[0] ? Object.keys(res.rows[0]) : (def.value.listColumns ?? [])
    const cols: ExcelColumn[] = keys.map((key) => ({ key, label: labelFor(key) }))
    downloadExcel(`${def.value.label}_${tableName.value}`, res.rows, cols)
  } catch (e: any) {
    toast.add({ title: '엑셀 내보내기 실패', description: e?.data?.statusMessage || e.message, color: 'error' })
  } finally {
    exporting.value = false
  }
}

async function removeRow(row: Record<string, any>) {
  if (!def.value) return
  if (!confirm('정말 삭제하시겠습니까?')) return
  const key: Record<string, string> = {}
  for (const col of def.value.pk) key[col] = String(row[col])
  try {
    await api.remove(tableName.value, key)
    toast.add({ title: '삭제되었습니다.', color: 'success' })
    detailOpen.value = false
    load()
  } catch (e: any) {
    toast.add({ title: '삭제 실패', description: e?.data?.statusMessage || e.message, color: 'error' })
  }
}

// 쓰기는 master 만 한다. 서버(assertWriteAllowed)가 이미 403 으로 막지만,
// 누를 수 없는 버튼을 보여 주면 눌러 보고 실패하는 경험이 된다.
const { me } = useAdminRole()
const canWrite = computed(() => me.value?.role === 'master')
const canEdit = computed(
  () => canWrite.value && def.value?.mode === 'crud' && def.value.pk.length === 1,
)
const canCreate = computed(
  () => canWrite.value && def.value?.mode === 'crud' && def.value.canCreate,
)
const pkValue = (row: Record<string, any>) => String(row[def.value!.pk[0]!])

watchEffect(() => {
  if (def.value) setHeader(def.value.label)
})

watch(() => route.params.table, () => {
  page.value = 1
  q.value = ''
  sortCol.value = ''
  sourceTab.value = 'all'
  rows.value = []
  load()
})
onMounted(load)
</script>

<template>
  <div v-if="!def" class="text-down">알 수 없는 테이블입니다.</div>
  <div v-else class="flex min-h-[calc(100vh-8rem)] flex-col">
    <!-- 상단바 액션 -->
    <Teleport to="#admin-topbar-actions">
      <AppButton variant="outline" color="neutral" icon="i-lucide-download" :loading="exporting" @click="exportExcel">
        엑셀 다운로드
      </AppButton>
      <AppButton v-if="canCreate" icon="i-lucide-plus" :to="`/${tableName}/new`">
        새로 만들기
      </AppButton>
    </Teleport>

    <DataTable
      :columns="tableColumns"
      :rows="rows"
      :loading="loading"
      :row-key="def.pk[0]"
      :sort-key="sortCol"
      :sort-dir="sortDir"
      :page="page"
      :page-size="pageSize"
      :total="total"
      selectable
      @sort="toggleSort"
      @update:page="changePage"
      @update:page-size="changePageSize"
    >
      <template #toolbar>
        <PillSearch
          v-if="def.searchColumns?.length"
          v-model="q"
          placeholder="검색어를 입력하세요"
          @search="search"
        />
        <!-- 공고 출처 필터 -->
        <div v-if="isJobs" class="flex items-center gap-1 rounded-full border border-hairline bg-white p-1">
          <button
            v-for="t in [{ k: 'all', l: '전체' }, { k: 'user', l: '사용자' }, { k: 'auto', l: '자동' }]"
            :key="t.k"
            type="button"
            class="rounded-full px-3.5 py-1.5 text-sm font-medium transition-colors"
            :class="sourceTab === t.k ? 'bg-brand-500 text-white' : 'text-body hover:text-ink'"
            @click="setTab(t.k as any)"
          >
            {{ t.l }}
          </button>
        </div>
      </template>

      <template #toolbar-end>
        <span class="text-sm text-muted tabular-nums">전체 {{ total.toLocaleString() }}건</span>
      </template>

      <template #actions="{ row }">
        <div class="flex justify-end gap-3">
          <button type="button" class="text-sm font-medium text-brand-500 hover:underline" @click="goDetail(row)">상세</button>
          <NuxtLink
            v-if="canEdit"
            :to="`/${tableName}/${encodeURIComponent(pkValue(row))}/edit`"
            class="text-sm font-medium text-body hover:text-ink"
          >
            수정
          </NuxtLink>
          <button v-if="canEdit" type="button" class="text-sm font-medium text-down hover:underline" @click="removeRow(row)">삭제</button>
        </div>
      </template>
    </DataTable>

    <!-- 상세 슬라이드오버 (복합키 로그) -->
    <USlideover v-model:open="detailOpen" :title="`${def.label} 상세`">
      <template #body>
        <div v-if="detailRow" class="space-y-2 text-sm">
          <div
            v-for="(val, key) in detailRow"
            :key="key"
            class="grid grid-cols-3 gap-2 border-b border-hairline-soft py-1.5"
          >
            <div class="col-span-1 text-muted">{{ labelFor(String(key)) }}</div>
            <div class="col-span-2 break-words whitespace-pre-wrap text-ink">{{ displayFull(val) }}</div>
          </div>
        </div>
      </template>
      <template #footer>
        <div class="flex justify-end gap-2">
          <AppButton v-if="detailRow && canEdit" color="down" variant="soft" size="sm" @click="removeRow(detailRow)">삭제</AppButton>
          <AppButton color="neutral" variant="outline" size="sm" @click="detailOpen = false">닫기</AppButton>
        </div>
      </template>
    </USlideover>
  </div>
</template>
