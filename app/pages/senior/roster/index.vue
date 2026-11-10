<!-- 근무표 — 근무지 하나의 주간·월간 표. 칸마다 그날만 쉼·다른 시간·배정대로, 끌어 복사, 모아 저장(QA SHIFT-03·05·07·08). Figma 없음 -->
<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import type { Worksite } from '~/types/dbo'
import { runSequential, failureLines } from '~/utils/bulkRun'
import { assignmentPeriodErrors, assignmentSaveError, hhmm, todaySeoul, weekdaysLabel } from '~/utils/dbo'
import {
  type CellView,
  type DayEdit,
  type Roster,
  type RosterCell,
  type RosterRow,
  cellKey,
  cellText,
  copyEdits,
  dayErrorMessage,
  dayHeader,
  editable,
  editToward,
  isSyncFailure,
  lockReason,
  monthRange,
  moveAnchor,
  pruneEdits,
  type SaveItem,
  saveItemLabel,
  saveItems,
  validTimes,
  viewOf,
  weekRange,
} from '~/utils/roster'

const api = useDboAdmin()
const supabase = useSupabase()
const toast = useToast()
const { me } = useAdminRole()
useAdminHeader().setHeader('근무표')

// 근무지·보기·기준 날은 주소에 담는다 — 다른 화면에 다녀와도 그대로다
const lq = useListQuery({ worksite: '', view: 'week', at: '' })
const worksiteId = lq.worksite
const view = lq.view
const anchor = computed(() => lq.at.value || todaySeoul())
const range = computed(() => (view.value === 'month' ? monthRange(anchor.value) : weekRange(anchor.value)))
const compact = computed(() => view.value === 'month')

const worksites = ref<Worksite[]>([])
const worksiteOptions = computed(() =>
  worksites.value.filter((w) => w.status !== 'ended').map((w) => ({ label: w.name, value: w.id })),
)

const roster = ref<Roster | null>(null)
const loading = ref(false)
const error = ref('')
let sequence = 0

async function load() {
  if (!worksiteId.value) {
    roster.value = null
    return
  }
  const current = ++sequence
  loading.value = true
  error.value = ''
  try {
    const res = await api.roster(worksiteId.value, range.value.from, range.value.to)
    if (current !== sequence) return
    roster.value = res
    edits.value = pruneEdits(res.rows, edits.value)
  } catch (e) {
    if (current !== sequence) return
    roster.value = null
    error.value = (e as any)?.status === 403
      ? '이 근무지의 근무표를 볼 권한이 없습니다.'
      : dboErrorMessage(e, '근무표를 불러오지 못했습니다.')
  } finally {
    if (current === sequence) loading.value = false
  }
}

onMounted(async () => {
  try {
    worksites.value = await api.listAllWorksites()
    const first = worksiteOptions.value[0]
    if (!worksiteId.value && first) worksiteId.value = String(first.value)
  } catch (e) {
    error.value = dboErrorMessage(e, '근무지를 불러오지 못했습니다.')
  }
  load()
})
watch([worksiteId, () => range.value.from, () => range.value.to], load)

function move(step: number) {
  lq.at.value = moveAnchor(anchor.value, view.value === 'month' ? 'month' : 'week', step)
}
function goToday() {
  lq.at.value = ''
}

const periodLabel = computed(() => {
  const { from, to } = range.value
  if (view.value === 'month') return `${Number(from.slice(0, 4))}년 ${Number(from.slice(5, 7))}월`
  return `${dayHeader(from)} ~ ${dayHeader(to)}`
})

// ── 편집 — 바꾼 칸은 모아 두었다가 「저장」 때 하나씩 보낸다(QA SHIFT-07)

const editing = ref(false)
const edits = ref(new Map<string, DayEdit>())
const dirty = computed(() => edits.value.size > 0)
const canEdit = computed(() => !!roster.value?.canEdit)

function editOf(row: RosterRow, cell: RosterCell): DayEdit | undefined {
  return edits.value.get(cellKey(row.assignmentId, cell.date))
}
function cellView(row: RosterRow, cell: RosterCell): CellView {
  return viewOf(row, cell, editOf(row, cell))
}
function setEdit(row: RosterRow, cell: RosterCell, target: CellView) {
  const next = new Map(edits.value)
  const edit = editToward(row, cell, target)
  const key = cellKey(row.assignmentId, cell.date)
  if (edit) next.set(key, edit)
  else next.delete(key)
  edits.value = next
}

/** 고른 칸 — 아래 편집 줄에서 바꾼다 */
const active = ref<{ row: number; col: number } | null>(null)
const activeRow = computed(() => (active.value && roster.value?.rows[active.value.row]) || null)
const activeCell = computed(() => (active.value && activeRow.value?.cells[active.value.col]) || null)
const timeDraft = ref({ start: '09:00', end: '12:00' })
watch(active, () => {
  const r = activeRow.value
  const c = activeCell.value
  if (!r || !c) return
  const v = cellView(r, c)
  timeDraft.value = { start: hhmm(v.startTime ?? r.startTime), end: hhmm(v.endTime ?? r.endTime) }
})

function applyActive(kind: 'work' | 'skip' | 'time') {
  const r = activeRow.value
  const c = activeCell.value
  if (!r || !c) return
  if (kind === 'time') {
    const { start, end } = timeDraft.value
    if (!validTimes(start, end)) {
      toast.add({ title: '시작 시간이 끝 시간보다 앞이어야 합니다.', color: 'warning' })
      return
    }
    setEdit(r, c, { state: 'time', startTime: `${start}:00`, endTime: `${end}:00` })
    return
  }
  setEdit(r, c, { state: kind, startTime: kind === 'work' ? r.startTime : null, endTime: kind === 'work' ? r.endTime : null })
}

// 끌어 복사 — 칸을 누른 채 끌면 누른 칸의 모양을 끈 사각형에 복사한다. 놓은 곳이 누른 칸이면 그 칸을 고른다
const drag = ref<{ from: { row: number; col: number }; to: { row: number; col: number } } | null>(null)
function onCellDown(rowIndex: number, colIndex: number, cell: RosterCell, e: PointerEvent) {
  if (!editing.value || cell.state === 'none' || e.button !== 0) return
  e.preventDefault()
  drag.value = { from: { row: rowIndex, col: colIndex }, to: { row: rowIndex, col: colIndex } }
}
function onCellEnter(rowIndex: number, colIndex: number) {
  if (drag.value) drag.value = { ...drag.value, to: { row: rowIndex, col: colIndex } }
}
function onPointerUp() {
  const d = drag.value
  if (!d) return
  drag.value = null
  const rows = roster.value?.rows ?? []
  if (d.from.row === d.to.row && d.from.col === d.to.col) {
    const cell = rows[d.from.row]?.cells[d.from.col]
    active.value = cell && editable(cell) ? { ...d.from } : null
    if (cell && !editable(cell)) toast.add({ title: lockReason(cell) ?? '바꿀 수 없는 칸입니다.', color: 'neutral' })
    return
  }
  const copied = copyEdits(rows, edits.value, d.from, d.to)
  if (!copied.size) return
  const next = new Map(edits.value)
  for (const [key, edit] of copied) {
    if (edit) next.set(key, edit)
    else next.delete(key)
  }
  edits.value = next
}
function inDrag(rowIndex: number, colIndex: number): boolean {
  const d = drag.value
  if (!d) return false
  return rowIndex >= Math.min(d.from.row, d.to.row) && rowIndex <= Math.max(d.from.row, d.to.row) &&
    colIndex >= Math.min(d.from.col, d.to.col) && colIndex <= Math.max(d.from.col, d.to.col)
}
onMounted(() => window.addEventListener('pointerup', onPointerUp))
onBeforeUnmount(() => window.removeEventListener('pointerup', onPointerUp))

function startEditing() {
  editing.value = true
  active.value = null
}
function cancelEditing() {
  if (dirty.value && !window.confirm(`바꾼 ${edits.value.size}칸을 저장하지 않고 버릴까요?`)) return
  edits.value = new Map()
  editing.value = false
  active.value = null
  result.value = null
  syncRetry.value = []
}

// ── 저장 — 칸마다 기존 API 를 차례로 부른다. 실패한 칸은 편집으로 남기고 까닭을 보인다(결정 D25 와 같다)

const saving = ref(false)
const progress = ref<{ done: number; total: number } | null>(null)
const result = ref<{ saved: number; failed: { name: string; reason: string }[] } | null>(null)
/** 저장은 됐는데 오늘·내일 근무 행 맞추기만 실패한 칸 — 「다시 반영」으로 같은 요청을 다시 보낸다 */
const syncRetry = ref<SaveItem[]>([])
useBusyLeaveGuard(saving)

function sendItem(item: SaveItem) {
  return item.edit.kind === 'revert'
    ? api.revertAssignmentDay(item.assignmentId, item.date)
    : api.setAssignmentDay(
      item.assignmentId,
      item.date,
      item.edit.kind === 'skip' ? { kind: 'skip' } : { kind: 'time', startTime: item.edit.start, endTime: item.edit.end },
    )
}

async function save() {
  const items = saveItems(roster.value?.rows ?? [], edits.value)
  if (!items.length) return
  if (!window.confirm(`${items.length}칸을 저장합니다. 바뀐 날마다 그 시니어에게 앱 알림이 갑니다.`)) return
  saving.value = true
  result.value = null
  progress.value = { done: 0, total: items.length }
  try {
    const out = await runSequential(items, sendItem, (done, total) => (progress.value = { done, total }))
    syncRetry.value = out.failed.filter((f) => isSyncFailure(f.error)).map((f) => f.item)
    const next = new Map(edits.value)
    for (const item of out.done) next.delete(cellKey(item.assignmentId, item.date))
    edits.value = next
    result.value = { saved: out.done.length, failed: failureLines(out.failed, saveItemLabel, dayErrorMessage) }
    if (!out.failed.length) {
      toast.add({ title: `${out.done.length}칸을 저장했습니다.`, color: 'success' })
      editing.value = false
      active.value = null
    }
  } finally {
    saving.value = false
    progress.value = null
    await load()
  }
}

async function retrySync() {
  const items = syncRetry.value
  if (!items.length) return
  saving.value = true
  try {
    const out = await runSequential(items, sendItem, (done, total) => (progress.value = { done, total }))
    syncRetry.value = out.failed.filter((f) => isSyncFailure(f.error)).map((f) => f.item)
    if (!out.failed.length) {
      toast.add({ title: `${out.done.length}칸을 오늘·내일 근무에 반영했습니다.`, color: 'success' })
      if (result.value) result.value = { ...result.value, failed: result.value.failed.filter((f) => !items.some((i) => saveItemLabel(i) === f.name)) }
    } else {
      toast.add({ title: '아직 반영하지 못한 칸이 있습니다.', description: dayErrorMessage(out.failed[0]?.error), color: 'error' })
    }
  } finally {
    saving.value = false
    progress.value = null
    await load()
  }
}

// 저장하지 않은 편집이 있으면 떠나기 전에 묻는다(저장 중에는 `useBusyLeaveGuard` 가 막는다)
onBeforeRouteLeave(() => {
  if (saving.value || !dirty.value) return true
  return window.confirm(`저장하지 않은 ${edits.value.size}칸이 있습니다. 나가면 사라집니다. 나갈까요?`)
})
const onUnload = (e: BeforeUnloadEvent) => {
  if (!dirty.value) return
  e.preventDefault()
  e.returnValue = ''
}
onMounted(() => window.addEventListener('beforeunload', onUnload))
onBeforeUnmount(() => window.removeEventListener('beforeunload', onUnload))

// ── 칸 모양

function cellClass(row: RosterRow, cell: RosterCell, rowIndex: number, colIndex: number): string {
  const v = cellView(row, cell)
  const changed = !!editOf(row, cell) && editable(cell)
  const isActive = active.value?.row === rowIndex && active.value?.col === colIndex
  return [
    'h-10 border-b border-r border-hairline px-1 text-center text-xs tabular-nums',
    v.state === 'none' ? 'bg-surface-soft text-muted' : '',
    v.state === 'work' ? 'text-ink' : '',
    v.state === 'time' ? 'bg-amber-50 font-semibold text-amber-800' : '',
    v.state === 'skip' ? 'bg-slate-100 font-semibold text-slate-500' : '',
    v.state === 'holiday' ? 'bg-down-soft text-down' : '',
    cell.locked && v.state !== 'none' ? 'opacity-60' : '',
    editing.value && editable(cell) ? 'cursor-pointer hover:bg-brand-50' : '',
    changed ? 'ring-2 ring-inset ring-brand-500' : '',
    isActive ? 'outline outline-2 outline-brand-600' : '',
    inDrag(rowIndex, colIndex) ? 'bg-brand-50' : '',
  ].join(' ')
}
function cellTitle(row: RosterRow, cell: RosterCell): string {
  const v = cellView(row, cell)
  const parts = [`${row.name} ${dayHeader(cell.date)}`, cellText(v) || '근무 없음']
  if (cell.recorded) parts.push('출결 기록 있음')
  const lock = v.state !== 'none' ? lockReason(cell) : null
  if (lock) parts.push(lock)
  return parts.join(' · ')
}
function isToday(date: string) {
  return date === roster.value?.today
}

// ── 참여자 정보·메모(QA MGR-05) — 이름을 누르면 연다
const notesOpen = ref(false)
const notesFor = ref<{ directoryId: string; name: string } | null>(null)
function openNotes(row: RosterRow) {
  notesFor.value = { directoryId: row.directoryId, name: row.name }
  notesOpen.value = true
}

// ── 배정 고치기·지우기·더하기(QA SHIFT-08) — 담당자는 맡은 근무지만, 새 배정은 이미 맡은 곳에 배정된 시니어만(서버 판정)

const assignOpen = ref(false)
const assignSaving = ref(false)
const assignTried = ref(false)
const assignError = ref<{ message: string; conflicts: string[] } | null>(null)
const assignEditing = ref<RosterRow | null>(null)
const assignForm = ref({
  directoryId: '' as string,
  weekdays: [] as number[],
  startTime: '09:00',
  endTime: '12:00',
  periodStart: null as string | null,
  periodEnd: null as string | null,
})
const people = ref<{ label: string; value: string }[]>([])
const assignPeriodErrors = computed(() => assignmentPeriodErrors(assignForm.value.periodStart, assignForm.value.periodEnd))

async function loadPeople() {
  if (people.value.length) return
  try {
    if (me.value?.role === 'master') {
      const rows = await fetchAllPages(
        (page, size) => api.listDirectory({ role: 'senior', status: 'active', page, size, sort: 'name' }),
        (d) => d.id,
      )
      people.value = rows.map((d) => ({ label: d.name, value: d.id }))
      return
    }
    // 담당자는 맡은 근무지에 배정된 시니어만 읽힌다(RLS) — 그분들에게만 배정을 더할 수 있다
    const { data, error: e } = await supabase
      .from('dbo_directory')
      .select('id, name')
      .eq('role', 'senior')
      .eq('status', 'active')
      .order('name')
    if (e) throw e
    people.value = (data ?? []).map((d: { id: string; name: string }) => ({ label: d.name, value: d.id }))
  } catch (e) {
    toast.add({ title: '명부를 불러오지 못했습니다.', description: dboErrorMessage(e), color: 'error' })
  }
}

function openAssign(row?: RosterRow) {
  assignTried.value = false
  assignError.value = null
  assignEditing.value = row ?? null
  assignForm.value = row
    ? {
        directoryId: row.directoryId,
        weekdays: [...row.weekdays],
        startTime: hhmm(row.startTime),
        endTime: hhmm(row.endTime),
        periodStart: row.periodStart,
        periodEnd: row.periodEnd,
      }
    : { directoryId: '', weekdays: [], startTime: '09:00', endTime: '12:00', periodStart: todaySeoul(), periodEnd: null }
  if (!row) loadPeople()
  assignOpen.value = true
}

async function submitAssign() {
  assignTried.value = true
  assignError.value = null
  const f = assignForm.value
  if (!assignEditing.value && !f.directoryId) return
  if (!f.weekdays.length || !validTimes(f.startTime, f.endTime) || assignPeriodErrors.value.start || assignPeriodErrors.value.end) return
  assignSaving.value = true
  try {
    if (assignEditing.value) {
      await api.updateAssignment(assignEditing.value.assignmentId, {
        weekdays: f.weekdays,
        startTime: f.startTime,
        endTime: f.endTime,
        periodStart: f.periodStart,
        periodEnd: f.periodEnd,
      })
    } else {
      const site = worksites.value.find((w) => w.id === worksiteId.value)
      await api.createAssignment({
        directoryId: f.directoryId,
        worksiteId: worksiteId.value,
        programId: site?.program_id ?? null,
        weekdays: f.weekdays,
        startTime: f.startTime,
        endTime: f.endTime,
        periodStart: f.periodStart,
        periodEnd: f.periodEnd,
      })
    }
    toast.add({ title: '배정을 저장했습니다.', color: 'success' })
    assignOpen.value = false
    load()
  } catch (e) {
    assignError.value = assignmentSaveError(e) ?? {
      message: (e as any)?.status === 403
        ? '이 시니어에게 이 근무지 배정을 만들 권한이 없습니다. 처음 배정은 운영관리자가 합니다.'
        : dboErrorMessage(e),
      conflicts: [],
    }
  } finally {
    assignSaving.value = false
  }
}

async function removeAssign(row: RosterRow) {
  if (!window.confirm(`${row.name} · ${weekdaysLabel(row.weekdays)} ${hhmm(row.startTime)}–${hhmm(row.endTime)} 배정을 지울까요? 오늘 이후 기록 없는 근무가 사라지고 시니어에게 알림이 갑니다.`)) return
  try {
    await api.deleteAssignment(row.assignmentId)
    toast.add({ title: '배정을 지웠습니다.', color: 'success' })
    load()
  } catch (e) {
    toast.add({ title: '배정을 지우지 못했습니다.', description: dboErrorMessage(e), color: 'error' })
  }
}
</script>

<template>
  <div class="space-y-4">
    <div class="flex flex-wrap items-center gap-2">
      <div class="w-64">
        <SelectField v-model="worksiteId" :options="worksiteOptions" placeholder="근무지 선택" :disabled="dirty" />
      </div>
      <PillSelect
        v-model="view"
        :options="[{ label: '주간', value: 'week' }, { label: '월간', value: 'month' }]"
        :class="dirty ? 'pointer-events-none opacity-50' : ''"
      />
      <AppButton variant="outline" color="neutral" size="sm" icon="i-lucide-chevron-left" :disabled="dirty" aria-label="앞으로" @click="move(-1)" />
      <span class="min-w-40 text-center text-sm font-semibold tabular-nums">{{ periodLabel }}</span>
      <AppButton variant="outline" color="neutral" size="sm" icon="i-lucide-chevron-right" :disabled="dirty" aria-label="뒤로" @click="move(1)" />
      <AppButton variant="outline" color="neutral" size="sm" :disabled="dirty" @click="goToday">오늘</AppButton>
      <div class="ml-auto flex gap-2">
        <template v-if="canEdit && !editing">
          <AppButton variant="outline" size="sm" icon="i-lucide-user-plus" :disabled="!roster" @click="openAssign()">배정 추가</AppButton>
          <AppButton size="sm" icon="i-lucide-pencil" :disabled="!roster" @click="startEditing">편집</AppButton>
        </template>
        <template v-else-if="editing">
          <AppButton variant="outline" color="neutral" size="sm" :disabled="saving" @click="cancelEditing">취소</AppButton>
          <AppButton size="sm" :loading="saving" :disabled="!dirty" @click="save">
            저장{{ dirty ? ` (${edits.size}칸)` : '' }}
          </AppButton>
        </template>
      </div>
    </div>

    <p v-if="dirty" class="text-xs text-muted">저장하거나 취소한 뒤 근무지·기간을 바꿀 수 있습니다.</p>
    <p v-if="roster && !roster.canEdit" class="text-sm text-muted">이 근무지의 근무표는 읽기만 할 수 있습니다.</p>
    <p v-if="editing" class="text-sm text-muted">
      칸을 눌러 고르면 아래에서 바꿉니다. 칸을 누른 채 끌면 그 칸의 모양이 끈 칸들에 복사됩니다. 지난 날·출결 기록이 있는 날·휴무일은 바꿀 수 없습니다.
    </p>
    <p v-if="error" role="alert" class="text-sm text-red-600">{{ error }}</p>

    <div v-if="result && result.failed.length" class="rounded-lg border border-down bg-down-soft px-4 py-3 text-sm text-down" role="alert">
      <p class="font-semibold">{{ result.saved }}칸은 저장했고 {{ result.failed.length }}칸은 저장하지 못했습니다. 못 한 칸은 표에 그대로 남아 있습니다.</p>
      <ul class="mt-1.5 list-disc space-y-0.5 pl-5">
        <li v-for="(f, i) in result.failed" :key="i">{{ f.name }} — {{ f.reason }}</li>
      </ul>
      <AppButton v-if="syncRetry.length" class="mt-2" size="sm" :loading="saving" @click="retrySync">
        다시 반영 ({{ syncRetry.length }}칸)
      </AppButton>
    </div>
    <p v-if="progress" class="text-sm text-muted" aria-live="polite">저장하는 중 {{ progress.done }}/{{ progress.total }}</p>

    <div v-if="loading && !roster" class="py-10 text-center text-sm text-muted">불러오는 중…</div>
    <div v-else-if="roster && !roster.rows.length" class="py-10 text-center text-sm text-muted">이 기간에 배정된 분이 없습니다.</div>
    <div v-else-if="roster" class="overflow-x-auto rounded-lg border border-hairline bg-white" :class="editing ? 'select-none' : ''">
      <table class="min-w-full border-separate border-spacing-0">
        <thead>
          <tr>
            <th class="sticky left-0 z-10 min-w-48 border-b border-r border-hairline bg-white px-3 py-2 text-left text-xs font-semibold">참여자 · 배정</th>
            <th
              v-for="c in roster.rows[0]?.cells ?? []"
              :key="c.date"
              class="border-b border-r border-hairline px-1 py-2 text-center text-xs font-semibold tabular-nums"
              :class="[compact ? 'min-w-11' : 'min-w-24', isToday(c.date) ? 'bg-brand-50 text-brand-700' : '', roster.holidays.includes(c.date) ? 'text-down' : '']"
            >
              {{ compact ? Number(c.date.slice(8)) : dayHeader(c.date) }}
            </th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="(row, ri) in roster.rows" :key="row.assignmentId">
            <th class="sticky left-0 z-10 border-b border-r border-hairline bg-white px-3 py-1.5 text-left font-normal">
              <div class="flex items-center gap-2">
                <div class="min-w-0 flex-1">
                  <button type="button" class="truncate text-sm font-semibold text-brand-600 hover:underline" :disabled="editing" @click="openNotes(row)">
                    {{ row.name }}
                  </button>
                  <p class="truncate text-xs text-muted tabular-nums">
                    {{ weekdaysLabel(row.weekdays) }} {{ hhmm(row.startTime) }}–{{ hhmm(row.endTime) }}
                  </p>
                </div>
                <template v-if="canEdit && !editing">
                  <IconButton icon="i-lucide-pencil" :label="`${row.name} 배정 고치기`" @click="openAssign(row)" />
                  <IconButton icon="i-lucide-trash-2" tone="danger" :label="`${row.name} 배정 지우기`" @click="removeAssign(row)" />
                </template>
              </div>
            </th>
            <td
              v-for="(cell, ci) in row.cells"
              :key="cell.date"
              :class="cellClass(row, cell, ri, ci)"
              :title="cellTitle(row, cell)"
              @pointerdown="onCellDown(ri, ci, cell, $event)"
              @pointerenter="onCellEnter(ri, ci)"
            >
              {{ cellText(cellView(row, cell), compact) }}
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <div class="flex flex-wrap gap-3 text-xs text-muted">
      <span><span class="inline-block size-3 rounded-sm bg-amber-50 ring-1 ring-amber-300" /> 이날만 다른 시간</span>
      <span><span class="inline-block size-3 rounded-sm bg-slate-100 ring-1 ring-slate-300" /> 이날만 쉼</span>
      <span><span class="inline-block size-3 rounded-sm bg-down-soft ring-1 ring-down" /> 근무지 휴무</span>
      <span><span class="inline-block size-3 rounded-sm ring-2 ring-brand-500" /> 바꾸고 아직 저장 안 함</span>
    </div>

    <!-- 고른 칸 바꾸기 -->
    <div v-if="editing && activeRow && activeCell" class="sticky bottom-0 z-20 flex flex-wrap items-center gap-2 rounded-lg border border-hairline bg-white px-4 py-3 shadow-lg">
      <p class="mr-2 text-sm font-semibold">{{ activeRow.name }} · {{ dayHeader(activeCell.date) }}</p>
      <AppButton size="sm" variant="outline" @click="applyActive('work')">배정대로</AppButton>
      <AppButton size="sm" variant="outline" @click="applyActive('skip')">이날만 쉼</AppButton>
      <span class="ml-2 text-sm text-muted">다른 시간</span>
      <div class="w-28"><DateField v-model="timeDraft.start" type="time" /></div>
      <span class="text-sm">~</span>
      <div class="w-28"><DateField v-model="timeDraft.end" type="time" /></div>
      <AppButton size="sm" @click="applyActive('time')">적용</AppButton>
      <IconButton class="ml-auto" icon="i-lucide-x" label="고르기 취소" @click="active = null" />
    </div>

    <MemberNotesModal v-model:open="notesOpen" :directory-id="notesFor?.directoryId ?? null" :name="notesFor?.name ?? ''" />

    <AppModal v-model:open="assignOpen" :title="assignEditing ? `${assignEditing.name} 배정 고치기` : '배정 추가'" width="max-w-xl">
      <div class="space-y-4">
        <FormField v-if="!assignEditing" label="참여자" required :error="assignTried && !assignForm.directoryId ? '참여자를 골라 주세요' : undefined">
          <SelectField v-model="assignForm.directoryId" :options="people" placeholder="참여자 선택" />
        </FormField>
        <FormField label="근무 요일" required :error="assignTried && !assignForm.weekdays.length ? '요일을 골라 주세요' : undefined">
          <WeekdayPicker v-model="assignForm.weekdays" />
        </FormField>
        <div class="grid grid-cols-2 gap-4">
          <FormField label="시작 시간" required :error="assignTried && !validTimes(assignForm.startTime, assignForm.endTime) ? '시작이 끝보다 앞이어야 합니다' : undefined">
            <DateField v-model="assignForm.startTime" type="time" />
          </FormField>
          <FormField label="끝 시간" required>
            <DateField v-model="assignForm.endTime" type="time" />
          </FormField>
        </div>
        <div class="grid grid-cols-2 gap-4">
          <FormField label="시작일" required :error="assignTried ? assignPeriodErrors.start : undefined">
            <DateField v-model="assignForm.periodStart" />
          </FormField>
          <FormField label="종료일" hint="비우면 무기한" :error="assignPeriodErrors.end">
            <DateField v-model="assignForm.periodEnd" />
          </FormField>
        </div>
        <div v-if="assignError" class="rounded-lg border border-down bg-down-soft px-4 py-3 text-sm text-down" role="alert">
          <p class="font-semibold">{{ assignError.message }}</p>
          <ul v-if="assignError.conflicts.length" class="mt-1.5 list-disc space-y-0.5 pl-5 tabular-nums">
            <li v-for="(line, i) in assignError.conflicts" :key="i">{{ line }}</li>
          </ul>
        </div>
      </div>
      <template #footer>
        <AppButton variant="outline" color="neutral" size="sm" :disabled="assignSaving" @click="assignOpen = false">취소</AppButton>
        <AppButton size="sm" :loading="assignSaving" @click="submitAssign">저장</AppButton>
      </template>
    </AppModal>
  </div>
</template>
