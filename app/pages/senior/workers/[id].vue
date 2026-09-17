<!-- 명부 상세 — 인적사항 수정·계약 종료 + 반복 배정 CRUD (/dbo-admin/directory, /dbo-admin/assignments) -->
<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import type { Assignment, DirectoryEntry, LifeStatus, Program, Worksite } from '~/types/dbo'
import { phoneKindFromMemo, withPhoneKind } from '~/utils/phoneKind'

const route = useRoute()
const api = useDboAdmin()
const toast = useToast()
const { setHeader } = useAdminHeader()

const id = computed(() => String(route.params.id))

const entry = ref<DirectoryEntry | null>(null)
const loading = ref(true)
const saving = ref(false)

const form = ref({ name: '', phone: '', memo: '', status: 'active' as LifeStatus })
const phoneKind = computed({
  get: () => phoneKindFromMemo(form.value.memo),
  set: (value: string | number | null) => { form.value.memo = withPhoneKind(form.value.memo, value) },
})
const phoneChanged = computed(() => !!entry.value && form.value.phone !== (entry.value.phone ?? ''))

const worksites = ref<Worksite[]>([])
const programs = ref<Program[]>([])
const assignments = ref<Assignment[]>([])

const worksiteName = (wid: string) => worksites.value.find((w) => w.id === wid)?.name ?? wid
const programName = (pid: string | null) =>
  pid ? (programs.value.find((p) => p.id === pid)?.name ?? pid) : '—'

async function loadEntry() {
  loading.value = true
  try {
    const res = await api.getDirectory(id.value)
    entry.value = res
    form.value = {
      name: res.name,
      phone: res.phone ?? '',
      memo: res.memo ?? '',
      status: res.status,
    }
    setHeader(res.name, [{ label: '명부 관리', to: '/senior/workers' }])
  } catch (e: any) {
    toast.add({ title: '명부 조회 실패', description: dboErrorMessage(e), color: 'error' })
  } finally {
    loading.value = false
  }
}

async function loadAssignments() {
  try {
    const res = await api.listAssignments({ directoryId: id.value, size: 100 })
    assignments.value = res.items
  } catch (e: any) {
    toast.add({ title: '배정 조회 실패', description: dboErrorMessage(e), color: 'error' })
  }
}

async function loadRefs() {
  try {
    const [ws, pg] = await Promise.all([api.listWorksites({ size: 100 }), api.listPrograms()])
    worksites.value = ws.items
    programs.value = pg.items
  } catch {
    // 근무지·사업 목록은 선택 편의용이다. 실패해도 상세는 보여준다.
  }
}

async function save() {
  if (!entry.value) return
  if (
    phoneChanged.value &&
    !confirm('전화번호를 바꾸면 해당 사용자의 앱 연결이 끊깁니다. 계속하시겠습니까?')
  )
    return
  saving.value = true
  try {
    await api.updateDirectory(id.value, {
      name: form.value.name.trim(),
      phone: form.value.phone.trim(),
      memo: form.value.memo.trim() || null,
      status: form.value.status,
    })
    toast.add({ title: '저장되었습니다.', color: 'success' })
    loadEntry()
  } catch (e: any) {
    toast.add({ title: '저장 실패', description: dboErrorMessage(e), color: 'error' })
  } finally {
    saving.value = false
  }
}

async function endContract() {
  if (!confirm('계약을 종료하시겠습니까? 기록은 삭제되지 않고 상태만 종료로 바뀝니다.')) return
  try {
    await api.endDirectory(id.value)
    toast.add({ title: '계약이 종료되었습니다.', color: 'success' })
    loadEntry()
  } catch (e: any) {
    toast.add({ title: '종료 실패', description: dboErrorMessage(e), color: 'error' })
  }
}

/* 배정 모달 */
const assignOpen = ref(false)
const assignSaving = ref(false)
const editingId = ref<string | null>(null)
const assignForm = ref({
  worksiteId: null as string | null,
  programId: null as string | null,
  weekdays: [] as number[],
  startTime: '09:00',
  endTime: '11:00',
  periodStart: null as string | null,
  periodEnd: null as string | null,
})

function openAssign(row?: Assignment) {
  editingId.value = row?.id ?? null
  assignForm.value = row
    ? {
        worksiteId: row.worksite_id,
        programId: row.program_id,
        weekdays: [...row.weekdays],
        startTime: hhmm(row.start_time),
        endTime: hhmm(row.end_time),
        periodStart: row.period_start,
        periodEnd: row.period_end,
      }
    : {
        worksiteId: null,
        programId: null,
        weekdays: [],
        startTime: '09:00',
        endTime: '11:00',
        periodStart: null,
        periodEnd: null,
      }
  assignOpen.value = true
}

function toggleWeekday(day: number) {
  const list = assignForm.value.weekdays
  const i = list.indexOf(day)
  if (i >= 0) list.splice(i, 1)
  else list.push(day)
}

async function submitAssign() {
  const f = assignForm.value
  if (!editingId.value && !f.worksiteId) {
    toast.add({ title: '근무지를 선택해 주세요.', color: 'warning' })
    return
  }
  if (!f.weekdays.length) {
    toast.add({ title: '근무 요일을 하나 이상 선택해 주세요.', color: 'warning' })
    return
  }
  assignSaving.value = true
  try {
    if (editingId.value) {
      // 근무지·대상은 배정 수정에서 바꿀 수 없다(API 계약). 바꿔야 하면 삭제 후 재등록한다.
      await api.updateAssignment(editingId.value, {
        programId: f.programId,
        weekdays: f.weekdays,
        startTime: f.startTime,
        endTime: f.endTime,
        periodStart: f.periodStart,
        periodEnd: f.periodEnd,
      })
    } else {
      await api.createAssignment({
        directoryId: id.value,
        worksiteId: f.worksiteId!,
        programId: f.programId,
        weekdays: f.weekdays,
        startTime: f.startTime,
        endTime: f.endTime,
        periodStart: f.periodStart,
        periodEnd: f.periodEnd,
      })
    }
    toast.add({ title: '배정이 저장되었습니다.', color: 'success' })
    assignOpen.value = false
    loadAssignments()
  } catch (e: any) {
    toast.add({ title: '배정 저장 실패', description: dboErrorMessage(e), color: 'error' })
  } finally {
    assignSaving.value = false
  }
}

async function removeAssign(row: Assignment) {
  if (!confirm('이 배정을 삭제하시겠습니까? 이미 생성된 출퇴근 기록은 남습니다.')) return
  try {
    await api.deleteAssignment(row.id)
    toast.add({ title: '배정이 삭제되었습니다.', color: 'success' })
    loadAssignments()
  } catch (e: any) {
    toast.add({ title: '삭제 실패', description: dboErrorMessage(e), color: 'error' })
  }
}

onMounted(() => {
  loadEntry()
  loadAssignments()
  loadRefs()
})
</script>

<template>
  <div class="space-y-6">
    <AppSpinner v-if="loading" label="불러오는 중…" />

    <template v-else-if="entry">
      <Teleport to="#admin-topbar-actions">
        <AppButton variant="outline" color="neutral" icon="i-lucide-arrow-left" @click="navigateTo('/senior/workers')">
          목록
        </AppButton>
        <AppButton
          v-if="entry.status === 'active'"
          variant="soft"
          color="down"
          icon="i-lucide-user-x"
          @click="endContract"
        >
          계약 종료
        </AppButton>
      </Teleport>

      <!-- 인적사항 -->
      <AppCard padding="lg">
        <template #header>
          <div class="flex items-center gap-3">
            <h2 class="text-[18px] font-semibold text-ink">인적사항</h2>
            <Tag>{{ ROLE_LABELS[entry.role] ?? entry.role }}</Tag>
            <StatusBadge :tone="lifeStatusTone(entry.status)">
              {{ lifeStatusLabel(entry.status) }}
            </StatusBadge>
          </div>
          <span class="text-sm text-muted">등록 {{ fmtStamp(entry.created_at) }}</span>
        </template>

        <div class="grid gap-5 md:grid-cols-2">
          <FormField label="이름" required>
            <TextField v-model="form.name" />
          </FormField>
          <FormField
            label="전화번호"
            required
            :hint="phoneChanged ? undefined : '앱 로그인에 쓰는 번호입니다.'"
            :error="phoneChanged ? '번호를 바꾸면 이 사용자의 앱 연결이 끊깁니다.' : undefined"
          >
            <TextField v-model="form.phone" placeholder="010-1234-5678" />
          </FormField>
          <FormField label="상태">
            <SelectField
              v-model="form.status"
              :options="[
                { label: '활성', value: 'active' },
                { label: '종료', value: 'ended' },
              ]"
            />
          </FormField>
          <FormField label="이메일" hint="앱 계정에 연결된 값으로, 어드민에서 바꾸지 않습니다.">
            <TextField :model-value="entry.email ?? '—'" readonly />
          </FormField>
          <FormField v-if="entry.role === 'senior'" label="휴대폰 종류" hint="선택한 종류는 메모에 함께 기록됩니다 저장 버튼을 눌러 반영해 주세요">
            <SelectField
              v-model="phoneKind"
              :options="[
                { label: '미확인', value: 'unknown' },
                { label: '스마트폰', value: 'smartphone' },
                { label: '일반폰', value: 'feature' },
              ]"
            />
          </FormField>
          <div class="md:col-span-2">
            <FormField label="메모" hint="담당자 참고용. 앱에는 보이지 않습니다.">
              <AppTextarea v-model="form.memo" :rows="3" />
            </FormField>
          </div>
        </div>

        <div class="mt-6 flex justify-end">
          <AppButton :loading="saving" @click="save">저장</AppButton>
        </div>
      </AppCard>

      <!-- 반복 배정 -->
      <AppCard padding="none">
        <template #header>
          <div>
            <h2 class="text-[18px] font-semibold text-ink">반복 배정</h2>
            <p class="mt-0.5 text-sm text-muted">
              등록한 요일·시간을 크론이 날짜별 근무로 펼칩니다.
            </p>
          </div>
          <AppButton size="sm" icon="i-lucide-plus" @click="openAssign()">배정 추가</AppButton>
        </template>

        <div class="px-8 pt-2 pb-6">
          <EmptyState v-if="!assignments.length" description="등록된 배정이 없습니다." />
          <table v-else class="w-full border-collapse">
            <thead>
              <tr class="text-[13px] font-semibold text-muted">
                <th class="pr-3 pb-3 text-left">근무지</th>
                <th class="pr-3 pb-3 text-left">사업</th>
                <th class="pr-3 pb-3 text-left">요일</th>
                <th class="pr-3 pb-3 text-left">시간</th>
                <th class="pr-3 pb-3 text-left">기간</th>
                <th class="pb-3 text-right">관리</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="a in assignments" :key="a.id">
                <td
                  class="border-t border-hairline py-[15px] pr-3 text-[15px] font-semibold text-ink"
                >
                  {{ worksiteName(a.worksite_id) }}
                </td>
                <td class="border-t border-hairline py-[15px] pr-3 text-[15px] text-body">
                  {{ programName(a.program_id) }}
                </td>
                <td class="border-t border-hairline py-[15px] pr-3 text-[15px] text-body">
                  {{ weekdaysLabel(a.weekdays) }}
                </td>
                <td class="border-t border-hairline py-[15px] pr-3 text-[15px] text-body">
                  {{ hhmm(a.start_time) }} – {{ hhmm(a.end_time) }}
                </td>
                <td class="border-t border-hairline py-[15px] pr-3 text-[15px] text-body">
                  {{ a.period_start || '—' }} ~ {{ a.period_end || '무기한' }}
                </td>
                <td class="border-t border-hairline py-[15px] text-right whitespace-nowrap">
                  <div class="flex justify-end gap-3">
                    <button
                      type="button"
                      class="text-sm font-medium text-brand-500 hover:underline"
                      @click="openAssign(a)"
                    >
                      수정
                    </button>
                    <button
                      type="button"
                      class="text-sm font-medium text-down hover:underline"
                      @click="removeAssign(a)"
                    >
                      삭제
                    </button>
                  </div>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </AppCard>
    </template>

    <!-- 배정 모달 -->
    <AppModal
      v-model:open="assignOpen"
      :title="editingId ? '배정 수정' : '배정 추가'"
      width="max-w-lg"
    >
      <div class="space-y-4">
        <FormField
          label="근무지"
          required
          :hint="
            editingId ? '근무지는 수정할 수 없습니다. 바꿔야 하면 삭제 후 다시 등록해 주세요.' : undefined
          "
        >
          <SelectField
            v-model="assignForm.worksiteId"
            :disabled="!!editingId"
            :options="worksites.map((w) => ({ label: w.name, value: w.id }))"
            placeholder="근무지 선택"
          />
        </FormField>
        <FormField label="사업">
          <SelectField
            v-model="assignForm.programId"
            :options="programs.map((p) => ({ label: p.name, value: p.id }))"
            placeholder="사업 선택(선택)"
          />
        </FormField>
        <FormField label="근무 요일" required>
          <div class="flex gap-2">
            <button
              v-for="w in WEEKDAYS"
              :key="w.value"
              type="button"
              class="size-10 rounded-full border text-sm font-medium transition-colors"
              :class="
                assignForm.weekdays.includes(w.value)
                  ? 'border-brand-500 bg-brand-500 text-white'
                  : 'border-hairline bg-white text-body hover:bg-surface-soft'
              "
              @click="toggleWeekday(w.value)"
            >
              {{ w.label }}
            </button>
          </div>
        </FormField>
        <div class="grid grid-cols-2 gap-4">
          <FormField label="시작 시간" required>
            <DateField v-model="assignForm.startTime" type="time" />
          </FormField>
          <FormField label="종료 시간" required>
            <DateField v-model="assignForm.endTime" type="time" />
          </FormField>
        </div>
        <div class="grid grid-cols-2 gap-4">
          <FormField label="시작일">
            <DateField v-model="assignForm.periodStart" />
          </FormField>
          <FormField label="종료일" hint="비우면 무기한">
            <DateField v-model="assignForm.periodEnd" />
          </FormField>
        </div>
      </div>
      <template #footer>
        <AppButton variant="outline" color="neutral" size="sm" @click="assignOpen = false">
          취소
        </AppButton>
        <AppButton size="sm" :loading="assignSaving" @click="submitAssign">저장</AppButton>
      </template>
    </AppModal>
  </div>
</template>
