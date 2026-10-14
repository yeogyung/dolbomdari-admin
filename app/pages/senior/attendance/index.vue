<!-- 출퇴근 기록 — 기간·근무지·이름 조회 + 대리 기록 수정 + 엑셀 내보내기 (/dbo-admin/attendance) -->
<script setup lang="ts">
import { ref, computed, watch, onMounted } from 'vue'
import { downloadExcel, type ExcelColumn } from '~/utils/excel'
import type { Column } from '~/types/table'
import type { AttendanceChange, AttendanceShift, Worksite } from '~/types/dbo'

const api = useDboAdmin()
const { listChangesByShifts } = useAttendanceChanges()
const toast = useToast()
const { setHeader } = useAdminHeader()
setHeader('출퇴근 기록')

const rows = ref<AttendanceShift[]>([])
const total = ref(0)
const page = ref(1)
const pageSize = ref(20)
const q = ref('')
const from = ref(todaySeoul())
const to = ref(todaySeoul())
const worksiteId = ref<string | null>(null)
const sortKey = ref('work_date')
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

async function load() {
  loading.value = true
  try {
    const res = await api.listAttendance({
      page: page.value,
      size: pageSize.value,
      q: q.value,
      sort: sortKey.value,
      from: from.value,
      to: to.value,
      worksiteId: worksiteId.value || undefined,
    })
    rows.value = res.items
    total.value = res.total
    changesByShift.value = await loadChanges(res.items)
  } catch (e: any) {
    toast.add({ title: '출결 조회 실패', description: dboErrorMessage(e), color: 'error' })
  } finally {
    loading.value = false
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
    const res = await api.listWorksites({ size: 100, sort: 'name' })
    worksites.value = res.items
  } catch {
    // 근무지 필터는 편의 기능이다.
  }
}

// 조회 Promise 를 돌려준다 — 조회 버튼(AppButton)이 끝날 때까지 다시 눌리지 않게
function search() {
  page.value = 1
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

watch(worksiteId, search)

/* 집계 — 조회된 페이지 기준. 목록과 같은 표시 상태(attendanceDisplay)로 센다.
 * 퇴근 완료 = 정상 + 지각, 미기록·결근 = 미출근 + 결석. 인정 결석·출근 전은 어디에도 세지 않는다.
 * 예전에는 지난 날의 퇴근 누락까지 「근무 중」으로 셌다(QA 2026-10-14 11번). */
const summary = computed(() => {
  const stat = { working: 0, done: 0, missing: 0, noCheckout: 0 }
  for (const row of rows.value) {
    const d = attendanceDisplay(row)
    if (d === 'normal' || d === 'late') stat.done++
    else if (d === 'working') stat.working++
    else if (d === 'missing_checkout') stat.noCheckout++
    else if (d === 'not_arrived' || d === 'absent') stat.missing++
  }
  return stat
})

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
const today = todaySeoul()

function openEdit(row: AttendanceShift) {
  if (!canEditAttendance(row.work_date, today)) return
  const rec = attendanceOf(row)
  target.value = row
  // 사유는 빈칸으로 시작한다. 이전 메모를 채워 두면 그대로 저장해도 필수 검사를
  // 통과하고, 수정 이력에도 옛 사유가 이번 변경의 사유처럼 남는다(QA 2026-10-14 6번).
  form.value = {
    status: rec?.status ?? 'present',
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
        q: q.value,
        sort: sortKey.value,
        from: from.value,
        to: to.value,
        worksiteId: worksiteId.value || undefined,
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
    downloadExcel(`출퇴근기록_${from.value}_${to.value}`, all.map(toExcelRow), EXCEL_COLUMNS)
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
      <StatCard label="퇴근 누락" :value="loading ? '…' : summary.noCheckout" tone="down" />
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
        <button
          v-if="canEditAttendance(row.work_date, today)"
          type="button"
          class="text-sm font-medium text-brand-500 hover:underline"
          @click="openEdit(row)"
        >
          기록 수정
        </button>
        <span v-else class="text-sm text-muted">예정</span>
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
  </div>
</template>
