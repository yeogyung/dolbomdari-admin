<!-- 출결 삭제 기록 — master 전용 탭. 기간(활동 날짜)·이름으로 조회 (/dbo-admin/attendance-deletions) -->
<script setup lang="ts">
import { ref, onMounted } from 'vue'
import type { Column } from '~/types/table'
import type { AttendanceDeletion } from '~/types/dbo'

const api = useDboAdmin()
const toast = useToast()

const rows = ref<AttendanceDeletion[]>([])
const total = ref(0)
const page = ref(1)
const pageSize = ref(20)
const q = ref('')
const from = ref(daysAgoSeoul(29))
const to = ref(todaySeoul())
const loading = ref(false)
/** 「조회」를 눌러 정해진 조건. 페이지를 넘길 때 입력만 하고 안 누른 값이 섞이지 않게 한다 */
const applied = ref({ q: '', from: from.value, to: to.value })

const ROLE_LABELS: Record<string, string> = { master: '운영관리자', manager: '담당자' }

const columns: Column[] = [
  { key: 'deleted_at', label: '삭제 일시', strong: true },
  { key: 'deleted_by', label: '삭제한 사람' },
  { key: 'senior', label: '이름' },
  { key: 'work_date', label: '근무일' },
  { key: 'worksite', label: '근무지' },
  { key: 'status', label: '지운 상태' },
  { key: 'times', label: '지운 출퇴근' },
  { key: 'reason', label: '삭제 사유' },
]

/** 조회 순번 — 늦게 온 이전 응답이 새 결과를 덮지 않게 마지막 요청만 반영한다 */
let sequence = 0
async function load() {
  const current = ++sequence
  loading.value = true
  try {
    const res = await api.listAttendanceDeletions({
      page: page.value,
      size: pageSize.value,
      q: applied.value.q,
      from: applied.value.from,
      to: applied.value.to,
    })
    if (current !== sequence) return
    rows.value = res.items
    total.value = res.total
  } catch (e: any) {
    if (current !== sequence) return
    // 삭제용 문구표(deleteErrorMessage)는 쓰지 않는다 — 여기서 forbidden 은 「삭제 권한」이 아니다
    toast.add({
      title: '삭제 기록 조회 실패',
      description: e?.data?.error === 'query_too_broad' ? QUERY_TOO_BROAD : dboErrorMessage(e),
      color: 'error',
    })
  } finally {
    if (current === sequence) loading.value = false
  }
}

function search() {
  applied.value = { q: q.value, from: from.value, to: to.value }
  page.value = 1
  return load()
}

onMounted(load)
</script>

<template>
  <div class="flex flex-col gap-6">
    <AppCard>
      <div class="flex flex-wrap items-end gap-4">
        <FormField label="근무일 시작">
          <DateField v-model="from" />
        </FormField>
        <FormField label="근무일 종료">
          <DateField v-model="to" />
        </FormField>
        <AppButton size="sm" icon="i-lucide-search" @click="search">조회</AppButton>
      </div>
      <p class="mt-3 text-xs text-muted">
        삭제 기록은 고치거나 지울 수 없고, 삭제 후 3년이 지나면 자동으로 파기됩니다.
      </p>
    </AppCard>

    <DataTable
      :columns="columns"
      :rows="rows"
      :loading="loading"
      :page="page"
      :page-size="pageSize"
      :total="total"
      :page-size-options="[20, 50, 100]"
      empty-text="해당 기간에 삭제된 출결이 없습니다."
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
      </template>

      <template #cell-deleted_at="{ row }">
        <span class="tabular-nums">{{ fmtStamp(row.deleted_at) }}</span>
      </template>
      <template #cell-deleted_by="{ row }">
        <span class="font-medium text-ink">{{ row.deleted_by?.name ?? '(알 수 없음)' }}</span>
        <span class="ml-1.5 text-muted">{{ ROLE_LABELS[row.deleted_by_role] ?? row.deleted_by_role }}</span>
      </template>
      <template #cell-senior="{ row }">
        <span class="font-medium text-ink">{{ row.senior?.name ?? '(알 수 없음)' }}</span>
        <span class="ml-1.5 text-muted">{{ fmtPhone(row.senior?.phone) }}</span>
      </template>
      <template #cell-worksite="{ row }">{{ row.worksite?.name ?? '(알 수 없음)' }}</template>
      <template #cell-status="{ row }">{{ attendanceLabel(row.status) }}</template>
      <template #cell-times="{ row }">
        <span class="tabular-nums">{{ fmtClock(row.started_at) }} – {{ fmtClock(row.ended_at) }}</span>
      </template>
      <template #cell-reason="{ row }">
        <span class="whitespace-pre-line text-body">{{ row.reason }}</span>
      </template>
    </DataTable>
  </div>
</template>
