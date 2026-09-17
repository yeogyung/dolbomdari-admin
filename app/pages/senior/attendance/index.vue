<!-- 출퇴근 기록 — 기간·근무지·이름 조회 + 대리 기록 수정 + 엑셀 내보내기 (/dbo-admin/attendance) -->
<script setup lang="ts">
import { ref, computed, watch, onMounted } from 'vue'
import { downloadExcel, type ExcelColumn } from '~/utils/excel'
import type { Column } from '~/types/table'
import type { AttendanceShift, Worksite } from '~/types/dbo'

const api = useDboAdmin()
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
const exporting = ref(false)

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
  // 대리 수정 흔적. updated_by 는 어드민 PATCH 만 채운다(QR 기록은 recorded_by 만).
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
  } catch (e: any) {
    toast.add({ title: '출결 조회 실패', description: dboErrorMessage(e), color: 'error' })
  } finally {
    loading.value = false
  }
}

async function loadWorksites() {
  try {
    const res = await api.listWorksites({ size: 100, sort: 'name' })
    worksites.value = res.items
  } catch {
    // 근무지 필터는 편의 기능이다.
  }
}

function search() {
  page.value = 1
  load()
}

function setRange(days: number) {
  to.value = todaySeoul()
  from.value = days === 0 ? todaySeoul() : daysAgoSeoul(days)
  search()
}

function toggleSort(key: string) {
  sortKey.value = key
  page.value = 1
  load()
}

watch(worksiteId, search)

/* 집계 — 조회된 페이지 기준.
 *
 * **완료 여부는 status 가 아니라 ended_at 으로 판정한다.** 서버는 QR 출퇴근에
 * status='present' 를 쓰고 퇴근해도 그 값을 바꾸지 않는다 — 퇴근했는지는
 * ended_at 이 찼는지로만 알 수 있다(2026-09-06 실측: DB 에 checked_out 이 0건). */
const summary = computed(() => {
  const stat = { total: rows.value.length, working: 0, done: 0, missing: 0 }
  for (const row of rows.value) {
    const rec = attendanceOf(row)
    if (!rec) stat.missing++
    else if (rec.status === 'absent') stat.missing++
    else if (rec.ended_at) stat.done++
    else stat.working++
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

function openEdit(row: AttendanceShift) {
  const rec = attendanceOf(row)
  target.value = row
  form.value = {
    status: rec?.status ?? 'present',
    startedAt: toLocalInput(rec?.started_at),
    endedAt: toLocalInput(rec?.ended_at),
    memo: rec?.memo ?? '',
  }
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
  saving.value = true
  try {
    await api.patchAttendance(target.value.id, {
      status: form.value.status,
      startedAt: fromLocalInput(form.value.startedAt),
      endedAt: fromLocalInput(form.value.endedAt),
      method: 'manual',
      memo: form.value.memo.trim() || null,
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
  return {
    work_date: row.work_date,
    name: row.directory?.name ?? '',
    phone: row.directory?.phone ?? '',
    worksite: row.worksite?.name ?? '',
    planned_start: hhmm(row.planned_start),
    planned_end: hhmm(row.planned_end),
    status: attendanceLabel(rec?.status),
    started_at: fmtStamp(rec?.started_at),
    ended_at: fmtStamp(rec?.ended_at),
    worked: workedDuration(rec?.started_at, rec?.ended_at),
    method: rec?.method ?? '',
    edited: rec?.updated_by ? `수정됨 ${fmtStamp(rec.updated_at)}` : '',
    memo: rec?.memo ?? '',
  }
}

async function exportExcel() {
  exporting.value = true
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
    exporting.value = false
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
    <div class="grid grid-cols-2 gap-6 md:grid-cols-4">
      <StatCard label="조회된 근무" :value="total.toLocaleString()" />
      <StatCard label="퇴근 완료" :value="summary.done" tone="up" />
      <StatCard label="근무 중" :value="summary.working" tone="primary" />
      <StatCard label="미기록·결근" :value="summary.missing" tone="down" />
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
        <StatusBadge :tone="attendanceTone(attendanceOf(row)?.status)">
          {{ attendanceLabel(attendanceOf(row)?.status) }}
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
      <!-- 고친 사람의 이름은 API 가 안 준다(updated_by 는 프로필 UUID 다). 시각만 적는다. -->
      <template #cell-edited="{ row }">
        <span v-if="attendanceOf(row)?.updated_by" class="text-muted">
          수정됨 · {{ fmtStamp(attendanceOf(row)!.updated_at) }}
        </span>
        <span v-else class="text-muted">—</span>
      </template>
      <template #cell-memo="{ row }">
        <span class="text-muted">{{ attendanceOf(row)?.memo ?? '—' }}</span>
      </template>

      <template #actions="{ row }">
        <button
          type="button"
          class="text-sm font-medium text-brand-500 hover:underline"
          @click="openEdit(row)"
        >
          기록 수정
        </button>
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
          <FormField label="퇴근 시각">
            <DateField v-model="form.endedAt" type="datetime-local" />
          </FormField>
        </div>
        <FormField label="메모" hint="대리 기록 사유를 남겨 주세요.">
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
  </div>
</template>
