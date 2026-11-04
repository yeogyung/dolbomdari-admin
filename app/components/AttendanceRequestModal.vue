<!-- 수요처의 출결 조정 요청 창 — 상태·출근·퇴근·사유 → POST /dbo-admin/attendance/{shiftId}/requests (QA PARTNER-01) -->
<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import type { AttendanceShift } from '~/types/dbo'
import type { AdjustmentErrors, AdjustmentForm } from '~/utils/attendanceRequests'

const props = defineProps<{
  shift: AttendanceShift | null
  /** 같은 화면에서 조정 요청 목록이 읽혔는가(새 서버). 404 를 「근무 없음」과 「옛 서버」로 가르는 데 쓴다 */
  routeKnown: boolean
}>()
const open = defineModel<boolean>('open', { default: false })

const api = useDboAdmin()
const toast = useToast()

const initial = ref<AdjustmentForm>(adjustmentInitial(null))
const form = ref<AdjustmentForm>(adjustmentInitial(null))
const errors = ref<AdjustmentErrors>({})
const failure = ref('')
const sending = ref(false)

const current = computed(() => (props.shift ? attendanceOf(props.shift) : null))
const statusOptions = computed(() => [
  { label: current.value ? `그대로(지금 ${attendanceLabel(current.value.status)})` : '상태를 골라 주세요', value: '' },
  ...ATTENDANCE_STATUSES.map((s) => ({ label: s.label, value: s.value as string })),
])

watch(open, (v) => {
  if (!v || !props.shift) return
  initial.value = adjustmentInitial(attendanceOf(props.shift))
  form.value = { ...initial.value }
  errors.value = {}
  failure.value = ''
})

/* 저장하지 않고 닫을 때 묻는다 — 출퇴근 기록의 수정 창과 같다(QA 2026-11-02 ADM-01, 결정 F8) */
const discardOpen = ref(false)
const discard = createPendingAnswer()
function confirmDiscard(): boolean | Promise<boolean> {
  // 보내는 중에는 닫지 않는다 — 닫혀도 요청은 들어가 「안 보냈다」고 믿게 된다
  if (sending.value) return false
  if (!formChanged(initial.value, form.value)) return true
  discardOpen.value = true
  return discard.ask()
}
function answerDiscard(ok: boolean) {
  discardOpen.value = false
  discard.answer(ok)
}
watch(discardOpen, (v) => {
  if (!v) discard.answer(false)
})
onBeforeRouteLeave(() => (open.value ? confirmDiscard() : true))

async function submit() {
  const shift = props.shift
  if (!shift || sending.value) return
  failure.value = ''
  const built = buildAdjustmentRequest(current.value, initial.value, form.value)
  if (!built.ok) {
    errors.value = built.errors
    return
  }
  errors.value = {}
  sending.value = true
  try {
    await api.createAttendanceRequest(shift.id, built.body)
    toast.add({ title: '조정 요청을 보냈습니다.', description: '담당자가 확정하면 출퇴근 기록이 바뀝니다. 「내 요청」에서 처리 결과를 볼 수 있습니다.', color: 'success' })
    open.value = false
  } catch (e) {
    // 창을 닫지 않는다. 적은 사유가 그대로 남아 있어야 고쳐 다시 보낼 수 있다
    failure.value = adjustmentRequestErrorMessage(e, props.routeKnown)
  } finally {
    sending.value = false
  }
}
</script>

<template>
  <!-- 모양은 출퇴근 기록의 「출결 기록 수정」 창을 따른다 -->
  <AppModal v-model:open="open" title="출결 조정 요청" width="max-w-lg" :before-close="confirmDiscard">
    <div v-if="shift" class="space-y-4">
      <p v-if="failure" role="alert" class="text-sm text-red-600">{{ failure }}</p>
      <div class="rounded-lg border border-hairline bg-surface-soft px-4 py-3 text-sm">
        <p class="font-semibold text-ink">{{ shift.directory?.name ?? '—' }} · {{ shift.worksite?.name ?? '—' }}</p>
        <p class="mt-0.5 text-muted">{{ shift.work_date }} 예정 {{ hhmm(shift.planned_start) }} – {{ hhmm(shift.planned_end) }}</p>
        <p class="mt-1.5 text-body">지금 기록: {{ attendanceLine(current) }}</p>
      </div>
      <FormField label="상태" :required="!current" :error="errors.status">
        <SelectField v-model="form.status" :options="statusOptions" />
      </FormField>
      <!-- 휴대폰 폭에서는 날짜·시각 칸이 좁아 한 줄에 하나씩 -->
      <div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <FormField label="출근 시각">
          <DateField v-model="form.startedAt" type="datetime-local" />
        </FormField>
        <FormField label="퇴근 시각" :error="errors.endedAt">
          <DateField v-model="form.endedAt" type="datetime-local" />
        </FormField>
      </div>
      <FormField label="요청 사유" required :error="errors.reason">
        <AppTextarea v-model="form.reason" :rows="3" :maxlength="REQUEST_REASON_MAX" placeholder="예: 퇴근 QR을 못 찍었습니다. 실제 퇴근은 13시 30분입니다." />
      </FormField>
      <p v-if="errors.form" class="text-sm text-down">{{ errors.form }}</p>
      <p class="text-xs text-muted">
        바꿀 칸만 고쳐 주세요. 그대로 둔 칸은 지금 기록 그대로입니다. 담당자가 확인해 확정하면 기록이 바뀝니다.
      </p>
    </div>
    <template #footer>
      <AppButton variant="outline" color="neutral" size="sm" :disabled="sending" @click="open = false">취소</AppButton>
      <AppButton size="sm" :loading="sending" @click="submit">요청 보내기</AppButton>
    </template>
  </AppModal>

  <!-- 저장하지 않고 닫기 확인. 요청 창 위에 뜨도록 뒤에 둔다. 모양은 출퇴근 기록의 같은 확인 창이다 -->
  <AppModal v-model:open="discardOpen" title="보내지 않고 닫을까요?" width="max-w-md">
    <p class="text-sm text-body">입력한 내용이 사라집니다.</p>
    <template #footer>
      <AppButton variant="outline" color="neutral" size="sm" @click="answerDiscard(false)">계속 쓰기</AppButton>
      <AppButton color="down" size="sm" @click="answerDiscard(true)">보내지 않고 닫기</AppButton>
    </template>
  </AppModal>
</template>
