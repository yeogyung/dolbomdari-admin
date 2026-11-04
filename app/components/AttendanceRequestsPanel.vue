<!-- 출결 조정 요청 목록 — 담당자·master 는 확정·반려(조정 요청 메뉴), 수요처는 「내 요청」 탭으로 처리 상태만 본다 (/dbo-admin/attendance-requests) -->
<script setup lang="ts">
import { ref, computed, watch, onMounted } from 'vue'
import type { Column } from '~/types/table'
import type { AttendanceRequestItem, AttendanceRequestStatus, Worksite } from '~/types/dbo'

/** decide: 확정·반려 버튼과 근무지 필터를 낸다(담당자·master). 없으면 수요처의 「내 요청」 */
const props = defineProps<{ decide?: boolean }>()

const api = useDboAdmin()
const toast = useToast()
const pending = useAttendanceRequestCount()

const rows = ref<AttendanceRequestItem[]>([])
const total = ref(0)
const page = ref(1)
const pageSize = ref(20)
/** 처리 상태 — 확정하는 쪽은 기다리는 요청부터, 수요처는 전부 */
const statusFilter = ref<AttendanceRequestStatus | ''>(props.decide ? 'pending' : '')
const worksiteId = ref('')
const worksites = ref<Worksite[]>([])
const loading = ref(false)
/** 옛 서버(경로 없음) — 표 대신 안내한다 */
const unsupported = ref(false)
const loadError = ref('')

const columns: Column[] = [
  { key: 'work_date', label: '근무일', strong: true },
  { key: 'senior', label: '이름' },
  { key: 'worksite', label: '근무지' },
  { key: 'requested', label: '요청 내용' },
  { key: 'current', label: '지금 기록' },
  { key: 'requested_by', label: '요청자' },
  { key: 'status', label: '처리' },
]

/** 이 목록이 메뉴의 기다림 수와 같은 조건인가(기다림 · 근무지 전체) — 그러면 total 을 그대로 쓴다 */
const countFollowsList = computed(() => props.decide && statusFilter.value === 'pending' && !worksiteId.value)

/** 조회 순번 — 늦게 온 이전 응답이 새 결과를 덮지 않게 마지막 요청만 반영한다 */
let sequence = 0
async function load() {
  const current = ++sequence
  loading.value = true
  try {
    const res = await api.listAttendanceRequests({
      status: statusFilter.value || undefined,
      worksiteId: worksiteId.value || undefined,
      page: page.value,
      size: pageSize.value,
    })
    if (current !== sequence) return
    rows.value = res.items
    total.value = res.total
    unsupported.value = false
    loadError.value = ''
    if (countFollowsList.value) pending.set(res.total)
  } catch (e) {
    if (current !== sequence) return
    rows.value = []
    total.value = 0
    unsupported.value = requestsUnsupported(e)
    loadError.value = unsupported.value ? '' : requestListErrorMessage(e)
  } finally {
    if (current === sequence) loading.value = false
  }
}

async function loadWorksites() {
  try {
    // 근무지는 100곳을 넘는다 — 끝까지 받는다. 담당자는 서버가 맡은 근무지로 좁힌다
    worksites.value = await api.listAllWorksites()
  } catch (e) {
    // 목록은 그대로 되지만 필터 선택지가 빈다 — 조용히 넘기지 않는다(출퇴근 기록과 같다)
    toast.add({ title: '근무지 목록을 불러오지 못했습니다.', description: dboErrorMessage(e), color: 'warning' })
  }
}

watch([statusFilter, worksiteId], () => {
  page.value = 1
  load()
})

/* 확정·반려 — 모양은 출퇴근 기록의 수정·삭제 창(기록 상자 + 칸 + 취소/실행)을 따른다 */
const decision = ref<{ item: AttendanceRequestItem; action: 'approve' | 'reject' } | null>(null)
const decisionOpen = computed({
  get: () => !!decision.value,
  set: (v: boolean) => {
    if (!v) decision.value = null
  },
})
const memo = ref('')
const deciding = ref(false)
const decisionError = ref('')

function openDecision(item: AttendanceRequestItem, action: 'approve' | 'reject') {
  if (deciding.value) return
  if (action === 'approve' && approveBlock(item)) return
  memo.value = ''
  decisionError.value = ''
  decision.value = { item, action }
}

async function submitDecision() {
  const d = decision.value
  if (!d || deciding.value) return
  deciding.value = true
  decisionError.value = ''
  try {
    const note = memo.value.trim() || null
    if (d.action === 'approve') await api.approveAttendanceRequest(d.item.id, note)
    else await api.rejectAttendanceRequest(d.item.id, note)
    toast.add({ title: d.action === 'approve' ? '확정했습니다. 출결 기록이 바뀌었습니다.' : '반려했습니다.', color: 'success' })
    decision.value = null
  } catch (e) {
    // 창을 닫지 않는다 — 확정이 끝나지 않음(approve_incomplete) 같은 안내가 잠깐 뜨고 사라지지 않게
    decisionError.value = requestDecisionErrorMessage(e, d.action)
  } finally {
    deciding.value = false
    // 성공·실패 모두 다시 읽는다 — 처리됨·낡음·근무 지워짐이 목록에 바로 보이게
    load()
    if (!countFollowsList.value) pending.refresh()
  }
}

onMounted(() => {
  load()
  if (props.decide) loadWorksites()
})
</script>

<template>
  <div class="flex flex-col gap-6">
    <EmptyState v-if="unsupported" icon="i-lucide-info" :title="REQUESTS_UNSUPPORTED" />

    <template v-else>
      <p class="text-sm text-muted">
        <template v-if="decide">
          수요처가 보낸 출결 조정 요청입니다. 확정하면 출결이 바라는 기록으로 바뀌고 확정한 사람이 남습니다.
        </template>
        <template v-else>
          「조정 요청」으로 보낸 요청과 처리 결과입니다. 담당자가 확정하면 출퇴근 기록이 바뀝니다.
        </template>
      </p>
      <p v-if="loadError" role="alert" class="text-sm text-red-600">{{ loadError }}</p>

      <DataTable
        :columns="columns"
        :rows="rows"
        :loading="loading"
        :page="page"
        :page-size="pageSize"
        :total="total"
        :page-size-options="[20, 50, 100]"
        :empty-text="decide ? '조건에 맞는 조정 요청이 없습니다.' : '보낸 조정 요청이 없습니다.'"
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
          <PillSelect
            v-model="statusFilter"
            :options="[
              { label: '처리 상태 전체', value: '' },
              { label: '기다림', value: 'pending' },
              { label: '확정', value: 'approved' },
              { label: '반려', value: 'rejected' },
            ]"
          />
          <PillSelect
            v-if="decide"
            v-model="worksiteId"
            :options="[{ label: '근무지 전체', value: '' }, ...worksites.map((w) => ({ label: w.name, value: w.id }))]"
          />
          <AppButton variant="outline" @click="load">새로고침</AppButton>
        </template>

        <template #cell-senior="{ row }">
          <span class="font-medium text-ink">{{ row.senior?.name ?? '—' }}</span>
        </template>
        <template #cell-worksite="{ row }">{{ row.worksite?.name ?? '—' }}</template>
        <template #cell-requested="{ row }">
          <p class="text-body">{{ requestedLine(row as AttendanceRequestItem) }}</p>
          <p class="mt-0.5 max-w-xs truncate text-xs text-muted" :title="row.reason">사유: {{ row.reason }}</p>
        </template>
        <template #cell-current="{ row }">
          <p class="text-body">{{ attendanceLine(row.current) }}</p>
          <p v-if="row.stale" class="mt-0.5 text-xs font-medium text-accent">요청 뒤 기록이 바뀌었습니다</p>
        </template>
        <template #cell-requested_by="{ row }">
          {{ row.requested_by_name ?? '—' }}
          <span class="block text-xs text-muted tabular-nums">{{ fmtStamp(row.created_at) }}</span>
        </template>
        <template #cell-status="{ row }">
          <StatusBadge :tone="requestStatusTone(row.status)">{{ REQUEST_STATUS_LABELS[row.status as AttendanceRequestStatus] }}</StatusBadge>
          <span v-if="row.decided_at" class="mt-1 block text-xs text-muted tabular-nums">
            {{ row.decided_by_name ?? '—' }} · {{ fmtStamp(row.decided_at) }}
          </span>
          <span v-if="row.decision_memo" class="mt-0.5 block max-w-xs text-xs text-body">메모: {{ row.decision_memo }}</span>
        </template>

        <!-- 휴대폰 폭 카드 — 수요처는 출퇴근 기록(휴대폰에서 여는 화면)의 탭으로 본다. 칸은 표와 같다 -->
        <template #card="{ row }">
          <div class="space-y-1.5 text-sm">
            <div class="flex items-start justify-between gap-3">
              <p class="min-w-0 truncate">
                <span class="font-medium text-ink">{{ row.senior?.name ?? '—' }}</span>
                <span class="ml-1.5 text-muted">{{ row.worksite?.name ?? '—' }}</span>
              </p>
              <StatusBadge :tone="requestStatusTone(row.status)">{{ REQUEST_STATUS_LABELS[row.status as AttendanceRequestStatus] }}</StatusBadge>
            </div>
            <p class="text-muted tabular-nums">{{ row.work_date }} · 요청 {{ fmtStamp(row.created_at) }}</p>
            <p class="text-body">바라는 기록: {{ requestedLine(row as AttendanceRequestItem) }}</p>
            <p class="text-body">지금 기록: {{ attendanceLine(row.current) }}</p>
            <p v-if="row.stale" class="font-medium text-accent">요청 뒤 기록이 바뀌었습니다</p>
            <p class="text-muted">사유: {{ row.reason }}</p>
            <p v-if="row.decision_memo" class="text-body">처리 메모: {{ row.decision_memo }}</p>
          </div>
        </template>

        <template v-if="decide" #actions="{ row }">
          <div v-if="row.status === 'pending'" class="flex items-center justify-end gap-3">
            <button
              type="button"
              class="text-sm font-medium text-brand-500 hover:underline disabled:cursor-not-allowed disabled:text-muted disabled:no-underline"
              :disabled="!!approveBlock(row as AttendanceRequestItem)"
              :title="approveBlock(row as AttendanceRequestItem) ?? undefined"
              @click="openDecision(row as AttendanceRequestItem, 'approve')"
            >
              확정
            </button>
            <button
              type="button"
              class="text-sm font-medium text-down hover:underline"
              @click="openDecision(row as AttendanceRequestItem, 'reject')"
            >
              반려
            </button>
          </div>
        </template>
      </DataTable>
    </template>

    <AppModal
      v-model:open="decisionOpen"
      :title="decision?.action === 'approve' ? '이 요청을 확정할까요?' : '이 요청을 반려할까요?'"
      width="max-w-lg"
      :before-close="() => !deciding"
    >
      <div v-if="decision" class="space-y-4">
        <p v-if="decisionError" role="alert" class="text-sm text-red-600">{{ decisionError }}</p>
        <div class="rounded-lg border border-hairline bg-surface-soft px-4 py-3 text-sm">
          <p class="font-semibold text-ink">
            {{ decision.item.senior?.name ?? '—' }} · {{ decision.item.worksite?.name ?? '—' }}
          </p>
          <p class="mt-0.5 text-muted tabular-nums">
            {{ decision.item.work_date }}
            <template v-if="decision.item.shift">
              예정 {{ hhmm(decision.item.shift.planned_start) }} – {{ hhmm(decision.item.shift.planned_end) }}
            </template>
          </p>
          <p class="mt-1.5 text-body">지금 기록: {{ attendanceLine(decision.item.current) }}</p>
          <p class="text-body">바라는 기록: {{ requestedLine(decision.item) }}</p>
          <p class="mt-1 text-muted">사유: {{ decision.item.reason }} · {{ decision.item.requested_by_name ?? '—' }}</p>
        </div>
        <p v-if="decision.action === 'approve'" class="text-sm text-body">
          확정하면 출결이 바라는 기록으로 바뀌고, 기록 방법은 <span class="font-medium">manual</span>, 고친 사람은 확정한 분으로
          남습니다.
        </p>
        <FormField
          :label="decision.action === 'approve' ? '처리 메모' : '반려 사유'"
          hint="수요처의 「내 요청」에 보입니다. 비워도 됩니다."
        >
          <AppTextarea v-model="memo" :rows="3" :maxlength="REQUEST_REASON_MAX" />
        </FormField>
      </div>
      <template #footer>
        <AppButton variant="outline" color="neutral" size="sm" :disabled="deciding" @click="decision = null">취소</AppButton>
        <AppButton
          size="sm"
          :color="decision?.action === 'reject' ? 'down' : 'primary'"
          :loading="deciding"
          @click="submitDecision"
        >
          {{ decision?.action === 'approve' ? '확정' : '반려' }}
        </AppButton>
      </template>
    </AppModal>
  </div>
</template>
