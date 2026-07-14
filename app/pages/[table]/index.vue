<!-- 테이블 목록 — 넘버링 + 정렬 + 검색 + 상세 보기 + 엑셀 + (공고)출처 탭 + 행별 수정/삭제 -->
<script setup lang="ts">
import { getTable } from '#shared/tables'
import { downloadExcel, type ExcelColumn } from '~/utils/excel'

const route = useRoute()
const api = useAdminApi()
const toast = useToast()

const tableName = computed(() => String(route.params.table))
const def = computed(() => getTable(tableName.value))

const rows = ref<Record<string, any>[]>([])
const total = ref(0)
const page = ref(1)
const pageSize = ref(20)
const q = ref('')
const loading = ref(false)
const exporting = ref(false)

// 정렬 상태 (빈 값이면 서버 기본 정렬)
const sortCol = ref('')
const sortDir = ref<'asc' | 'desc'>('asc')

// 공고 출처 탭: all | user(직접등록) | auto(자동수집)
const sourceTab = ref<'all' | 'user' | 'auto'>('all')
const isJobs = computed(() => tableName.value === 'jobs')

// 상세 보기 슬라이드오버
const detailOpen = ref(false)
const detailRow = ref<Record<string, any> | null>(null)

// 표시 컬럼: 난수 id 제외 (넘버링으로 대체)
const columns = computed<string[]>(() => {
  const base = def.value?.listColumns ?? (rows.value[0] ? Object.keys(rows.value[0]) : [])
  return base.filter((c) => c !== 'id')
})

function labelFor(col: string): string {
  return def.value?.fields.find((f) => f.name === col)?.label || col
}

function display(value: unknown): string {
  if (value === null || value === undefined || value === '') return '—'
  if (Array.isArray(value)) return value.join(', ')
  if (typeof value === 'boolean') return value ? '✓' : '✗'
  const s = String(value)
  return s.length > 60 ? s.slice(0, 60) + '…' : s
}

function displayFull(value: unknown): string {
  if (value === null || value === undefined || value === '') return '—'
  if (Array.isArray(value)) return value.join(', ')
  if (typeof value === 'boolean') return value ? '✓' : '✗'
  if (typeof value === 'object') return JSON.stringify(value, null, 2)
  return String(value)
}

function rowNo(i: number): number {
  return (page.value - 1) * pageSize.value + i + 1
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

function openDetail(row: Record<string, any>) {
  detailRow.value = row
  detailOpen.value = true
}

// 단일키 테이블은 상세 페이지로 이동, 복합키(로그)는 슬라이드오버로 표시
function goDetail(row: Record<string, any>) {
  if (def.value?.pk.length === 1) {
    navigateTo(`/${tableName.value}/${encodeURIComponent(pkValue(row))}`)
  } else {
    openDetail(row)
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

const canEdit = computed(() => def.value?.mode === 'crud' && def.value.pk.length === 1)
const canCreate = computed(() => def.value?.mode === 'crud' && def.value.canCreate)
const pkValue = (row: Record<string, any>) => String(row[def.value!.pk[0]!])

watch(() => route.params.table, () => {
  page.value = 1
  q.value = ''
  sortCol.value = ''
  sourceTab.value = 'all'
  rows.value = []
  load()
})
watch(page, load)
onMounted(load)
</script>

<template>
  <div v-if="!def">
    <p class="text-red-600">알 수 없는 테이블입니다.</p>
  </div>
  <div v-else>
    <div class="mb-4 flex items-center justify-between gap-3">
      <h1 class="text-xl font-bold">{{ def.label }}</h1>
      <div class="flex items-center gap-2">
        <UButton :loading="exporting" variant="outline" color="neutral" icon="i-heroicons-arrow-down-tray" @click="exportExcel">
          엑셀 다운로드
        </UButton>
        <UButton v-if="canCreate" :to="`/${tableName}/new`" color="primary" icon="i-heroicons-plus">
          새로 만들기
        </UButton>
      </div>
    </div>

    <!-- 공고 출처 탭 -->
    <div v-if="isJobs" class="mb-3 flex gap-1">
      <UButton
        v-for="t in [{ k: 'all', l: '전체' }, { k: 'user', l: '사용자 생성' }, { k: 'auto', l: '자동 생성' }]"
        :key="t.k"
        size="sm"
        :variant="sourceTab === t.k ? 'solid' : 'ghost'"
        :color="sourceTab === t.k ? 'primary' : 'neutral'"
        @click="setTab(t.k as any)"
      >
        {{ t.l }}
      </UButton>
    </div>

    <div v-if="def.searchColumns?.length" class="mb-3 flex gap-2">
      <UInput v-model="q" placeholder="검색어" class="w-64" @keyup.enter="search" />
      <UButton variant="soft" color="neutral" @click="search">검색</UButton>
    </div>

    <div class="overflow-x-auto rounded-lg border border-gray-200 bg-white">
      <table class="min-w-full text-sm">
        <thead class="bg-gray-50 text-left text-gray-600">
          <tr>
            <th class="w-14 px-3 py-2 font-medium">No.</th>
            <th
              v-for="col in columns"
              :key="col"
              class="cursor-pointer select-none whitespace-nowrap px-3 py-2 font-medium hover:text-primary-600"
              @click="toggleSort(col)"
            >
              <span class="inline-flex items-center gap-1">
                {{ labelFor(col) }}
                <span v-if="sortCol === col" class="text-primary-600">{{ sortDir === 'asc' ? '▲' : '▼' }}</span>
              </span>
            </th>
            <th class="px-3 py-2 text-right font-medium">작업</th>
          </tr>
        </thead>
        <tbody class="divide-y divide-gray-100">
          <tr v-if="loading">
            <td :colspan="columns.length + 2"><Spinner label="불러오는 중…" /></td>
          </tr>
          <tr v-else-if="!rows.length">
            <td :colspan="columns.length + 2" class="px-3 py-8 text-center text-gray-400">데이터가 없습니다.</td>
          </tr>
          <tr
            v-for="(row, i) in rows"
            :key="i"
            class="cursor-pointer hover:bg-gray-50"
            @click="goDetail(row)"
          >
            <td class="px-3 py-2 text-gray-400">{{ rowNo(i) }}</td>
            <td v-for="col in columns" :key="col" class="whitespace-nowrap px-3 py-2 text-gray-700">
              {{ display(row[col]) }}
            </td>
            <td class="whitespace-nowrap px-3 py-2 text-right" @click.stop>
              <div class="flex justify-end gap-1">
                <UButton size="xs" variant="ghost" color="neutral" @click="goDetail(row)">상세</UButton>
                <UButton v-if="canEdit" size="xs" variant="ghost" :to="`/${tableName}/${encodeURIComponent(pkValue(row))}/edit`">
                  수정
                </UButton>
                <UButton size="xs" variant="ghost" color="error" @click="removeRow(row)">삭제</UButton>
              </div>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <div class="mt-4 flex items-center justify-between">
      <p class="text-sm text-gray-500">총 {{ total.toLocaleString() }}건</p>
      <UPagination v-model:page="page" :total="total" :items-per-page="pageSize" />
    </div>

    <!-- 상세 보기 슬라이드오버 -->
    <USlideover v-model:open="detailOpen" :title="`${def.label} 상세`">
      <template #body>
        <div v-if="detailRow" class="space-y-2 text-sm">
          <div
            v-for="(val, key) in detailRow"
            :key="key"
            class="grid grid-cols-3 gap-2 border-b border-gray-100 py-1.5"
          >
            <div class="col-span-1 text-gray-500">{{ labelFor(String(key)) }}</div>
            <div class="col-span-2 whitespace-pre-wrap break-words text-gray-800">{{ displayFull(val) }}</div>
          </div>
        </div>
      </template>
      <template #footer>
        <div class="flex justify-end gap-2">
          <UButton
            v-if="canEdit && detailRow"
            color="primary"
            :to="`/${tableName}/${encodeURIComponent(pkValue(detailRow))}`"
          >
            수정
          </UButton>
          <UButton v-if="detailRow" color="error" variant="soft" @click="removeRow(detailRow)">삭제</UButton>
          <UButton color="neutral" variant="ghost" @click="detailOpen = false">닫기</UButton>
        </div>
      </template>
    </USlideover>
  </div>
</template>
