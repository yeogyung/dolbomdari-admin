<!-- 명부 관리 — 시니어·담당자·수요처 목록/검색/역할·상태 필터 + 신규 등록 (GET·POST /dbo-admin/directory) -->
<script setup lang="ts">
import { ref, computed, watch, onMounted, type Ref } from 'vue'
import type { Column } from '~/types/table'
import type { Assignment, DirectoryEntry, LifeStatus, Program, Worksite } from '~/types/dbo'
import { downloadExcel, excelStamp, type ExcelColumn } from '~/utils/excel'
import { nextSort, type SortDir } from '~/utils/sortToggle'
import { rosterSiteCells } from '~/utils/rosterSites'
import {
  assignmentWorksiteOptions,
  bulkAssignErrorMessage,
  bulkAssignFormErrors,
  bulkAssignTargets,
  bulkUnassignErrorMessage,
  isShiftSyncFailed,
  personLine,
  type BulkAssignForm,
} from '~/utils/bulkAssign'
import { failureLines, runSequential } from '~/utils/bulkRun'

const api = useDboAdmin()
const toast = useToast()
const { setHeader } = useAdminHeader()
setHeader('명부 관리')

const rows = ref<DirectoryEntry[]>([])
const total = ref(0)
// 검색·필터·정렬·페이지는 주소에 담는다 — 상세에서 뒤로 오면 그대로다(QA 2026-10-11)
const lq = useListQuery({
  page: 1,
  size: 20,
  q: '',
  status: '',
  role: '',
  worksite: '',
  sort: 'created_at',
  dir: 'asc',
}, { committed: ['q'] })
const page = lq.page
const pageSize = lq.size
const q = lq.q
const statusFilter = lq.status as Ref<'' | LifeStatus>
const roleFilter = lq.role as Ref<'' | 'senior' | 'manager' | 'worksite'>
/** 근무지 필터 — 배정된 시니어 · 근무지 담당자 · 수요처 계정(서버 `worksiteId`) */
const worksiteFilter = lq.worksite
const sortKey = lq.sort
/** 같은 머리글을 다시 누르면 뒤집힌다 — 이름 가나다순·역순(QA 2026-10-11) */
const sortDir = lq.dir as Ref<SortDir>
const loading = ref(false)

const columns: Column[] = [
  { key: 'name', label: '이름', sortable: true, strong: true },
  { key: 'phone', label: '전화번호' },
  { key: 'role', label: '역할' },
  // 근무지·사업(QA 2026-11-07 ADMIN-02) — 동명이인을 상세에 들어가지 않고 가른다. 여러 곳이면 첫 하나 외 N
  { key: 'worksites', label: '근무지' },
  { key: 'programs', label: '사업' },
  { key: 'status', label: '상태', sortable: true },
  { key: 'app', label: '앱 연결' },
  { key: 'memo', label: '메모' },
  { key: 'created_at', label: '등록일', sortable: true },
]

/** 조회 순번 — 조건을 빠르게 바꾸면 늦게 온 이전 응답이 새 결과를 덮지 않게 마지막 요청만 반영한다 */
let sequence = 0
async function load() {
  const current = ++sequence
  loading.value = true
  try {
    const res = await api.listDirectory({
      page: page.value,
      size: pageSize.value,
      q: lq.committedOf('q'),
      sort: sortKey.value,
      dir: sortDir.value,
      status: statusFilter.value || undefined,
      role: roleFilter.value || undefined,
      worksiteId: worksiteFilter.value || undefined,
    })
    if (current !== sequence) return
    rows.value = res.items
    total.value = res.total
  } catch (e: any) {
    if (current !== sequence) return
    toast.add({ title: '명부 조회 실패', description: dboErrorMessage(e), color: 'error' })
  } finally {
    if (current === sequence) loading.value = false
  }
}

function search() {
  page.value = 1
  lq.commit()
  load()
}

watch([statusFilter, roleFilter, worksiteFilter], search)

function toggleSort(key: string) {
  const next = nextSort({ key: sortKey.value, dir: sortDir.value }, key)
  sortKey.value = next.key
  sortDir.value = next.dir
  page.value = 1
  load()
}

/* 엑셀 — 조회 조건 전체를 받아 내보낸다 */
const { exporting, startExport, finishExport } = useExcelExport()
const EXCEL_COLUMNS: ExcelColumn[] = [
  { key: 'name', label: '이름' },
  { key: 'phone', label: '전화번호' },
  { key: 'role', label: '역할' },
  { key: 'worksites', label: '근무지' },
  { key: 'programs', label: '사업' },
  { key: 'status', label: '상태' },
  { key: 'memo', label: '메모' },
  { key: 'created_at', label: '등록일' },
]

function toExcelRow(r: DirectoryEntry) {
  // 엑셀은 「외 N」으로 줄이지 않고 다 쓴다
  const sites = rosterSiteCells(r.worksites)
  return {
    name: r.name,
    phone: r.phone ? fmtPhone(r.phone) : (r.email ?? ''),
    role: ROLE_LABELS[r.role] ?? r.role,
    worksites: sites?.fullWorksites ?? '',
    programs: sites?.fullPrograms ?? '',
    status: lifeStatusLabel(r.status),
    memo: r.memo ?? '',
    created_at: excelStamp(r.created_at),
  }
}

/*
 * 선택 다운로드(QA 2026-10-14 9번). 고른 사람이 있으면 그 사람만, 없으면 조회 조건 전체.
 * 페이지를 넘겨도 선택은 남으므로 고른 행 자체를 따로 들고 있는다.
 */
const selectedIds = ref<string[]>([])
const picked = new Map<string, DirectoryEntry>()
watch(selectedIds, (ids) => {
  for (const row of rows.value) if (ids.includes(row.id)) picked.set(row.id, row)
  for (const id of [...picked.keys()]) if (!ids.includes(id)) picked.delete(id)
})

async function exportExcel() {
  if (selectedIds.value.length > 0) {
    const chosen = selectedIds.value.map((id) => picked.get(id)).filter((r) => !!r)
    downloadExcel('명부_선택', chosen.map(toExcelRow), EXCEL_COLUMNS)
    return
  }
  await startExport()
  try {
    const all = await fetchAllPages(
      (p, size) =>
        api.listDirectory({
          page: p,
          size,
          q: lq.committedOf('q'),
          sort: sortKey.value,
          dir: sortDir.value,
          status: statusFilter.value || undefined,
          role: roleFilter.value || undefined,
          worksiteId: worksiteFilter.value || undefined,
        }),
      (r) => r.id,
    )
    if (!all.length) {
      toast.add({ title: '내보낼 명부가 없습니다.', color: 'warning' })
      return
    }
    downloadExcel('명부', all.map(toExcelRow), EXCEL_COLUMNS)
  } catch (e: any) {
    toast.add({ title: '엑셀 내보내기 실패', description: dboErrorMessage(e), color: 'error' })
  } finally {
    finishExport()
  }
}

/** 고른 사람 — 페이지를 넘겨도 남는다(위 `picked`) */
const chosenPeople = () => selectedIds.value.map((id) => picked.get(id)).filter((r): r is DirectoryEntry => !!r)

/*
 * 여러 명 같은 근무 배정(QA 2026-11-07 SHIFT-02 · SHIFT-09, 결정 D25) — 고른 사람에게 근무지·요일·시간·기간을 한 번 입력해
 * 배정한다. 일괄 API 가 없어 명부 상세의 「배정 추가」와 같은 단건 저장을 사람마다 차례로 부른다. 일부가 실패해도(겹친 배정 등)
 * 된 사람은 그대로 두고 실패 명단을 보인다. 배정은 시니어에게만, 사업은 고른 근무지의 사업을 따른다(명부 상세와 같다)
 */
const bulkAssignOpen = ref(false)
const bulkTargets = ref<{ targets: DirectoryEntry[]; skipped: { row: DirectoryEntry; reason: string }[] }>({
  targets: [],
  skipped: [],
})
const emptyBulkForm = (): BulkAssignForm => ({
  worksiteId: null,
  weekdays: [],
  startTime: '09:00',
  endTime: '11:00',
  periodStart: null,
  periodEnd: null,
})
const bulkForm = ref<BulkAssignForm>(emptyBulkForm())
const bulkTried = ref(false)
const bulkErrors = computed(() => bulkAssignFormErrors(bulkForm.value))
const bulkRunning = ref(false)
const bulkProgress = ref<{ finished: number; total: number } | null>(null)
const bulkResult = ref<{
  done: number
  failed: { name: string; reason: string }[]
  /** 배정은 저장됐지만 오늘·내일 근무 정리만 실패한 사람 */
  syncFailed: string[]
} | null>(null)
const skippedPeople = (list: { row: DirectoryEntry; reason: string }[]) =>
  list.map((s) => ({ name: personLine(s.row), reason: s.reason }))

function openBulkAssign() {
  if (bulkRunning.value) return
  bulkTargets.value = bulkAssignTargets(chosenPeople())
  bulkForm.value = emptyBulkForm()
  bulkTried.value = false
  bulkProgress.value = null
  bulkResult.value = null
  bulkAssignOpen.value = true
  loadRefs()
}

async function submitBulkAssign() {
  bulkTried.value = true
  if (Object.keys(bulkErrors.value).length > 0) return
  const f = { ...bulkForm.value, weekdays: [...bulkForm.value.weekdays] }
  const site = worksites.value.find((w) => w.id === f.worksiteId)
  const targets = bulkTargets.value.targets
  const syncFailed: string[] = []
  bulkRunning.value = true
  bulkProgress.value = { finished: 0, total: targets.length }
  try {
    const result = await runSequential(
      targets,
      async (p) => {
        try {
          await api.createAssignment({
            directoryId: p.id,
            worksiteId: f.worksiteId!,
            programId: site?.program_id ?? null,
            weekdays: f.weekdays,
            startTime: f.startTime,
            endTime: f.endTime,
            periodStart: f.periodStart,
            periodEnd: f.periodEnd,
          })
        } catch (e) {
          // 배정은 저장됐다 — 실패로 세면 다시 눌러 같은 배정을 또 만든다(명부 상세의 단건 저장과 같은 판단)
          if (!isShiftSyncFailed(e)) throw e
          syncFailed.push(personLine(p))
        }
      },
      (finished, total) => (bulkProgress.value = { finished, total }),
    )
    bulkResult.value = {
      done: result.done.length,
      failed: failureLines(result.failed, personLine, (e) => bulkAssignErrorMessage(e) ?? dboErrorMessage(e)),
      syncFailed,
    }
  } finally {
    bulkRunning.value = false
  }
  load()
}

/*
 * 배정 일괄 삭제(QA 2026-11-07 SHIFT-09 「교육 후 일괄 삭제」) — 고른 사람들의 한 근무지 배정을 지운다. 명부 상세의 「삭제」와
 * 같은 단건 삭제(DELETE /assignments/{id})를 차례로 부른다 — 서버는 배정 행을 지우고 앞으로의 기록 없는 근무를 정리하며,
 * 이미 생긴 출퇴근 기록은 남긴다. 실수로 모든 배정을 지우지 않게 근무지를 하나 골라야 지운다
 */
const unassignOpen = ref(false)
const unassignLoading = ref(false)
const unassignLoadError = ref('')
const unassignList = ref<{ assignment: Assignment; person: DirectoryEntry }[]>([])
const unassignSkipped = ref<{ row: DirectoryEntry; reason: string }[]>([])
const unassignWorksite = ref<string | null>(null)
const unassignOptions = computed(() =>
  assignmentWorksiteOptions(
    unassignList.value.map((x) => x.assignment),
    (wid) => worksites.value.find((w) => w.id === wid)?.name ?? wid,
  ),
)
const unassignTargets = computed(() =>
  unassignWorksite.value ? unassignList.value.filter((x) => x.assignment.worksite_id === unassignWorksite.value) : [],
)
const unassignLine = (x: { assignment: Assignment; person: DirectoryEntry }) =>
  `${personLine(x.person)} · ${assignmentLine(x.assignment)}`

async function openUnassign() {
  if (bulkRunning.value) return
  const split = bulkAssignTargets(chosenPeople())
  // 배정은 시니어에게만 있다. 종료된 시니어의 배정도 지울 수 있어 상태로는 빼지 않는다
  const seniors = chosenPeople().filter((p) => p.role === 'senior')
  unassignSkipped.value = split.skipped.filter((s) => s.row.role !== 'senior')
  unassignList.value = []
  unassignWorksite.value = null
  unassignLoadError.value = ''
  bulkProgress.value = null
  bulkResult.value = null
  unassignOpen.value = true
  loadRefs()
  unassignLoading.value = true
  try {
    const found: { assignment: Assignment; person: DirectoryEntry }[] = []
    for (const person of seniors) {
      const res = await api.listAssignments({ directoryId: person.id, size: 100 })
      for (const a of res.items) found.push({ assignment: a, person })
    }
    unassignList.value = found
    // 근무지가 하나뿐이면 미리 고른다
    if (unassignOptions.value.length === 1) unassignWorksite.value = unassignOptions.value[0]!.value
  } catch (e: any) {
    unassignLoadError.value = dboErrorMessage(e, '배정을 불러오지 못했습니다.')
  } finally {
    unassignLoading.value = false
  }
}

async function submitUnassign() {
  const targets = unassignTargets.value
  if (!targets.length) return
  bulkRunning.value = true
  bulkProgress.value = { finished: 0, total: targets.length }
  try {
    const result = await runSequential(
      targets,
      (x) => api.deleteAssignment(x.assignment.id),
      (finished, total) => (bulkProgress.value = { finished, total }),
    )
    bulkResult.value = {
      done: result.done.length,
      failed: failureLines(result.failed, unassignLine, (e) => bulkUnassignErrorMessage(e) ?? dboErrorMessage(e)),
      syncFailed: [],
    }
  } finally {
    bulkRunning.value = false
  }
  load()
}

/* 일괄 등록(QA 2026-10-14 10번) — 창을 닫을 때 목록을 다시 읽는다 */
const bulkOpen = ref(false)

/* 신규 등록 */
const createOpen = ref(false)
const saving = ref(false)
type CreateRole = 'senior' | 'manager' | 'worksite'
const emptyForm = () => ({
  name: '',
  phone: '',
  role: 'senior' as CreateRole,
  memo: '',
  /** 담당자 — 맡을 수요처들 */
  worksiteIds: [] as string[],
  /** 수요처 담당자 — 근무지 1곳 */
  worksiteId: null as string | null,
})
const form = ref(emptyForm())

/* 근무지·사업 — 담당자·수요처 담당자 등록에서 고른다. 처음 열 때 한 번 받는다 */
const worksites = ref<Worksite[]>([])
const programs = ref<Program[]>([])
const refsLoaded = ref(false)
const refsLoading = ref(false)

async function loadRefs() {
  if (refsLoaded.value || refsLoading.value) return
  refsLoading.value = true
  try {
    const [ws, pg] = await Promise.all([api.listAllWorksites(), api.listPrograms()])
    worksites.value = ws
    programs.value = pg.items.filter((p) => p.status === 'active')
    refsLoaded.value = true
  } catch (e: any) {
    toast.add({ title: '근무지 목록 조회 실패', description: dboErrorMessage(e), color: 'error' })
  } finally {
    refsLoading.value = false
  }
}

/** 새 담당자에게 다른 담당자가 있던 근무지는 넘어온다 */
const takenByOther = (w: Worksite) => !!w.care_manager_directory_id

function openCreate() {
  form.value = emptyForm()
  createOpen.value = true
  loadRefs()
}

async function submitCreate() {
  const f = form.value
  if (!f.name.trim() || !f.phone.trim()) {
    toast.add({ title: '이름과 전화번호를 입력해 주세요.', color: 'warning' })
    return
  }
  if (f.role === 'worksite' && !f.worksiteId) {
    toast.add({ title: '수요처 담당자의 근무지를 선택해 주세요.', color: 'warning' })
    return
  }
  if (f.role === 'manager') {
    const moving = worksites.value.filter((w) => f.worksiteIds.includes(w.id) && takenByOther(w))
    if (
      moving.length &&
      !confirm(
        `${moving.map((w) => w.name).join(', ')} 은(는) 다른 담당자가 맡고 있습니다. 새 담당자로 옮기시겠습니까?`,
      )
    )
      return
  }
  saving.value = true
  try {
    await api.createDirectory({
      name: f.name.trim(),
      phone: f.phone.trim(),
      role: f.role,
      memo: f.memo.trim() || null,
      // 역할에 맞는 값만 보낸다 — 서버는 맞지 않는 값을 400 으로 거절한다
      ...(f.role === 'manager' ? { worksiteIds: f.worksiteIds } : {}),
      ...(f.role === 'worksite' ? { worksiteId: f.worksiteId! } : {}),
    })
    // 담당자 지정이 근무지 쪽 칸을 바꿨으므로 다음 등록 때 다시 받는다
    if (f.role === 'manager' && f.worksiteIds.length) refsLoaded.value = false
    toast.add({ title: '등록되었습니다.', color: 'success' })
    createOpen.value = false
    page.value = 1
    load()
  } catch (e: any) {
    toast.add({ title: '등록 실패', description: dboErrorMessage(e), color: 'error' })
  } finally {
    saving.value = false
  }
}

onMounted(() => {
  load()
  // 근무지 필터의 선택지. 등록 창도 같은 목록을 쓴다
  void loadRefs()
})
</script>

<template>
  <div class="flex min-h-[calc(100vh-8rem)] flex-col">
    <Teleport to="#admin-topbar-actions">
      <AppButton variant="outline" color="neutral" icon="i-lucide-download" :loading="exporting" @click="exportExcel">
        {{ selectedIds.length ? `선택 ${selectedIds.length}명 다운로드` : '엑셀 다운로드' }}
      </AppButton>
      <AppButton variant="outline" color="neutral" icon="i-lucide-users" @click="bulkOpen = true">일괄 등록</AppButton>
      <AppButton icon="i-lucide-user-plus" @click="openCreate">명부 등록</AppButton>
    </Teleport>
    <SeniorBulkImportModal v-model:open="bulkOpen" @done="load" />

    <DataTable
      :columns="columns"
      :rows="rows"
      :loading="loading"
      :sort-key="sortKey"
      :sort-dir="sortDir"
      :page="page"
      :page-size="pageSize"
      :total="total"
      :page-size-options="[20, 50, 100]"
      selectable
      v-model:selected="selectedIds"
      empty-text="등록된 시니어·담당자가 없습니다."
      @sort="toggleSort"
      @update:page="(p) => { page = p; load() }"
      @update:page-size="(s) => { pageSize = s; page = 1; load() }"
    >
      <template #toolbar>
        <PillSearch v-model="q" placeholder="이름 또는 전화번호" @search="search" />
        <PillSelect
          v-model="roleFilter"
          :options="[
            { label: '역할 전체', value: '' },
            { label: '시니어', value: 'senior' },
            { label: '담당자', value: 'manager' },
            { label: '수요처', value: 'worksite' },
          ]"
        />
        <PillSelect
          v-model="statusFilter"
          :options="[
            { label: '상태 전체', value: '' },
            { label: '활성', value: 'active' },
            { label: '종료', value: 'ended' },
          ]"
        />
        <WorksiteFilter v-model="worksiteFilter" :worksites="worksites" :programs="programs" />
      </template>

      <template #toolbar-end>
        <!-- 고른 사람에게 같은 근무 배정·배정 삭제(QA 2026-11-07 SHIFT-02 · SHIFT-09) -->
        <template v-if="selectedIds.length">
          <AppButton size="sm" variant="outline" color="neutral" icon="i-lucide-calendar-plus" @click="openBulkAssign">
            여러 명 배정
          </AppButton>
          <AppButton size="sm" variant="soft" color="down" icon="i-lucide-calendar-x" @click="openUnassign">
            배정 일괄 삭제
          </AppButton>
        </template>
        <button
          v-if="selectedIds.length"
          type="button"
          class="text-sm font-medium text-brand-500 hover:underline"
          @click="selectedIds = []"
        >
          선택 해제
        </button>
        <span class="text-sm text-muted tabular-nums">전체 {{ total.toLocaleString() }}명</span>
      </template>

      <!-- 수요처 계정은 이메일로 로그인해 전화번호가 없을 수 있다 -->
      <template #cell-phone="{ row }">{{ row.phone ? fmtPhone(row.phone) : (row.email ?? '—') }}</template>
      <template #cell-role="{ row }">
        <Tag>{{ ROLE_LABELS[row.role] ?? row.role }}</Tag>
      </template>
      <!-- 칸이 없는 옛 서버면 — . 전체 이름은 마우스를 올려 본다 -->
      <template #cell-worksites="{ row }">
        <span :title="rosterSiteCells(row.worksites)?.fullWorksites || undefined">
          {{ rosterSiteCells(row.worksites)?.worksite ?? '—' }}
        </span>
      </template>
      <template #cell-programs="{ row }">
        <span class="text-muted" :title="rosterSiteCells(row.worksites)?.fullPrograms || undefined">
          {{ rosterSiteCells(row.worksites)?.program ?? '—' }}
        </span>
      </template>
      <template #cell-status="{ row }">
        <StatusBadge :tone="lifeStatusTone(row.status)">{{ lifeStatusLabel(row.status) }}</StatusBadge>
      </template>
      <template #cell-app="{ row }">
        <StatusBadge v-if="appConnectionBadge(row)" :tone="appConnectionBadge(row)!.tone">
          {{ appConnectionBadge(row)!.label }}
        </StatusBadge>
        <span v-else class="text-muted">—</span>
      </template>
      <template #cell-memo="{ row }">
        <span class="text-muted">{{ row.memo || '—' }}</span>
      </template>
      <template #cell-created_at="{ row }">{{ fmtStamp(row.created_at) }}</template>

      <template #actions="{ row }">
        <NuxtLink :to="`/senior/workers/${row.id}`" class="text-sm font-medium text-brand-500 hover:underline">
          상세
        </NuxtLink>
      </template>
    </DataTable>

    <!-- 여러 명 같은 근무 배정(QA 2026-11-07 SHIFT-02 · SHIFT-09). 처리하는 동안은 닫지 않는다 — 누가 됐는지 결과를 봐야 한다 -->
    <AppModal v-model:open="bulkAssignOpen" title="여러 명 배정" width="max-w-lg" :before-close="() => !bulkRunning">
      <div class="space-y-4">
        <template v-if="!bulkResult">
          <div class="rounded-lg border border-hairline bg-surface-soft px-4 py-3 text-sm">
            <p class="font-semibold text-ink tabular-nums">{{ bulkTargets.targets.length }}명에게 배정을 만듭니다.</p>
            <p class="mt-0.5 text-muted">
              한 사람씩 차례로 저장하고, 시니어마다 새 배정 알림이 갑니다. 같은 시간에 이미 배정이 있는 사람은 저장하지 않고
              끝난 뒤 알려 드립니다.
            </p>
            <ul v-if="bulkTargets.targets.length" class="mt-1.5 max-h-32 list-disc space-y-0.5 overflow-y-auto pl-5 text-muted">
              <li v-for="p in bulkTargets.targets" :key="p.id">{{ personLine(p) }}</li>
            </ul>
          </div>
          <BulkSkippedList :items="skippedPeople(bulkTargets.skipped)" unit="명" />
          <FormField label="근무지" required :error="bulkTried ? bulkErrors.worksite : undefined">
            <AppSpinner v-if="refsLoading" label="근무지 불러오는 중…" />
            <WorksitePicker v-else v-model="bulkForm.worksiteId" :worksites="worksites" :programs="programs" />
          </FormField>
          <FormField label="근무 요일" required :error="bulkTried ? bulkErrors.weekdays : undefined">
            <WeekdayPicker v-model="bulkForm.weekdays" />
          </FormField>
          <div class="grid grid-cols-2 gap-4">
            <FormField label="시작 시간" required :error="bulkTried ? bulkErrors.time : undefined">
              <DateField v-model="bulkForm.startTime" type="time" />
            </FormField>
            <FormField label="종료 시간" required>
              <DateField v-model="bulkForm.endTime" type="time" />
            </FormField>
          </div>
          <div class="grid grid-cols-2 gap-4">
            <FormField label="시작일" required :error="bulkTried ? bulkErrors.start : undefined">
              <DateField v-model="bulkForm.periodStart" />
            </FormField>
            <FormField label="종료일" hint="비우면 무기한" :error="bulkErrors.end">
              <DateField v-model="bulkForm.periodEnd" />
            </FormField>
          </div>
          <p v-if="bulkProgress" class="text-sm text-muted tabular-nums" aria-live="polite">
            처리 중 {{ bulkProgress.finished }} / {{ bulkProgress.total }}
          </p>
        </template>
        <BulkResultPanel v-else done-label="배정" unit="명" :done="bulkResult.done" :failed="bulkResult.failed">
          <div
            v-if="bulkResult.syncFailed.length"
            class="rounded-lg border border-hairline bg-surface-soft px-4 py-3 text-body"
          >
            <p class="font-medium">아래 {{ bulkResult.syncFailed.length }}명은 배정은 저장됐지만 오늘·내일 근무 정리만 실패했습니다.</p>
            <p class="mt-0.5 text-muted">명부 상세에서 그 배정의 「수정」을 열어 저장을 한 번 더 누르면 맞춰집니다.</p>
            <ul class="mt-1.5 list-disc space-y-0.5 pl-5">
              <li v-for="name in bulkResult.syncFailed" :key="name">{{ name }}</li>
            </ul>
          </div>
        </BulkResultPanel>
      </div>
      <template #footer>
        <template v-if="!bulkResult">
          <AppButton variant="outline" color="neutral" size="sm" :disabled="bulkRunning" @click="bulkAssignOpen = false">
            취소
          </AppButton>
          <AppButton
            size="sm"
            :loading="bulkRunning"
            :disabled="!bulkTargets.targets.length || refsLoading"
            @click="submitBulkAssign"
          >
            {{ bulkTargets.targets.length }}명에게 배정
          </AppButton>
        </template>
        <AppButton v-else size="sm" @click="bulkAssignOpen = false">닫기</AppButton>
      </template>
    </AppModal>

    <!-- 배정 일괄 삭제(QA 2026-11-07 SHIFT-09). 근무지를 하나 골라야 지운다 -->
    <AppModal v-model:open="unassignOpen" title="배정 일괄 삭제" width="max-w-lg" :before-close="() => !bulkRunning">
      <div class="space-y-4">
        <template v-if="!bulkResult">
          <div class="rounded-lg border border-down bg-down-soft px-4 py-3 text-sm text-down" role="alert">
            <p class="font-semibold">삭제하기 전에 확인해 주세요.</p>
            <ul class="mt-1.5 list-disc space-y-0.5 pl-5">
              <li>고른 근무지의 배정이 지워지고, 앞으로 생길 근무가 더 만들어지지 않습니다.</li>
              <li>이미 생성된 출퇴근 기록은 남습니다.</li>
              <li>시니어마다 배정 삭제 알림이 갑니다.</li>
            </ul>
          </div>
          <BulkSkippedList :items="skippedPeople(unassignSkipped)" unit="명" />
          <AppSpinner v-if="unassignLoading" label="배정 불러오는 중…" />
          <p v-else-if="unassignLoadError" class="text-sm text-down" role="alert">{{ unassignLoadError }}</p>
          <EmptyState v-else-if="!unassignList.length" description="고른 사람에게 등록된 배정이 없습니다." />
          <template v-else>
            <FormField label="근무지" required hint="고른 사람들의 배정이 있는 근무지입니다.">
              <SelectField v-model="unassignWorksite" :options="unassignOptions" placeholder="근무지 선택" />
            </FormField>
            <div v-if="unassignTargets.length" class="rounded-lg border border-hairline bg-surface-soft px-4 py-3 text-sm">
              <p class="font-semibold text-ink tabular-nums">배정 {{ unassignTargets.length }}건을 삭제합니다.</p>
              <ul class="mt-1.5 max-h-40 list-disc space-y-0.5 overflow-y-auto pl-5 text-muted tabular-nums">
                <li v-for="x in unassignTargets" :key="x.assignment.id">{{ unassignLine(x) }}</li>
              </ul>
            </div>
          </template>
          <p v-if="bulkProgress" class="text-sm text-muted tabular-nums" aria-live="polite">
            처리 중 {{ bulkProgress.finished }} / {{ bulkProgress.total }}
          </p>
        </template>
        <BulkResultPanel v-else done-label="삭제" :done="bulkResult.done" :failed="bulkResult.failed" />
      </div>
      <template #footer>
        <template v-if="!bulkResult">
          <AppButton variant="outline" color="neutral" size="sm" :disabled="bulkRunning" @click="unassignOpen = false">
            취소
          </AppButton>
          <AppButton
            color="down"
            size="sm"
            :loading="bulkRunning"
            :disabled="!unassignTargets.length || unassignLoading"
            @click="submitUnassign"
          >
            배정 {{ unassignTargets.length }}건 삭제
          </AppButton>
        </template>
        <AppButton v-else size="sm" @click="unassignOpen = false">닫기</AppButton>
      </template>
    </AppModal>

    <!-- 등록 모달 -->
    <AppModal v-model:open="createOpen" title="명부 등록">
      <div class="space-y-4">
        <FormField label="이름" required>
          <TextField v-model="form.name" placeholder="홍길동" />
        </FormField>
        <FormField
          label="전화번호"
          required
          :hint="
            form.role === 'worksite'
              ? '어드민 로그인의 열쇠입니다. 이 번호로 문자 인증해 담당 근무지의 출퇴근 기록을 봅니다.'
              : '앱 로그인의 열쇠입니다. 이 번호로 본인 인증만 하면 바로 연결됩니다.'
          "
        >
          <TextField v-model="form.phone" placeholder="010-1234-5678" />
        </FormField>
        <FormField label="역할" required>
          <SelectField
            v-model="form.role"
            :options="[
              { label: '시니어', value: 'senior' },
              { label: '담당자', value: 'manager' },
              { label: '수요처 담당자', value: 'worksite' },
            ]"
          />
        </FormField>
        <p v-if="form.role === 'senior'" class="text-sm text-muted">
          근무지·요일·시간은 등록 후 상세 화면의 반복 배정에서 정합니다.
        </p>
        <FormField
          v-else
          :label="form.role === 'manager' ? '담당 근무지' : '근무지'"
          :required="form.role === 'worksite'"
          :hint="
            form.role === 'manager'
              ? '사업으로 좁혀 여러 곳을 고를 수 있습니다. 나중에 상세 화면에서 바꿀 수 있습니다.'
              : '수요처 담당자는 근무지 1곳만 맡습니다.'
          "
        >
          <AppSpinner v-if="refsLoading" label="근무지 불러오는 중…" />
          <WorksitePicker
            v-else-if="form.role === 'manager'"
            v-model="form.worksiteIds"
            :worksites="worksites"
            :programs="programs"
            :is-taken="takenByOther"
            multiple
          />
          <WorksitePicker v-else v-model="form.worksiteId" :worksites="worksites" :programs="programs" />
        </FormField>
        <FormField label="메모" hint="담당자 참고용. 앱에는 보이지 않습니다.">
          <AppTextarea v-model="form.memo" :rows="3" />
        </FormField>
      </div>
      <template #footer>
        <AppButton variant="outline" color="neutral" size="sm" @click="createOpen = false">취소</AppButton>
        <AppButton size="sm" :loading="saving" @click="submitCreate">등록</AppButton>
      </template>
    </AppModal>
  </div>
</template>
