<!-- 명부 상세 — 인적사항 수정·계약 종료 + 시니어는 반복 배정, 담당자는 담당 수요처(여러 곳), 수요처 담당자는 담당 수요처(1곳) (/dbo-admin/directory, /dbo-admin/assignments) -->
<script setup lang="ts">
import { ref, computed, watch, onMounted } from 'vue'
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

// 전체 스피너는 처음 들어올 때만이다(loading 은 true 로 시작). 저장 뒤 다시 받을 때 화면을
// 통째로 스피너로 바꾸면 입력하던 카드가 사라졌다 나타난다.
async function loadEntry() {
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

/*
 * 첫 조회가 끝났는가(성공·실패 모두). 배정 표의 근무지·사업 이름은 근무지·사업 목록에서
 * 찾으므로, 둘 중 하나만 먼저 오면 이름 대신 id 가 보였다가 바뀐다. 둘 다 올 때까지
 * 스피너를 띄운다. 저장 뒤 다시 받을 때는 기존 표를 그대로 둔다.
 */
const assignmentsLoaded = ref(false)
const refsSettled = ref(false)

async function loadAssignments() {
  try {
    const res = await api.listAssignments({ directoryId: id.value, size: 100 })
    assignments.value = res.items
  } catch (e: any) {
    toast.add({ title: '배정 조회 실패', description: dboErrorMessage(e), color: 'error' })
  } finally {
    assignmentsLoaded.value = true
  }
}

async function loadRefs() {
  // 다시 받다가 실패하면 이전 목록으로 저장하지 않게 먼저 내려 둔다
  worksitesComplete.value = false
  refsFailed.value = false
  try {
    // 근무지는 100곳을 넘는다 — 첫 페이지만 받으면 배정·담당 수요처 선택지에서 빠진다
    const [ws, pg] = await Promise.all([api.listAllWorksites(), api.listPrograms()])
    worksites.value = ws
    programs.value = pg.items
    managed.value = ws.filter((w) => w.care_manager_directory_id === id.value).map((w) => w.id)
    worksitesComplete.value = true
  } catch {
    // 근무지·사업 목록은 선택 편의용이다. 실패해도 상세는 보여준다.
    refsFailed.value = true
  } finally {
    refsSettled.value = true
  }
}

/* 담당 수요처 — 담당자만. 담당 관계는 근무지의 근무지 담당자 칸(care_manager_directory_id)에 있다.
   수요처 담당자 칸(manager_directory_id, role=worksite)과 다르다 */
/** 저장된 담당 수요처. 모달에서 고치는 값은 managedDraft 다 — 취소하면 버린다 */
const managed = ref<string[]>([])
const managedDraft = ref<string[]>([])
const managedOpen = ref(false)
const managedSaving = ref(false)
const refsFailed = ref(false)
const managedWorksites = computed(() => worksites.value.filter((w) => managed.value.includes(w.id)))
/**
 * 수요처 목록을 빠짐없이 받았는가. 저장은 「보낸 목록이 곧 결과」라, 일부만 받은 채 저장하면
 * 화면에 없던 담당 수요처가 해제된다. 조회에 실패했으면 저장을 막는다.
 */
const worksitesComplete = ref(false)

/** 다른 담당자가 맡고 있는 수요처 — 고르면 이 담당자로 넘어온다 */
const takenByOther = (w: Worksite) =>
  !!w.care_manager_directory_id && w.care_manager_directory_id !== id.value

function openManaged() {
  managedDraft.value = [...managed.value]
  managedOpen.value = true
}

async function saveManaged() {
  const moving = worksites.value.filter((w) => managedDraft.value.includes(w.id) && takenByOther(w))
  if (
    moving.length &&
    !confirm(
      `${moving.map((w) => w.name).join(', ')} 은(는) 다른 담당자가 맡고 있습니다. 이 담당자로 옮기시겠습니까?`,
    )
  )
    return
  managedSaving.value = true
  try {
    await api.setManagerWorksites(id.value, managedDraft.value)
    toast.add({ title: '담당 수요처가 저장되었습니다.', color: 'success' })
    managedOpen.value = false
    loadRefs()
  } catch (e: any) {
    toast.add({ title: '담당 수요처 저장 실패', description: dboErrorMessage(e), color: 'error' })
  } finally {
    managedSaving.value = false
  }
}

/*
 * 담당 수요처 — 수요처 담당자(role=worksite)만. 1곳을 맡는다. 서버가 권한 칸(명부 worksite_id)과
 * 근무지의 「수요처 담당자」 표시(manager_directory_id)를 함께 맞춘다. 근무지 담당자(사회복지사)와 다르다.
 */
const contactWorksite = computed(
  () => worksites.value.find((w) => w.id === entry.value?.worksite_id) ?? null,
)
const contactOpen = ref(false)
const contactDraft = ref<string | null>(null)
const contactSaving = ref(false)

function openContact() {
  contactDraft.value = entry.value?.worksite_id ?? null
  contactOpen.value = true
}

async function saveContact() {
  if (!contactDraft.value) {
    toast.add({ title: '담당 수요처를 선택해 주세요.', color: 'warning' })
    return
  }
  // 근무지의 수요처 담당자 표시는 한 사람이다 — 다른 사람이 표시돼 있으면 바뀐다고 알린다
  const target = worksites.value.find((w) => w.id === contactDraft.value)
  if (
    target?.manager_directory_id &&
    target.manager_directory_id !== id.value &&
    !confirm(`${target.name} 의 수요처 담당자 표시가 이 사람으로 바뀝니다. 계속하시겠습니까?`)
  )
    return
  contactSaving.value = true
  try {
    await api.setContactWorksite(id.value, contactDraft.value)
    toast.add({ title: '담당 수요처가 저장되었습니다.', color: 'success' })
    contactOpen.value = false
    loadEntry()
    loadRefs()
  } catch (e: any) {
    toast.add({ title: '담당 수요처 저장 실패', description: dboErrorMessage(e), color: 'error' })
  } finally {
    contactSaving.value = false
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
      // 바꿨을 때만 보낸다 — 이메일로 발급한 수요처 계정은 번호가 비어 있어, 빈 값을 보내면
      // 서버가 형식 오류(bad_phone)로 저장 전체를 거절한다
      ...(phoneChanged.value ? { phone: form.value.phone.trim() } : {}),
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
  weekdays: [] as number[],
  startTime: '09:00',
  endTime: '11:00',
  periodStart: null as string | null,
  periodEnd: null as string | null,
})

/*
 * 사업 → 근무지 순서로 고른다. 근무지가 300곳 가까이라 사업으로 먼저 좁힌다.
 * 배정의 사업은 근무지의 사업을 따른다(운영 데이터에서 어긋난 배정 0건) — 폼에 따로 두지 않고
 * 고른 사업에서 계산해 둘이 어긋날 수 없게 한다. 사업이 없는 근무지는 「사업 미지정」으로 고른다.
 */
const NO_PROGRAM = '__none'
const assignProgram = ref<string | null>(null)
const assignProgramId = computed(() =>
  !assignProgram.value || assignProgram.value === NO_PROGRAM ? null : assignProgram.value,
)
const assignWorksiteOptions = computed(() => {
  const pick = assignProgram.value
  const list = pick
    ? worksites.value.filter((w) => (pick === NO_PROGRAM ? !w.program_id : w.program_id === pick))
    : []
  // 수정 중에는 근무지를 바꿀 수 없지만 셀렉트가 이름을 보여 주도록 남긴다
  const current = worksites.value.find((w) => w.id === assignForm.value.worksiteId)
  if (current && !list.includes(current)) list.unshift(current)
  return list.map((w) => ({ label: w.status === 'ended' ? `${w.name} (종료)` : w.name, value: w.id }))
})
// 사업을 바꾸면 그 사업 밖의 근무지 선택을 비운다
watch(assignProgram, () => {
  if (editingId.value) return
  const w = worksites.value.find((x) => x.id === assignForm.value.worksiteId)
  if (w && (w.program_id ?? null) !== assignProgramId.value) assignForm.value.worksiteId = null
})

function openAssign(row?: Assignment) {
  editingId.value = row?.id ?? null
  assignProgram.value = row ? (row.program_id ?? NO_PROGRAM) : null
  assignForm.value = row
    ? {
        worksiteId: row.worksite_id,
        weekdays: [...row.weekdays],
        startTime: hhmm(row.start_time),
        endTime: hhmm(row.end_time),
        periodStart: row.period_start,
        periodEnd: row.period_end,
      }
    : {
        worksiteId: null,
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
  if (!editingId.value && !assignProgram.value) {
    toast.add({ title: '사업을 먼저 선택해 주세요.', color: 'warning' })
    return
  }
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
        programId: assignProgramId.value,
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
        programId: assignProgramId.value,
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

/** 배정 삭제 중복 클릭 방지 — 일반 버튼이라 AppButton 의 잠금이 없다 */
const removeGuard = createClickGuard()

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

onMounted(async () => {
  loadRefs()
  await loadEntry()
  // 반복 배정은 시니어에게 근무지를 잇는 것이다. 담당자에게는 없다.
  if (entry.value?.role === 'senior') loadAssignments()
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

      <!-- 담당 수요처 — 담당자 -->
      <AppCard v-if="entry.role === 'manager'" padding="lg">
        <template #header>
          <div>
            <h2 class="text-[18px] font-semibold text-ink">담당 수요처</h2>
            <p class="mt-0.5 text-sm text-muted">
              고른 수요처의 출퇴근 기록을 이 담당자가 어드민에서 보고 고칠 수 있습니다.
            </p>
          </div>
          <AppButton size="sm" icon="i-lucide-pencil" :disabled="!worksitesComplete" @click="openManaged">
            담당 수요처 변경
          </AppButton>
        </template>

        <p v-if="refsFailed" class="mb-4 text-sm text-down">
          수요처 목록을 모두 불러오지 못해 변경할 수 없습니다. 새로고침해 주세요.
        </p>
        <AppSpinner v-if="!refsSettled" label="담당 수요처 불러오는 중…" />
        <EmptyState v-else-if="!managedWorksites.length" description="지정된 담당 수요처가 없습니다." />
        <ul v-else class="divide-y divide-hairline">
          <li v-for="w in managedWorksites" :key="w.id" class="flex items-center gap-3 py-3">
            <span class="text-[15px] font-semibold text-ink">{{ w.name }}</span>
            <span class="text-sm text-muted">{{ programName(w.program_id) }}</span>
            <Tag v-if="w.status === 'ended'">종료</Tag>
          </li>
        </ul>
      </AppCard>

      <!-- 담당 수요처 — 수요처 담당자 -->
      <AppCard v-if="entry.role === 'worksite'" padding="lg">
        <template #header>
          <div>
            <h2 class="text-[18px] font-semibold text-ink">담당 수요처</h2>
            <p class="mt-0.5 text-sm text-muted">
              이 수요처 담당자가 어드민·앱에서 출석 명단을 보는 근무지입니다. 1곳만 맡습니다.
            </p>
          </div>
          <AppButton size="sm" icon="i-lucide-pencil" :disabled="!worksitesComplete" @click="openContact">
            담당 수요처 변경
          </AppButton>
        </template>

        <p v-if="refsFailed" class="mb-4 text-sm text-down">
          수요처 목록을 모두 불러오지 못해 변경할 수 없습니다. 새로고침해 주세요.
        </p>
        <AppSpinner v-if="!refsSettled" label="담당 수요처 불러오는 중…" />
        <EmptyState v-else-if="!entry.worksite_id" description="지정된 담당 수요처가 없습니다." />
        <div v-else class="flex items-center gap-3">
          <span class="text-[15px] font-semibold text-ink">{{ contactWorksite?.name ?? entry.worksite_id }}</span>
          <span class="text-sm text-muted">{{ programName(contactWorksite?.program_id ?? null) }}</span>
          <Tag v-if="contactWorksite?.status === 'ended'">종료</Tag>
        </div>
      </AppCard>

      <!-- 반복 배정 — 시니어에게 근무지를 잇는다 -->
      <AppCard v-if="entry.role === 'senior'" padding="none">
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
          <AppSpinner v-if="!assignmentsLoaded || !refsSettled" label="배정 불러오는 중…" />
          <EmptyState v-else-if="!assignments.length" description="등록된 배정이 없습니다." />
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
                      class="text-sm font-medium text-down hover:underline disabled:opacity-50"
                      :disabled="removeGuard.pending.value"
                      @click="removeGuard.run(() => removeAssign(a))"
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

    <!-- 담당 수요처 모달 — 수요처 담당자(1곳) -->
    <AppModal v-model:open="contactOpen" title="담당 수요처 지정" width="max-w-2xl">
      <WorksitePicker v-model="contactDraft" :worksites="worksites" :programs="programs" />
      <template #footer>
        <AppButton variant="outline" color="neutral" size="sm" @click="contactOpen = false">
          취소
        </AppButton>
        <AppButton size="sm" :loading="contactSaving" @click="saveContact">저장</AppButton>
      </template>
    </AppModal>

    <!-- 담당 수요처 모달 — 담당자 -->
    <AppModal v-model:open="managedOpen" title="담당 수요처 배정" width="max-w-2xl">
      <WorksitePicker
        v-model="managedDraft"
        :worksites="worksites"
        :programs="programs"
        :is-taken="takenByOther"
        multiple
      />
      <template #footer>
        <AppButton variant="outline" color="neutral" size="sm" @click="managedOpen = false">
          취소
        </AppButton>
        <AppButton size="sm" :loading="managedSaving" @click="saveManaged">저장</AppButton>
      </template>
    </AppModal>

    <!-- 배정 모달 -->
    <AppModal
      v-model:open="assignOpen"
      :title="editingId ? '배정 수정' : '배정 추가'"
      width="max-w-lg"
    >
      <div class="space-y-4">
        <FormField
          label="사업"
          required
          :hint="
            editingId
              ? '사업·근무지는 수정할 수 없습니다. 바꿔야 하면 삭제 후 다시 등록해 주세요.'
              : '사업을 고르면 그 사업의 근무지가 나옵니다.'
          "
        >
          <SelectField
            v-model="assignProgram"
            :disabled="!!editingId"
            :options="[
              ...programs.map((p) => ({ label: p.name, value: p.id })),
              { label: '사업 미지정', value: NO_PROGRAM },
            ]"
            placeholder="사업 선택"
          />
        </FormField>
        <FormField label="근무지" required>
          <SelectField
            v-model="assignForm.worksiteId"
            :disabled="!!editingId || !assignProgram"
            :options="assignWorksiteOptions"
            :placeholder="
              !assignProgram
                ? '사업을 먼저 선택해 주세요'
                : assignWorksiteOptions.length
                  ? `근무지 선택 (${assignWorksiteOptions.length}곳)`
                  : '이 사업에 근무지가 없습니다'
            "
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
