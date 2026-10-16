<!-- 테이블 목록 — 헤더(상단바) + 툴바(검색·탭) + DataTable(정렬·페이지네이션·엑셀·행 액션) -->
<script setup lang="ts">
import { ref, computed, watch, watchEffect, onMounted, type Ref } from 'vue'
import { getTable } from '#shared/tables'
import { downloadExcel, excelStamp, type ExcelColumn } from '~/utils/excel'
import type { Column } from '~/types/table'
import { ORG_APPROVAL_STATUSES, orgApprovalLabel, orgApprovalTone, type OrgApprovalStatus } from '#shared/orgApproval'

const route = useRoute()
const api = useAdminApi()
const toast = useToast()
/** 행 삭제 중복 클릭 방지 — 행마다 있는 일반 버튼이 잠금 하나를 나눠 쓴다 */
const removeGuard = createClickGuard()
const { setHeader } = useAdminHeader()

const tableName = computed(() => String(route.params.table))
const def = computed(() => getTable(tableName.value))

const rows = ref<Record<string, any>[]>([])
const total = ref(0)
// 검색·탭·정렬·페이지는 주소에 담는다 — 상세에 다녀와도 목록 조건이 그대로다. 검색어는 「검색」 때 싣는다
const lq = useListQuery(
  { page: 1, size: 20, q: '', sort: '', dir: 'asc', source: 'all', approval: 'all' },
  { committed: ['q'] },
)
const page = lq.page
const pageSize = lq.size
const q = lq.q
const loading = ref(false)
const { exporting, startExport, finishExport } = useExcelExport()

const sortCol = lq.sort
const sortDir = lq.dir as Ref<'asc' | 'desc'>

const sourceTab = lq.source as Ref<'all' | 'user' | 'auto'>
const isJobs = computed(() => tableName.value === 'jobs')

// 기관 담당자: 가입 검토 상태 필터 + 승인대기 건수
const approvalTab = lq.approval as Ref<'all' | OrgApprovalStatus>
const isOrgManager = computed(() => tableName.value === 'organization_manager')
const pendingCount = ref(0)

const detailOpen = ref(false)
const detailRow = ref<Record<string, any> | null>(null)

function labelFor(col: string): string {
  const ref = def.value?.refs?.find((r) => `${r.column}__ref` === col)
  if (ref) return ref.label
  const count = def.value?.counts?.find((c) => c.key === col)
  if (count) return count.label
  return def.value?.fields.find((f) => f.name === col)?.label || col
}

/** 레지스트리에서 시각(datetime)으로 정의한 컬럼 — 목록·엑셀에서 서울 시각으로 바꿔 보인다 */
const datetimeKeys = computed(() => new Set(def.value?.fields.filter((f) => f.type === 'datetime').map((f) => f.name)))

const tableColumns = computed<Column[]>(() => {
  const base = def.value?.listColumns ?? (rows.value[0] ? Object.keys(rows.value[0]) : [])
  return base
    .filter((c) => c !== 'id')
    .map((key, idx) => ({
      key,
      label: labelFor(key),
      // 해석(__ref)·집계 컬럼은 DB 컬럼이 아니라 서버 정렬 불가
      sortable: !key.endsWith('__ref') && !def.value?.counts?.some((c) => c.key === key),
      strong: idx === 0,
      // DB 는 UTC ISO 로 준다 — 원문 그대로면 서울보다 9시간 이르게 보인다
      format: datetimeKeys.value.has(key) ? (v: unknown) => fmtDateTime(v as string | null) : undefined,
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
  if (isOrgManager.value && approvalTab.value !== 'all') {
    return { f: 'approval_status', op: 'eq' as const, v: approvalTab.value }
  }
  if (!isJobs.value || sourceTab.value === 'all') return {}
  return sourceTab.value === 'user'
    ? { f: 'source', op: 'eq' as const, v: 'manual' }
    : { f: 'source', op: 'neq' as const, v: 'manual' }
}

// 목록과 따로 실패를 알린다 — 목록은 그려졌는데 "목록 조회 실패"가 뜨지 않게
async function loadPendingCount() {
  try {
    const res = await api.list('organization_manager', { pageSize: 1, f: 'approval_status', op: 'eq', v: 'pending' })
    pendingCount.value = res.total
  } catch (e: any) {
    toast.add({ title: '승인대기 건수 조회 실패', description: e?.data?.statusMessage || e.message, color: 'error' })
  }
}

/** 조회 순번 — 조건을 빠르게 바꾸면 늦게 온 이전 응답이 새 결과를 덮지 않게 마지막 요청만 반영한다 */
let sequence = 0
async function load() {
  if (!def.value) return
  if (isOrgManager.value) loadPendingCount()
  const current = ++sequence
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
    if (current !== sequence) return
    rows.value = res.rows
    total.value = res.total
  } catch (e: any) {
    if (current !== sequence) return
    toast.add({ title: '목록 조회 실패', description: e?.data?.statusMessage || e.message, color: 'error' })
  } finally {
    if (current === sequence) loading.value = false
  }
}

function search() {
  page.value = 1
  lq.commit()
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

function setApprovalTab(tab: 'all' | OrgApprovalStatus) {
  approvalTab.value = tab
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
  await startExport()
  try {
    const res = await api.list(tableName.value, { all: true, q: q.value, ...sourceFilter() })
    const keys = res.rows[0] ? Object.keys(res.rows[0]) : (def.value.listColumns ?? [])
    const cols: ExcelColumn[] = keys.map((key) => ({ key, label: labelFor(key) }))
    // 엑셀도 UTC 원문 대신 서울 시각(YYYY-MM-DD HH:MM)으로 내보낸다
    const rows = res.rows.map((r) => {
      const out = { ...r }
      for (const k of datetimeKeys.value) if (k in out) out[k] = excelStamp(out[k])
      return out
    })
    downloadExcel(`${def.value.label}_${tableName.value}`, rows, cols)
    // 서버 상한(10000행)에 걸리면 파일이 전체가 아니다 — 조용히 넘기지 않는다
    if (res.total > res.rows.length) {
      toast.add({
        title: `전체 ${res.total.toLocaleString()}건 중 ${res.rows.length.toLocaleString()}건만 내보냈습니다.`,
        description: '검색어로 범위를 좁혀 다시 내보내 주세요.',
        color: 'warning',
      })
    }
  } catch (e: any) {
    toast.add({ title: '엑셀 내보내기 실패', description: e?.data?.statusMessage || e.message, color: 'error' })
  } finally {
    finishExport()
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
  approvalTab.value = 'all'
  // 정해 둔 검색어도 비운다 — 안 비우면 다른 테이블 주소에 앞 테이블 검색어가 실린다
  lq.commit()
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
      <!-- AppButton 은 <button> 이라 to 가 없다 — 눌러도 이동하지 않던 버그 -->
      <AppButton v-if="canCreate" icon="i-lucide-plus" @click="navigateTo(`/${tableName}/new`)">
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
        <!-- 기관 담당자 가입 검토 상태 필터 -->
        <div v-if="isOrgManager" class="flex items-center gap-1 rounded-full border border-hairline bg-white p-1">
          <button
            v-for="t in [{ value: 'all', label: '전체' }, ...ORG_APPROVAL_STATUSES]"
            :key="t.value"
            type="button"
            class="rounded-full px-3.5 py-1.5 text-sm font-medium transition-colors"
            :class="approvalTab === t.value ? 'bg-brand-500 text-white' : 'text-body hover:text-ink'"
            @click="setApprovalTab(t.value as any)"
          >
            {{ t.label }}<span v-if="t.value === 'pending' && pendingCount" class="ml-1 tabular-nums">{{ pendingCount }}</span>
          </button>
        </div>
      </template>

      <template #cell-approval_status="{ value }">
        <StatusBadge :tone="orgApprovalTone(String(value))">{{ orgApprovalLabel(String(value)) }}</StatusBadge>
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
          <button v-if="canEdit" type="button" class="text-sm font-medium text-down hover:underline disabled:opacity-50" :disabled="removeGuard.pending.value" @click="removeGuard.run(() => removeRow(row))">삭제</button>
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
