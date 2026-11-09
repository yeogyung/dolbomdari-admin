<!-- 명부 상세 — 인적사항 수정·계약 종료 + 시니어는 반복 배정, 담당자는 담당 수요처(여러 곳), 수요처 담당자는 담당 수요처(1곳) (/dbo-admin/directory, /dbo-admin/assignments) -->
<script setup lang="ts">
import { ref, computed, watch, onMounted } from 'vue'
import type { Assignment, DirectoryEntry, LifeStatus, PersonNotice, PersonRoom, Program, Worksite } from '~/types/dbo'
import { phoneKindFromMemo, withPhoneKind } from '~/utils/phoneKind'
import { personNoticeCounts, personNoticeRead, personNoticesUnsupported } from '~/utils/personActivity'
import { assignmentTimeErrors, timeGroupLine, timeGroups, type DayTimes, type TimeGroup } from '~/utils/assignmentTimes'
import { bulkAssignErrorMessage, isShiftSyncFailed } from '~/utils/bulkAssign'
import { failureLines, runSequential } from '~/utils/bulkRun'

const route = useRoute()
const api = useDboAdmin()
const toast = useToast()
const { setHeader } = useAdminHeader()
/** 「목록」 — 목록에서 왔으면 뒤로 가서 필터를 지킨다 */
const backToList = useBackToList('/senior/workers')

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
    // 상태는 저장됐다 — 화면을 서버 값으로 맞추고 다시 저장하게 한다
    const partial = shiftSyncFailedMessage(e, 'save')
    if (partial) {
      toast.add({ title: '근무 정리 실패', description: partial, color: 'warning' })
      loadEntry()
      return
    }
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
    // 종료는 됐다 — 화면을 서버 값(종료)으로 맞춘다
    const partial = shiftSyncFailedMessage(e, 'end')
    if (partial) {
      toast.add({ title: '근무 정리 실패', description: partial, color: 'warning' })
      loadEntry()
      return
    }
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
  /** 요일마다 다른 시간(QA 2026-11-07 SHIFT-04 · 결정 D26) — 배정 추가에서만. 같은 시간인 요일끼리 배정을 나눠 만든다 */
  perDay: false,
  dayTimes: {} as DayTimes,
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
  assignTried.value = false
  assignError.value = null
  assignResult.value = null
  editingId.value = row?.id ?? null
  assignProgram.value = row ? (row.program_id ?? NO_PROGRAM) : null
  assignForm.value = row
    ? {
        worksiteId: row.worksite_id,
        weekdays: [...row.weekdays],
        startTime: hhmm(row.start_time),
        endTime: hhmm(row.end_time),
        perDay: false,
        dayTimes: {},
        periodStart: row.period_start,
        periodEnd: row.period_end,
      }
    : {
        worksiteId: null,
        weekdays: [],
        startTime: '09:00',
        endTime: '11:00',
        perDay: false,
        dayTimes: {},
        periodStart: null,
        periodEnd: null,
      }
  assignOpen.value = true
}

const assignPeriodErrors = computed(() =>
  assignmentPeriodErrors(assignForm.value.periodStart, assignForm.value.periodEnd),
)
/** 저장을 한 번 눌렀는가. 시작일 「입력해 주세요」는 그 뒤부터 칸 아래에 보인다 — 창을 열자마자 빨간 글씨가 뜨지 않게 */
const assignTried = ref(false)
/** 서버가 저장을 거절한 이유(시작일 없음·겹친 배정). 창 안에 보이고, 창을 열거나 다시 저장하면 지운다 */
const assignError = ref<{ message: string; conflicts: string[] } | null>(null)
/** 요일마다 다른 시간의 칸별 오류 — 저장을 한 번 누른 뒤부터 보인다 */
const assignDayErrors = computed(() => (assignForm.value.perDay ? assignmentTimeErrors(assignForm.value).days : undefined))
/**
 * 배정 여러 개로 나눠 저장한 결과(결정 D26). 일부만 실패하면 창을 닫지 않고 무엇이 저장됐는지·무엇이 왜 안 됐는지 보인다 —
 * 창에서 다시 저장하면 이미 저장된 배정을 또 만들게 되어 결과 화면으로 바꾸고 「닫기」만 둔다
 */
const assignResult = ref<{ saved: string[]; failed: { name: string; reason: string }[]; syncFailed: string[] } | null>(null)
// 나눠 저장하는 동안 화면을 떠나면 결과가 사라진다(여러 명 배정과 같다)
useBusyLeaveGuard(assignSaving)

/** 배정 여러 개를 차례로 만든다. 한 묶음이 실패해도 나머지는 계속한다(여러 명 배정과 같은 판단, 결정 D25) */
async function createAssignmentGroups(groups: TimeGroup[]) {
  const f = assignForm.value
  const syncFailed: TimeGroup[] = []
  const result = await runSequential(groups, async (g) => {
    try {
      await api.createAssignment({
        directoryId: id.value,
        worksiteId: f.worksiteId!,
        programId: assignProgramId.value,
        weekdays: g.weekdays,
        startTime: g.startTime,
        endTime: g.endTime,
        periodStart: f.periodStart,
        periodEnd: f.periodEnd,
      })
    } catch (e) {
      // 배정은 저장됐다 — 실패로 세면 다시 만들게 된다
      if (!isShiftSyncFailed(e)) throw e
      syncFailed.push(g)
    }
  })
  loadAssignments()
  if (!result.failed.length && !syncFailed.length) {
    toast.add({ title: `배정 ${groups.length}개가 저장되었습니다.`, color: 'success' })
    assignOpen.value = false
    return
  }
  assignResult.value = {
    saved: result.done.filter((g) => !syncFailed.includes(g)).map(timeGroupLine),
    failed: failureLines(result.failed, timeGroupLine, (e) => bulkAssignErrorMessage(e) ?? dboErrorMessage(e)),
    syncFailed: syncFailed.map(timeGroupLine),
  }
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
  assignTried.value = true
  if (assignDayErrors.value) {
    toast.add({ title: '요일별 근무 시간을 확인해 주세요.', color: 'warning' })
    return
  }
  const periodError = assignPeriodErrors.value.start ?? assignPeriodErrors.value.end
  if (periodError) {
    toast.add({ title: periodError, color: 'warning' })
    return
  }
  // 요일마다 시간이 다르면 같은 시간인 요일끼리 배정 여러 개로 나눠 만든다(결정 D26). 하나면 예전 저장 그대로
  const groups = timeGroups(f)
  assignSaving.value = true
  assignError.value = null
  if (!editingId.value && groups.length > 1) {
    try {
      await createAssignmentGroups(groups)
    } finally {
      assignSaving.value = false
    }
    return
  }
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
        weekdays: groups[0]!.weekdays,
        startTime: groups[0]!.startTime,
        endTime: groups[0]!.endTime,
        periodStart: f.periodStart,
        periodEnd: f.periodEnd,
      })
    }
    toast.add({ title: '배정이 저장되었습니다.', color: 'success' })
    assignOpen.value = false
    loadAssignments()
  } catch (e: any) {
    // 배정은 저장됐다 — 창을 닫고 목록을 다시 읽는다. 창에서 다시 누르면 같은 배정을 또 만든다(리뷰 반영)
    const partial = shiftSyncFailedMessage(e, 'assignment')
    if (partial) {
      toast.add({ title: '근무 정리 실패', description: partial, color: 'warning' })
      assignOpen.value = false
      loadAssignments()
      return
    }
    // 겹친 배정은 여러 줄이라 알림 대신 창 안에 보인다. 창은 닫지 않는다 — 고쳐서 다시 저장한다
    assignError.value = assignmentSaveError(e)
    if (!assignError.value) toast.add({ title: '배정 저장 실패', description: dboErrorMessage(e), color: 'error' })
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

/*
 * 받은 공지·참여 중인 채팅방(QA 2026-11-07 ADMIN-03) — 다른 메뉴에서 다시 찾지 않고 여기서 본다.
 * 둘 다 덧붙이는 정보라 실패해도 상세는 그대로 두고 그 카드에만 적는다
 */
const notices = ref<PersonNotice[] | null>(null)
const noticesError = ref('')
const noticeCounts = computed(() => personNoticeCounts(notices.value ?? []))

async function loadNotices() {
  try {
    notices.value = (await api.listPersonNotices(id.value)).items
  } catch (e: any) {
    noticesError.value = personNoticesUnsupported(e)
      ? '받은 공지는 서버 업데이트 뒤에 볼 수 있습니다.'
      : dboErrorMessage(e, '받은 공지를 불러오지 못했습니다.')
  }
}

const { roomsOf } = useRoomPeople()
const rooms = ref<PersonRoom[] | null>(null)
const roomsError = ref('')

async function loadRooms() {
  try {
    rooms.value = await roomsOf(id.value)
  } catch (e: any) {
    roomsError.value = dboErrorMessage(e, '참여 중인 채팅방을 불러오지 못했습니다.')
  }
}

onMounted(async () => {
  loadRefs()
  loadNotices()
  loadRooms()
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
        <AppButton variant="outline" color="neutral" icon="i-lucide-arrow-left" @click="backToList">
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
            <StatusBadge v-if="appConnectionBadge(entry)" :tone="appConnectionBadge(entry)!.tone">
              앱 {{ appConnectionBadge(entry)!.label }}
            </StatusBadge>
          </div>
          <span class="text-sm text-muted">
            <template v-if="entry.last_sign_in_at">최근 로그인 {{ fmtStamp(entry.last_sign_in_at) }} · </template>
            등록 {{ fmtStamp(entry.created_at) }}
          </span>
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

      <!-- 받은 공지(QA 2026-11-07 ADMIN-03) — 발송 최신순 50건. 모양은 반복 배정 표를 따른다 -->
      <AppCard padding="none">
        <template #header>
          <div>
            <h2 class="text-[18px] font-semibold text-ink">받은 공지</h2>
            <p class="mt-0.5 text-sm text-muted">
              최근 50건까지 보입니다.
              <template v-if="notices?.length">미열람 {{ noticeCounts.unread }}건.</template>
            </p>
          </div>
        </template>
        <div class="px-8 pt-2 pb-6">
          <p v-if="noticesError" class="text-sm text-down" role="alert">{{ noticesError }}</p>
          <AppSpinner v-else-if="!notices" label="받은 공지 불러오는 중…" />
          <EmptyState v-else-if="!notices.length" description="받은 공지가 없습니다." />
          <div v-else class="overflow-x-auto">
            <table class="w-full border-collapse">
              <thead>
                <tr class="text-[13px] font-semibold text-muted">
                  <th class="pr-3 pb-3 text-left">제목</th>
                  <th class="pr-3 pb-3 text-left">구분</th>
                  <th class="pr-3 pb-3 text-left">보낸 시각</th>
                  <th class="pb-3 text-left">읽음</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="n in notices" :key="n.id">
                  <td class="border-t border-hairline py-3 pr-3 text-[15px]">
                    <NuxtLink :to="`/senior/notices/${n.id}`" class="font-semibold text-ink hover:text-brand-500 hover:underline">
                      {{ n.title }}
                    </NuxtLink>
                    <Tag v-if="n.status === 'revoked'" class="ml-1.5">회수됨</Tag>
                  </td>
                  <td class="border-t border-hairline py-3 pr-3 text-[15px] whitespace-nowrap text-body">
                    {{ noticeTypeLabel(n) }}
                  </td>
                  <td class="border-t border-hairline py-3 pr-3 text-[15px] whitespace-nowrap text-body tabular-nums">
                    {{ fmtStamp(n.published_at) }}
                  </td>
                  <td class="border-t border-hairline py-3 text-[15px] whitespace-nowrap">
                    <StatusBadge :tone="personNoticeRead(n).tone">{{ personNoticeRead(n).label }}</StatusBadge>
                    <span v-if="n.read_at" class="ml-1.5 text-sm text-muted tabular-nums">{{ fmtStamp(n.read_at) }}</span>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </AppCard>

      <!-- 참여 중인 채팅방(QA 2026-11-07 ADMIN-03) — 누르면 채팅방 화면에서 그 방이 열린다 -->
      <AppCard padding="lg">
        <template #header>
          <div>
            <h2 class="text-[18px] font-semibold text-ink">참여 중인 채팅방</h2>
            <p class="mt-0.5 text-sm text-muted">누르면 채팅방 화면에서 그 방의 대화를 봅니다.</p>
          </div>
        </template>
        <p v-if="roomsError" class="text-sm text-down" role="alert">{{ roomsError }}</p>
        <AppSpinner v-else-if="!rooms" label="채팅방 불러오는 중…" />
        <EmptyState v-else-if="!rooms.length" description="참여 중인 채팅방이 없습니다." />
        <ul v-else class="divide-y divide-hairline">
          <li v-for="r in rooms" :key="r.id" class="flex flex-wrap items-center gap-x-3 gap-y-1 py-3">
            <NuxtLink :to="`/senior/chat?room=${r.id}`" class="text-[15px] font-semibold text-ink hover:text-brand-500 hover:underline">
              {{ r.title }}
            </NuxtLink>
            <StatusBadge :tone="r.status === 'active' ? 'green' : 'gray'">{{ r.status === 'active' ? '활성' : '종료' }}</StatusBadge>
            <span class="text-sm text-muted">{{ r.kind === 'direct' ? '1:1' : '단체' }}</span>
            <span v-if="r.ai_enabled" class="text-sm text-brand-500">AI 사용</span>
          </li>
        </ul>
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
      :before-close="() => !assignSaving"
    >
      <!-- 배정 여러 개로 나눠 저장한 결과(결정 D26) — 일부만 실패했을 때만 -->
      <BulkResultPanel
        v-if="assignResult"
        done-label="저장"
        :done="assignResult.saved.length + assignResult.syncFailed.length"
        :failed="assignResult.failed"
      >
        <div v-if="assignResult.saved.length" class="rounded-lg border border-hairline bg-surface-soft px-4 py-3 text-body">
          <p class="font-medium">저장된 배정</p>
          <ul class="mt-1.5 list-disc space-y-0.5 pl-5 tabular-nums">
            <li v-for="line in assignResult.saved" :key="line">{{ line }}</li>
          </ul>
        </div>
        <div v-if="assignResult.syncFailed.length" class="rounded-lg border border-hairline bg-surface-soft px-4 py-3 text-body">
          <p class="font-medium">아래 배정은 저장됐지만 오늘·내일 근무 정리만 실패했습니다.</p>
          <p class="mt-0.5 text-muted">목록에서 그 배정의 「수정」을 열어 저장을 한 번 더 누르면 맞춰집니다.</p>
          <ul class="mt-1.5 list-disc space-y-0.5 pl-5 tabular-nums">
            <li v-for="line in assignResult.syncFailed" :key="line">{{ line }}</li>
          </ul>
        </div>
      </BulkResultPanel>
      <div v-else class="space-y-4">
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
          <WeekdayPicker v-model="assignForm.weekdays" />
        </FormField>
        <AssignmentTimeFields
          v-model:start-time="assignForm.startTime"
          v-model:end-time="assignForm.endTime"
          v-model:per-day="assignForm.perDay"
          v-model:day-times="assignForm.dayTimes"
          :weekdays="assignForm.weekdays"
          :allow-per-day="!editingId"
          :day-errors="assignTried ? assignDayErrors : undefined"
        />
        <div class="grid grid-cols-2 gap-4">
          <FormField label="시작일" required :error="assignTried ? assignPeriodErrors.start : undefined">
            <DateField v-model="assignForm.periodStart" />
          </FormField>
          <FormField label="종료일" hint="비우면 무기한" :error="assignPeriodErrors.end">
            <DateField v-model="assignForm.periodEnd" />
          </FormField>
        </div>
        <!-- 모양은 출결 삭제 창의 경고 상자를 따른다 -->
        <div v-if="assignError" class="rounded-lg border border-down bg-down-soft px-4 py-3 text-sm text-down" role="alert">
          <p class="font-semibold">{{ assignError.message }}</p>
          <template v-if="assignError.conflicts.length">
            <p class="mt-1.5">이 근무지의 아래 배정과 요일·시간·기간이 겹쳐 저장하지 않았습니다.</p>
            <ul class="mt-1.5 list-disc space-y-0.5 pl-5 tabular-nums">
              <li v-for="(line, i) in assignError.conflicts" :key="i">{{ line }}</li>
            </ul>
          </template>
        </div>
      </div>
      <template #footer>
        <AppButton v-if="assignResult" size="sm" @click="assignOpen = false">닫기</AppButton>
        <template v-else>
          <AppButton variant="outline" color="neutral" size="sm" :disabled="assignSaving" @click="assignOpen = false">
            취소
          </AppButton>
          <AppButton size="sm" :loading="assignSaving" @click="submitAssign">저장</AppButton>
        </template>
      </template>
    </AppModal>
  </div>
</template>
