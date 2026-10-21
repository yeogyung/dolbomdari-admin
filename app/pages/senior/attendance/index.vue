<!-- 출퇴근 기록 — 기간·근무지·이름 조회 + 대리 기록 수정 + 엑셀 내보내기 (/dbo-admin/attendance) -->
<script setup lang="ts">
import { ref, computed, watch, onMounted } from 'vue'
import { downloadExcel, type ExcelColumn } from '~/utils/excel'
import type { Column } from '~/types/table'
import type { AttendanceChange, AttendanceShift, AttendanceSummary, Worksite } from '~/types/dbo'
import type { AttendanceDisplay } from '~/utils/attendanceState'

const api = useDboAdmin()
const { listChangesByShifts } = useAttendanceChanges()
const toast = useToast()
const { setHeader } = useAdminHeader()
const { me } = useAdminRole()
setHeader('출퇴근 기록')

/** 「삭제 기록」 탭은 master 만 본다. 서버도 master 가 아니면 403 이다 */
const tab = ref<'records' | 'deletions'>('records')

const rows = ref<AttendanceShift[]>([])
const total = ref(0)
// 검색·기간·근무지·정렬·페이지는 주소에 담는다 — 다른 화면에 다녀와도 조회 조건이 그대로다.
// 검색어·기간은 「조회」를 눌러야 정해지는 칸이라 commit() 때 싣는다
const lq = useListQuery(
  { page: 1, size: 20, q: '', from: todaySeoul(), to: todaySeoul(), worksite: '', display: '', sort: 'work_date' },
  { committed: ['q', 'from', 'to'] },
)
const page = lq.page
const pageSize = lq.size
const q = lq.q
const from = lq.from
const to = lq.to
const worksiteId = lq.worksite
/** 표시 상태 필터. 서버가 같은 규칙(dbo_display_state)으로 걸러 페이지·건수가 맞는다 */
const display = lq.display
const sortKey = lq.sort
const loading = ref(false)
const { exporting, startExport, finishExport } = useExcelExport()

const worksites = ref<Worksite[]>([])

const columns: Column[] = [
  { key: 'work_date', label: '근무일', sortable: true, strong: true },
  { key: 'name', label: '이름' },
  { key: 'worksite', label: '근무지' },
  { key: 'planned', label: '예정' },
  { key: 'status', label: '상태' },
  { key: 'started_at', label: '출근' },
  { key: 'ended_at', label: '퇴근' },
  { key: 'worked', label: '근무시간' },
  { key: 'method', label: '기록 방법' },
  // 사람이 고친 흔적. 변경 이력(dbo_attendance_changes)으로 판정한다 — updated_by 는 QR 도 채운다.
  { key: 'edited', label: '수정 이력' },
  { key: 'memo', label: '메모' },
]

/** 조회 순번 — 조건을 빠르게 바꾸면 늦게 온 이전 응답이 새 결과를 덮지 않게 마지막 요청만 반영한다 */
let sequence = 0
async function load() {
  const current = ++sequence
  loading.value = true
  try {
    const res = await api.listAttendance({
      page: page.value,
      size: pageSize.value,
      q: lq.committedOf('q'),
      sort: sortKey.value,
      from: lq.committedOf('from'),
      to: lq.committedOf('to'),
      worksiteId: worksiteId.value || undefined,
      display: (display.value || undefined) as AttendanceDisplay | undefined,
      summary: '1',
    })
    if (current !== sequence) return
    rows.value = res.items
    total.value = res.total
    // 집계를 모르는 서버(배포 순서가 어긋남)여도 화면이 깨지지 않게 0 으로 둔다
    summary.value = res.summary ?? EMPTY_SUMMARY
    const changes = await loadChanges(res.items)
    if (current !== sequence) return
    changesByShift.value = changes
  } catch (e: any) {
    if (current !== sequence) return
    toast.add({ title: '출결 조회 실패', description: dboErrorMessage(e), color: 'error' })
  } finally {
    if (current === sequence) loading.value = false
  }
}

/* 변경 이력 — 페이지마다 한 번에 읽어 「수정됨」 판정과 이력 창에 쓴다 */
const changesByShift = ref(new Map<string, AttendanceChange[]>())

/** 실패해도 목록은 보여 준다. 그때 「수정됨」은 method 로만 판정된다(QR 을 수정됨으로 잘못 보이진 않는다) */
async function loadChanges(items: AttendanceShift[]) {
  try {
    return groupChangesByShift(await listChangesByShifts(items.map((r) => r.id)))
  } catch (e: any) {
    toast.add({ title: '변경 이력 조회 실패', description: dboErrorMessage(e), color: 'warning' })
    return new Map<string, AttendanceChange[]>()
  }
}

function editedOf(row: AttendanceShift) {
  const changes = changesByShift.value.get(row.id)
  const kind = isHumanEdited(changes, attendanceOf(row))
  const last = changes?.find((c) => c.changed_by_role !== 'senior')
  return { kind, last }
}

const historyOpen = ref(false)
const historyTarget = ref<AttendanceShift | null>(null)
const historyLines = computed(() =>
  (historyTarget.value ? (changesByShift.value.get(historyTarget.value.id) ?? []) : []).map(describeChange),
)

function openHistory(row: AttendanceShift) {
  historyTarget.value = row
  historyOpen.value = true
}

async function loadWorksites() {
  try {
    // 근무지는 300곳 가까이 되는데 한 페이지는 100곳까지다 — 끝까지 받는다
    worksites.value = await api.listAllWorksites()
  } catch (e: any) {
    // 출결 조회는 그대로 되지만 필터 선택지가 비거나 모자라다 — 조용히 넘기지 않는다
    toast.add({ title: '근무지 목록을 불러오지 못했습니다.', description: dboErrorMessage(e), color: 'warning' })
  }
}

// 조회 Promise 를 돌려준다 — 조회 버튼(AppButton)이 끝날 때까지 다시 눌리지 않게
function search() {
  page.value = 1
  lq.commit()
  return load()
}

function setRange(days: number) {
  to.value = todaySeoul()
  from.value = days === 0 ? todaySeoul() : daysAgoSeoul(days)
  return search()
}

function toggleSort(key: string) {
  sortKey.value = key
  page.value = 1
  load()
}

watch([worksiteId, display], search)

/* 집계 — 서버가 조회 조건 **전체**를 표시 상태(dbo_display_state)로 세어 준다.
 * 퇴근 완료 = 정상 + 지각, 미기록·결근 = 미출근 + 결석. 인정 결석·출근 전은 어디에도 세지 않는다.
 * 예전에는 받은 한 페이지만 셌다 — 오늘 활동이 1,000건을 넘자 근무 중인 사람이 다른 페이지에
 * 있으면 「근무 중 0」이 됐다(2026-10-21). */
const EMPTY_SUMMARY: AttendanceSummary = { done: 0, working: 0, missingCheckout: 0, missing: 0 }
const summary = ref<AttendanceSummary>(EMPTY_SUMMARY)

/* 대리 기록 수정 */
const editOpen = ref(false)
const saving = ref(false)
const target = ref<AttendanceShift | null>(null)
const form = ref({
  status: 'present',
  startedAt: null as string | null,
  endedAt: null as string | null,
  memo: '',
})

const editErrors = ref<{ memo?: string; endedAt?: string }>({})

function openEdit(row: AttendanceShift) {
  if (!canEditAttendance(row.work_date, todaySeoul())) return
  const rec = attendanceOf(row)
  target.value = row
  // 사유는 빈칸으로 시작한다. 이전 메모를 채워 두면 그대로 저장해도 필수 검사를
  // 통과하고, 수정 이력에도 옛 사유가 이번 변경의 사유처럼 남는다(QA 2026-10-14 6번).
  form.value = {
    status: editDefaultStatus(row),
    startedAt: toLocalInput(rec?.started_at),
    endedAt: toLocalInput(rec?.ended_at),
    memo: '',
  }
  editErrors.value = {}
  editOpen.value = true
}

/** 등록된 상태 코드가 화면 어휘에 없으면 선택지에 그대로 더한다 */
const statusOptions = computed(() => {
  const base = ATTENDANCE_STATUSES.map((s) => ({ label: s.label, value: s.value as string }))
  const cur = form.value.status
  if (cur && !base.some((o) => o.value === cur)) base.push({ label: cur, value: cur })
  return base
})

async function submitEdit() {
  if (!target.value) return
  editErrors.value = attendanceEditErrors(form.value)
  if (Object.keys(editErrors.value).length > 0) return
  saving.value = true
  try {
    await api.patchAttendance(target.value.id, {
      status: form.value.status,
      startedAt: fromLocalInput(form.value.startedAt),
      endedAt: fromLocalInput(form.value.endedAt),
      method: 'manual',
      memo: form.value.memo.trim(),
    })
    toast.add({ title: '출결 기록을 저장했습니다.', color: 'success' })
    editOpen.value = false
    load()
  } catch (e: any) {
    toast.add({ title: '저장 실패', description: dboErrorMessage(e), color: 'error' })
  } finally {
    saving.value = false
  }
}

/* 출결 삭제 — master·담당자, 오늘 활동만. 지운 내용·삭제자·사유가 삭제 기록에 남는다 */
const deleteOpen = ref(false)
const deleting = ref(false)
const deleteTarget = ref<AttendanceShift | null>(null)
const deleteReason = ref('')
const deleteError = ref<string | null>(null)

function canDelete(row: AttendanceShift) {
  return canDeleteAttendance(me.value?.role, row, todaySeoul())
}

function openDelete(row: AttendanceShift) {
  // 앞 요청이 끝나기 전에는 새 창을 열지 않는다. 창 상태를 한 벌만 두기 때문이다
  if (deleting.value || !canDelete(row)) return
  deleteTarget.value = row
  deleteReason.value = ''
  deleteError.value = null
  deleteOpen.value = true
}

/** 다시 눌러도 같은 결과인 실패. 목록이 낡은 것이라 새로 읽는다 */
const STALE_DELETE_ERRORS = ['attendance_not_found', 'not_found', 'not_today']

async function submitDelete() {
  const target = deleteTarget.value
  if (!target) return
  deleteError.value = deleteReasonError(deleteReason.value)
  if (deleteError.value) return
  deleting.value = true
  try {
    await api.deleteAttendance(target.id, deleteReason.value.trim())
    toast.add({ title: '출결 기록을 삭제했습니다.', color: 'success' })
    if (deleteTarget.value === target) deleteOpen.value = false
    load()
  } catch (e: any) {
    // 창을 닫지 않는다. 적은 사유가 그대로 남아 있어야 다시 시도할 수 있다
    if (deleteTarget.value === target) {
      deleteError.value = deleteErrorMessage(e) ?? dboErrorMessage(e, '출결을 삭제하지 못했습니다.')
    }
    if (STALE_DELETE_ERRORS.includes(e?.data?.error)) load()
  } finally {
    deleting.value = false
  }
}

/* 엑셀 — 조회 조건 전체를 100건씩 순회해 모은다 */
const EXCEL_COLUMNS: ExcelColumn[] = [
  { key: 'work_date', label: '근무일' },
  { key: 'name', label: '이름' },
  { key: 'phone', label: '전화번호' },
  { key: 'worksite', label: '근무지' },
  { key: 'planned_start', label: '예정 출근' },
  { key: 'planned_end', label: '예정 퇴근' },
  { key: 'status', label: '상태' },
  { key: 'started_at', label: '출근 시각' },
  { key: 'ended_at', label: '퇴근 시각' },
  { key: 'worked', label: '근무시간' },
  { key: 'method', label: '기록 방법' },
  { key: 'edited', label: '수정 이력' },
  { key: 'memo', label: '메모' },
]

function toExcelRow(row: AttendanceShift) {
  const rec = attendanceOf(row)
  const { kind, last } = editedOf(row)
  return {
    work_date: row.work_date,
    name: row.directory?.name ?? '',
    phone: row.directory?.phone ?? '',
    worksite: row.worksite?.name ?? '',
    planned_start: hhmm(row.planned_start),
    planned_end: hhmm(row.planned_end),
    status: attendanceDisplayLabel(attendanceDisplay(row)),
    started_at: fmtStamp(rec?.started_at),
    ended_at: fmtStamp(rec?.ended_at),
    worked: workedDuration(rec?.started_at, rec?.ended_at),
    method: rec?.method ?? '',
    edited:
      kind === 'edited' && last
        ? `수정됨 ${describeChange(last).who} ${fmtStamp(last.created_at)}`
        : kind === 'legacy'
          ? '수정됨(이력 없음)'
          : '',
    memo: rec?.memo ?? '',
  }
}

async function exportExcel() {
  await startExport()
  try {
    const all: AttendanceShift[] = []
    let p = 1
    // size 상한이 100이므로 페이지를 순회한다
    for (;;) {
      const res = await api.listAttendance({
        page: p,
        size: 100,
        q: lq.committedOf('q'),
        sort: sortKey.value,
        from: lq.committedOf('from'),
        to: lq.committedOf('to'),
        worksiteId: worksiteId.value || undefined,
        display: (display.value || undefined) as AttendanceDisplay | undefined,
      })
      all.push(...res.items)
      // 「수정 이력」 칸도 목록과 같은 기준으로 채운다. 이 페이지 몫의 이력을 함께 읽는다
      for (const [id, list] of await loadChanges(res.items)) changesByShift.value.set(id, list)
      if (all.length >= res.total || !res.items.length) break
      p++
    }
    if (!all.length) {
      toast.add({ title: '내보낼 기록이 없습니다.', color: 'warning' })
      return
    }
    downloadExcel(`출퇴근기록_${lq.committedOf('from')}_${lq.committedOf('to')}`, all.map(toExcelRow), EXCEL_COLUMNS)
  } catch (e: any) {
    toast.add({ title: '엑셀 내보내기 실패', description: dboErrorMessage(e), color: 'error' })
  } finally {
    finishExport()
  }
}

onMounted(() => {
  load()
  loadWorksites()
})
</script>

<template>
  <div class="flex min-h-[calc(100vh-8rem)] flex-col gap-6">
    <div v-if="me?.role === 'master'" class="flex gap-2" role="tablist">
      <AppButton
        size="sm"
        role="tab"
        :aria-selected="tab === 'records'"
        :variant="tab === 'records' ? 'solid' : 'outline'"
        :color="tab === 'records' ? 'primary' : 'neutral'"
        @click="tab = 'records'"
      >
        출결
      </AppButton>
      <AppButton
        size="sm"
        role="tab"
        :aria-selected="tab === 'deletions'"
        :variant="tab === 'deletions' ? 'solid' : 'outline'"
        :color="tab === 'deletions' ? 'primary' : 'neutral'"
        @click="tab = 'deletions'"
      >
        삭제 기록
      </AppButton>
    </div>

    <AttendanceDeletionsPanel v-if="tab === 'deletions' && me?.role === 'master'" />

    <template v-else>
    <Teleport to="#admin-topbar-actions">
      <AppButton
        variant="outline"
        color="neutral"
        icon="i-lucide-download"
        :loading="exporting"
        @click="exportExcel"
      >
        엑셀 다운로드
      </AppButton>
    </Teleport>

    <!-- 조회 조건 -->
    <AppCard>
      <div class="flex flex-wrap items-end gap-4">
        <FormField label="시작일">
          <DateField v-model="from" />
        </FormField>
        <FormField label="종료일">
          <DateField v-model="to" />
        </FormField>
        <AppButton size="sm" icon="i-lucide-search" @click="search">조회</AppButton>
        <div class="ml-auto flex gap-2">
          <AppButton variant="outline" color="neutral" size="sm" @click="setRange(0)">오늘</AppButton>
          <AppButton variant="outline" color="neutral" size="sm" @click="setRange(6)">최근 7일</AppButton>
          <AppButton variant="outline" color="neutral" size="sm" @click="setRange(29)">최근 30일</AppButton>
        </div>
      </div>
    </AppCard>

    <!-- 조회 결과 집계 -->
    <div class="grid grid-cols-2 gap-6 md:grid-cols-5">
      <!-- 조회 중에는 0 대신 「…」 — 0 은 「기록이 없다」로 읽힌다 -->
      <StatCard label="조회된 근무" :value="loading ? '…' : total.toLocaleString()" />
      <StatCard label="퇴근 완료" :value="loading ? '…' : summary.done" tone="up" />
      <StatCard label="근무 중" :value="loading ? '…' : summary.working" tone="primary" />
      <StatCard label="퇴근 누락" :value="loading ? '…' : summary.missingCheckout" tone="down" />
      <StatCard label="미기록·결근" :value="loading ? '…' : summary.missing" tone="down" />
    </div>

    <DataTable
      :columns="columns"
      :rows="rows"
      :loading="loading"
      :sort-key="sortKey"
      sort-dir="asc"
      :page="page"
      :page-size="pageSize"
      :total="total"
      :page-size-options="[20, 50, 100]"
      empty-text="해당 조건의 근무가 없습니다."
      @sort="toggleSort"
      @update:page="
        (p) => {
          page = p
          load()
        }
      "
      @update:page-size="
        (s) => {
          pageSize = s
          page = 1
          load()
        }
      "
    >
      <template #toolbar>
        <PillSearch v-model="q" placeholder="이름 또는 전화번호" @search="search" />
        <PillSelect
          v-model="worksiteId"
          :options="[
            { label: '근무지 전체', value: '' },
            ...worksites.map((w) => ({ label: w.name, value: w.id })),
          ]"
        />
        <PillSelect
          v-model="display"
          :options="[{ label: '상태 전체', value: '' }, ...ATTENDANCE_DISPLAY_OPTIONS]"
        />
      </template>
      <template #toolbar-end>
        <span class="text-sm text-muted tabular-nums">{{ from }} ~ {{ to }}</span>
      </template>

      <template #cell-name="{ row }">
        <span class="font-medium text-ink">{{ row.directory?.name ?? '—' }}</span>
        <span class="ml-1.5 text-muted">{{ fmtPhone(row.directory?.phone) }}</span>
      </template>
      <template #cell-worksite="{ row }">{{ row.worksite?.name ?? '—' }}</template>
      <template #cell-planned="{ row }">
        {{ hhmm(row.planned_start) }} – {{ hhmm(row.planned_end) }}
      </template>
      <template #cell-status="{ row }">
        <StatusBadge :tone="attendanceDisplayTone(attendanceDisplay(row as AttendanceShift))">
          {{ attendanceDisplayLabel(attendanceDisplay(row as AttendanceShift)) }}
        </StatusBadge>
      </template>
      <template #cell-started_at="{ row }">{{ fmtClock(attendanceOf(row)?.started_at) }}</template>
      <template #cell-ended_at="{ row }">{{ fmtClock(attendanceOf(row)?.ended_at) }}</template>
      <template #cell-worked="{ row }">
        <span class="tabular-nums">
          {{ workedDuration(attendanceOf(row)?.started_at, attendanceOf(row)?.ended_at) }}
        </span>
      </template>
      <template #cell-method="{ row }">
        <span class="text-muted">{{ attendanceOf(row)?.method ?? '—' }}</span>
      </template>
      <!-- 누르면 변경 이력 창. 고친 사람·시각은 변경 이력에서 가져온다 -->
      <template #cell-edited="{ row }">
        <button
          v-if="editedOf(row as AttendanceShift).kind"
          type="button"
          class="text-sm text-brand-500 hover:underline"
          @click="openHistory(row as AttendanceShift)"
        >
          <template v-if="editedOf(row as AttendanceShift).last">
            수정됨 · {{ editedOf(row as AttendanceShift).last!.changed_by_name ?? '알 수 없음' }} ·
            {{ fmtStamp(editedOf(row as AttendanceShift).last!.created_at) }}
          </template>
          <template v-else>수정됨 (이력 없음)</template>
        </button>
        <span v-else class="text-muted">—</span>
      </template>
      <template #cell-memo="{ row }">
        <span class="text-muted">{{ attendanceOf(row)?.memo ?? '—' }}</span>
      </template>

      <template #actions="{ row }">
        <div class="flex items-center gap-3">
          <button
            v-if="canEditAttendance(row.work_date, todaySeoul())"
            type="button"
            class="text-sm font-medium text-brand-500 hover:underline"
            @click="openEdit(row)"
          >
            기록 수정
          </button>
          <span v-else class="text-sm text-muted">예정</span>
          <button
            v-if="canDelete(row as AttendanceShift)"
            type="button"
            class="text-sm font-medium text-down hover:underline"
            @click="openDelete(row as AttendanceShift)"
          >
            삭제
          </button>
        </div>
      </template>
    </DataTable>

    <!-- 대리 기록 -->
    <AppModal v-model:open="editOpen" title="출결 기록 수정" width="max-w-lg">
      <div v-if="target" class="space-y-4">
        <div class="rounded-lg border border-hairline bg-surface-soft px-4 py-3 text-sm">
          <p class="font-semibold text-ink">
            {{ target.directory?.name ?? '—' }} · {{ target.worksite?.name ?? '—' }}
          </p>
          <p class="mt-0.5 text-muted">
            {{ target.work_date }} 예정 {{ hhmm(target.planned_start) }} –
            {{ hhmm(target.planned_end) }}
          </p>
        </div>
        <FormField label="상태" required>
          <SelectField v-model="form.status" :options="statusOptions" />
        </FormField>
        <div class="grid grid-cols-2 gap-4">
          <FormField label="출근 시각">
            <DateField v-model="form.startedAt" type="datetime-local" />
          </FormField>
          <FormField label="퇴근 시각" :error="editErrors.endedAt">
            <DateField v-model="form.endedAt" type="datetime-local" />
          </FormField>
        </div>
        <FormField
          label="수정 사유"
          required
          :hint="attendanceOf(target)?.memo ? `이전 메모: ${attendanceOf(target)?.memo}` : undefined"
          :error="editErrors.memo"
        >
          <AppTextarea v-model="form.memo" :rows="3" />
        </FormField>
        <p class="text-xs text-muted">
          저장하면 기록 방법이 <span class="font-medium text-body">manual</span>(관리자 대리 기록)로
          남습니다.
        </p>
      </div>
      <template #footer>
        <AppButton variant="outline" color="neutral" size="sm" @click="editOpen = false">
          취소
        </AppButton>
        <AppButton size="sm" :loading="saving" @click="submitEdit">저장</AppButton>
      </template>
    </AppModal>

    <!-- 출결 삭제. 임금과 이어진 기록이라 경고를 먼저 보이고 사유를 받는다 -->
    <AppModal v-model:open="deleteOpen" title="출결 기록 삭제" width="max-w-lg">
      <div v-if="deleteTarget" class="space-y-4">
        <div class="rounded-lg border border-down bg-down-soft px-4 py-3 text-sm text-down" role="alert">
          <p class="font-semibold">삭제하기 전에 확인해 주세요.</p>
          <ul class="mt-1.5 list-disc space-y-0.5 pl-5">
            <li>이 활동의 출근·퇴근 기록이 사라지고, <b>활동비(임금) 정산에 그대로 반영</b>됩니다.</li>
            <li>삭제한 사람과 사유는 기록으로 남으며, 되돌리거나 지울 수 없습니다.</li>
            <li>삭제한 뒤에도 시니어는 오늘 QR 출근을 다시 찍을 수 있습니다.</li>
          </ul>
        </div>
        <div class="rounded-lg border border-hairline bg-surface-soft px-4 py-3 text-sm">
          <p class="font-semibold text-ink">
            {{ deleteTarget.directory?.name ?? '—' }} · {{ deleteTarget.worksite?.name ?? '—' }}
          </p>
          <p class="mt-0.5 text-muted tabular-nums">
            {{ deleteTarget.work_date }} ·
            {{ attendanceDisplayLabel(attendanceDisplay(deleteTarget)) }} · 출근
            {{ fmtClock(attendanceOf(deleteTarget)?.started_at) }} · 퇴근
            {{ fmtClock(attendanceOf(deleteTarget)?.ended_at) }}
          </p>
        </div>
        <FormField label="삭제 사유" required :error="deleteError ?? undefined">
          <AppTextarea
            v-model="deleteReason"
            :rows="3"
            :maxlength="DELETE_REASON_MAX"
            placeholder="예: 현장 확인 결과 미출근(허위 출결)"
          />
        </FormField>
      </div>
      <template #footer>
        <AppButton variant="outline" color="neutral" size="sm" @click="deleteOpen = false">
          취소
        </AppButton>
        <AppButton
          color="down"
          size="sm"
          :loading="deleting"
          :disabled="!deleteReason.trim()"
          @click="submitDelete"
        >
          삭제
        </AppButton>
      </template>
    </AppModal>

    <!-- 변경 이력(QA 2026-10-14 13번) -->
    <AppModal v-model:open="historyOpen" title="출결 변경 이력" width="max-w-lg">
      <div v-if="historyTarget" class="space-y-4">
        <div class="rounded-lg border border-hairline bg-surface-soft px-4 py-3 text-sm">
          <p class="font-semibold text-ink">
            {{ historyTarget.directory?.name ?? '—' }} · {{ historyTarget.worksite?.name ?? '—' }}
          </p>
          <p class="mt-0.5 text-muted">{{ historyTarget.work_date }}</p>
        </div>
        <ul v-if="historyLines.length" class="space-y-3">
          <li v-for="(line, i) in historyLines" :key="i" class="rounded-lg border border-hairline px-4 py-3 text-sm">
            <p class="text-muted tabular-nums">{{ line.when }} · {{ line.who }}</p>
            <p class="mt-1 font-medium text-ink">{{ line.what }}</p>
            <p v-if="line.memo" class="mt-1 text-body">사유: {{ line.memo }}</p>
          </li>
        </ul>
        <p v-else class="text-sm text-muted">
          변경 이력 기능(10월 11일) 전에 수정된 기록이라 상세 내역이 없습니다.
        </p>
      </div>
      <template #footer>
        <AppButton variant="outline" color="neutral" size="sm" @click="historyOpen = false">닫기</AppButton>
      </template>
    </AppModal>
    </template>
  </div>
</template>
