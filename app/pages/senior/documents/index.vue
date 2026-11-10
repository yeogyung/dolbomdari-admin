<!-- AI 문서 관리 — 목록·파일명 검색·상태 필터·정렬·최신 판만 보기 (GET /dbo-admin/documents, 상태는 서버가 날짜로 계산) -->
<script setup lang="ts">
import { ref, computed, watch, onMounted } from 'vue'
import type { Column } from '~/types/table'
import type { DocumentListItem, DocumentState, Worksite } from '~/types/dbo'
import { downloadExcel, excelStamp, type ExcelColumn } from '~/utils/excel'
import { docLineageKey, documentPage, documentsForExport } from '~/utils/documentGroups'

const api = useDboAdmin()
const toast = useToast()
const { setHeader } = useAdminHeader()
setHeader('AI 문서 관리')
/** 담당자는 목록·올리기만(QA 2026-11-07 MGR-05) — RLS 로 읽는 `ManagerDocuments` */
const isManager = computed(() => useAdminRole().me.value?.role === 'manager')

// 검색·필터·정렬·페이지는 주소에 담는다 — 상세에서 뒤로 오면 그대로다(QA 2026-10-11)
const lq = useListQuery(
  { page: 1, size: 20, q: '', state: '', versions: 'latest', sort: 'effective_date' },
  { committed: ['q'] },
)
const page = lq.page
const pageSize = lq.size
const q = lq.q
const sortKey = lq.sort
/** 상태 필터(QA 2026-11-07 ADMIN-12). 서버(`state`)가 줄마다의 상태와 같은 규칙으로 거른다 */
const stateFilter = lq.state
/**
 * 같은 문서의 판을 묶어 최신 판만 보인다(결정 D22, 기본). 서버에 「최신 판만」 조건이 없어 조건에 맞는 문서를 모두 받아
 * 판 계보(`lineage_id`)로 화면에서 묶고 쪽을 나눈다. 이전 판은 그 줄을 펼쳐 본다
 */
const versionsMode = lq.versions
const latestOnly = computed(() => versionsMode.value !== 'all')
const loading = ref(false)
const STATE_OPTIONS: { label: string; value: '' | DocumentState }[] = [
  { label: '상태 전체', value: '' },
  { label: '현행', value: '현행' },
  { label: '발효예정', value: '발효예정' },
  { label: '만료', value: '만료' },
  { label: '미정', value: '미정' },
  { label: '제외함', value: '제외함' },
]
/** 정해진 값만 보낸다 — 손으로 고친 주소면 서버가 400 으로 목록 전체를 막는다 */
const stateQuery = computed(() =>
  STATE_OPTIONS.some((o) => o.value && o.value === stateFilter.value) ? (stateFilter.value as DocumentState) : undefined,
)

/** 조건에 맞는 문서 전부(서버 정렬 순서). 쪽은 화면에서 나눈다 */
const all = ref<DocumentListItem[]>([])
/** 이전 판을 펼친 문서(계보 열쇠) */
const expanded = ref(new Set<string>())
const view = computed(() =>
  documentPage(all.value, { latestOnly: latestOnly.value, expanded: expanded.value, page: page.value, size: pageSize.value }),
)
const rows = computed(() => view.value.rows)
const total = computed(() => view.value.total)

const isExpanded = (row: DocumentListItem) => expanded.value.has(docLineageKey(row))
function toggleOlder(row: DocumentListItem) {
  const key = docLineageKey(row)
  const next = new Set(expanded.value)
  if (next.has(key)) next.delete(key)
  else next.add(key)
  expanded.value = next
}
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
  { key: 'created_by_name', label: '올린 사람' },
  { key: 'updated_at', label: '수정일', sortable: true },
]

/** 조회 순번 — 조건을 빠르게 바꾸면 늦게 온 이전 응답이 새 결과를 덮지 않게 마지막 요청만 반영한다 */
let sequence = 0
/** 조건(검색·상태·정렬)에 맞는 문서를 끝까지 받는다. 엑셀도 같은 조건이다 */
const fetchAll = () =>
  fetchAllPages(
    (p, size) => api.listDocuments({ page: p, size, q: lq.committedOf('q'), sort: sortKey.value, state: stateQuery.value }),
    (d) => d.id,
  )

async function load() {
  const current = ++sequence
  loading.value = true
  try {
    const items = await fetchAll()
    if (current !== sequence) return
    all.value = items
    // 줄어든 목록에서 빈 쪽에 남지 않게 한다
    const last = Math.max(1, Math.ceil(view.value.total / pageSize.value))
    if (page.value > last) page.value = last
  } catch (e: any) {
    if (current !== sequence) return
    toast.add({ title: '문서 조회 실패', description: dboErrorMessage(e), color: 'error' })
  } finally {
    if (current === sequence) loading.value = false
  }
}

/** 근무지 이름 목록이 왔는가(실패 포함). 오기 전에는 적용 범위가 id 로 보여 행을 미룬다 */
const worksitesSettled = ref(false)

async function loadWorksites() {
  try {
    // 근무지는 100곳을 넘는다 — 첫 페이지만 받으면 101번째부터 id 로 보인다
    worksites.value = await api.listAllWorksites()
  } catch {
    // 근무지 이름은 표기 편의다. 실패하면 id 로 보인다.
  } finally {
    worksitesSettled.value = true
  }
}

function search() {
  page.value = 1
  lq.commit()
  load()
}

function toggleSort(key: string) {
  sortKey.value = key
  page.value = 1
  load()
}

watch(stateFilter, search)
// 묶기·풀기는 받은 목록 그대로 화면에서만 바꾼다
watch(versionsMode, () => {
  page.value = 1
})

/* 엑셀 — 검색 조건 전체를 받아 내보낸다. 적용 범위는 「외 N곳」으로 줄이지 않고 다 쓴다 */
const { exporting, startExport, finishExport } = useExcelExport()
const EXCEL_COLUMNS: ExcelColumn[] = [
  { key: 'filename', label: '파일명' },
  { key: 'kind', label: '형식' },
  { key: 'version', label: '버전' },
  { key: 'state', label: '상태' },
  { key: 'effective_date', label: '발효일' },
  { key: 'expiry_date', label: '종료일' },
  { key: 'scope', label: '적용 범위' },
  { key: 'byte_size', label: '크기' },
  { key: 'created_by_name', label: '올린 사람' },
  { key: 'updated_at', label: '수정일' },
  { key: 'updated_by_name', label: '수정한 사람' },
]

async function exportExcel() {
  await startExport()
  try {
    // 화면과 같은 기준이다 — 최신 판만 보고 있으면 대표 판만 내보낸다
    const docs = documentsForExport(await fetchAll(), latestOnly.value)
    if (!docs.length) {
      toast.add({ title: '내보낼 문서가 없습니다.', color: 'warning' })
      return
    }
    const data = docs.map((d) => ({
      filename: d.filename,
      kind: d.kind,
      version: d.version ?? '',
      state: d.state,
      effective_date: d.effective_date ?? '',
      expiry_date: d.expiry_date ?? '무기한',
      scope: d.dbo_document_worksites.length
        ? d.dbo_document_worksites.map((w) => worksiteName(w.worksite_id)).join(', ')
        : '기관 전체',
      byte_size: fmtBytes(d.byte_size),
      // 이름을 모르면(옛 서버·예전 문서) 다른 칸처럼 빈 칸으로 둔다
      created_by_name: d.created_by_name ?? '',
      updated_at: excelStamp(d.updated_at),
      updated_by_name: docEditorName(d) ?? '',
    }))
    downloadExcel('AI문서', data, EXCEL_COLUMNS)
  } catch (e: any) {
    toast.add({ title: '엑셀 내보내기 실패', description: dboErrorMessage(e), color: 'error' })
  } finally {
    finishExport()
  }
}

onMounted(() => {
  if (isManager.value) return
  load()
  loadWorksites()
})
</script>

<template>
  <ManagerDocuments v-if="isManager" />
  <div v-else class="flex min-h-[calc(100vh-8rem)] flex-col">
    <Teleport to="#admin-topbar-actions">
      <AppButton
        variant="outline"
        color="neutral"
        icon="i-lucide-download"
        :loading="exporting"
        :disabled="!worksitesSettled"
        @click="exportExcel"
      >
        엑셀 다운로드
      </AppButton>
      <AppButton icon="i-lucide-file-plus" @click="navigateTo('/senior/documents/new')">문서 등록</AppButton>
    </Teleport>

    <DataTable
      :columns="columns"
      :rows="worksitesSettled ? rows : []"
      :loading="loading || !worksitesSettled"
      :sort-key="sortKey"
      :sort-dir="sortDir"
      :page="page"
      :page-size="pageSize"
      :total="total"
      :page-size-options="[20, 50, 100]"
      empty-text="등록된 AI 문서가 없습니다."
      @sort="toggleSort"
      @update:page="(p) => { page = p }"
      @update:page-size="(s) => { pageSize = s; page = 1 }"
    >
      <template #toolbar>
        <PillSearch v-model="q" placeholder="파일명 검색" @search="search" />
        <PillSelect v-model="stateFilter" :options="STATE_OPTIONS" />
        <PillSelect
          v-model="versionsMode"
          :options="[
            { label: '최신 판만', value: 'latest' },
            { label: '모든 판', value: 'all' },
          ]"
        />
      </template>
      <template #toolbar-end>
        <span class="text-sm text-muted tabular-nums">
          {{ latestOnly ? '문서' : '전체' }} {{ total.toLocaleString() }}건
          <template v-if="latestOnly && all.length > total"> · 판 {{ all.length.toLocaleString() }}개</template>
        </span>
      </template>

      <!-- 펼친 이전 판은 들여 쓰고 「이전 판」을 붙인다 -->
      <template #cell-filename="{ row }">
        <span v-if="row.older" class="inline-flex items-center gap-1.5 pl-4 font-normal text-body">
          <UIcon name="i-lucide-corner-down-right" class="size-3.5 text-muted" />
          {{ row.filename }}
          <Tag>이전 판</Tag>
        </span>
        <span v-else>{{ row.filename }}</span>
      </template>

      <template #cell-kind="{ row }">
        <Tag>{{ row.kind || '—' }}</Tag>
      </template>
      <template #cell-version="{ row }">
        {{ row.version || '—' }}
        <!-- 같은 문서의 이전 판(QA 2026-11-07 ADMIN-12, 결정 D22) — 누르면 바로 아래에 펼친다 -->
        <button
          v-if="(row.versions ?? 1) > 1"
          type="button"
          class="ml-1.5 text-sm font-medium text-brand-500 hover:underline"
          :aria-expanded="isExpanded(row as DocumentListItem)"
          @click="toggleOlder(row as DocumentListItem)"
        >
          {{ isExpanded(row as DocumentListItem) ? '이전 판 접기' : `이전 판 ${row.versions - 1}개` }}
        </button>
      </template>
      <template #cell-state="{ row }">
        <StatusBadge :tone="docStateTone(row.state)">{{ row.state }}</StatusBadge>
        <!-- AI 가 아직 읽지 못한 문서(결정 D16). 옛 서버는 칸이 없어 붙지 않는다 -->
        <StatusBadge v-if="row.indexed === false" tone="amber" class="ml-1.5">준비 중</StatusBadge>
        <!-- 날짜로는 현행인데 AI 는 같은 계보의 새 판을 쓴다(QA DOC-02). 옛 서버는 칸이 없어 붙지 않는다 -->
        <NuxtLink v-if="supersededLabel(row)" :to="`/senior/documents/${row.superseded_by.id}`" class="ml-1.5">
          <StatusBadge tone="amber">{{ supersededLabel(row) }}</StatusBadge>
        </NuxtLink>
      </template>
      <template #cell-effective_date="{ row }">{{ row.effective_date || '—' }}</template>
      <template #cell-expiry_date="{ row }">{{ row.expiry_date || '무기한' }}</template>
      <template #cell-scope="{ row }">{{ docScopeLabel(row, worksiteName) }}</template>
      <template #cell-byte_size="{ row }">
        <span class="tabular-nums">{{ fmtBytes(row.byte_size) }}</span>
      </template>
      <!-- 올린 사람·고친 사람은 그때 이름이다(QA DOC-03). 모르면(옛 서버·예전 문서) 비운다 -->
      <template #cell-created_by_name="{ row }">{{ row.created_by_name || '—' }}</template>
      <template #cell-updated_at="{ row }">
        {{ fmtStamp(row.updated_at) }}<span v-if="docEditorName(row)" class="text-muted"> · {{ docEditorName(row) }}</span>
      </template>

      <template #actions="{ row }">
        <NuxtLink :to="`/senior/documents/${row.id}`" class="text-sm font-medium text-brand-500 hover:underline">
          상세
        </NuxtLink>
      </template>
    </DataTable>
  </div>
</template>
